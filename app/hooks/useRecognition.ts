import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/app/i18n';
import * as ort from 'onnxruntime-web';
import { Database, get_phash_raw } from 'core-wasm';
import { Box, CardHashEntry, RecognizedCard, CardInfo, Match } from '../types';
import {
    preprocessImage,
    postprocessYOLO,
    sortBoxesByRow,
    ImageProcessor,
    STANDARD_CARD,
    PENDULUM_CARD,
    SAMPLE_OFFSETS,
    EARLY_EXIT_DISTANCE
} from '../utils/recognition';
import { getCardImageUrl } from '../config';
import { globalCardInfoCache, fetchCardInfo as apiFetchCardInfo } from '../utils/cardApi';
import { getRecognitionRuntime, subscribeRuntime } from '../utils/recognitionRuntime';

export { globalCardInfoCache };

export type ProcessingStage = 'idle' | 'detecting' | 'identifying' | 'done';

export interface ProcessingVisual {
    index: number;
    artworkUrl: string;
    currentMatchName: string;
}

export interface UseRecognitionReturn {
    // 状态
    isInitializing: boolean;
    statusText: string;
    processingStage: ProcessingStage;
    progress: number;
    processingVisual: ProcessingVisual | null;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    selectedCardInfo: CardInfo | null;
    isDetailLoading: boolean;
    originalImage: HTMLImageElement | null;
    modelDownloadProgress: number | null;

    // WASM相关
    session: ort.InferenceSession | null;
    wasmDb: Database | null;

    // 方法
    processImage: (img: HTMLImageElement) => Promise<void>;
    selectCard: (index: number) => Promise<void>;
    reprocessCard: (index: number, forcePendulum?: boolean, boxOverride?: Box) => Promise<void>;
    handleSelectAltMatch: (matchIndex: number) => void;
    updateCardBox: (index: number, box: Box) => void;
    setOriginalImage: (img: HTMLImageElement | null) => void;
    setSelectedCardIndex: (index: number) => void;
    setRecognizedCards: React.Dispatch<React.SetStateAction<RecognizedCard[]>>;
    setSelectedCardInfo: React.Dispatch<React.SetStateAction<CardInfo | null>>;
    setProcessingStage: React.Dispatch<React.SetStateAction<ProcessingStage>>;
    resetState: () => void;
    waitForInit: () => Promise<void>;
    cardInfoVersion: number;
}

export function useRecognition(): UseRecognitionReturn {
    const { t, locale } = useTranslation();
    // 会话状态
    const [session, setSession] = useState<ort.InferenceSession | null>(null);
    const [hashDatabase, setHashDatabase] = useState<CardHashEntry[] | null>(null);
    const [wasmDb, setWasmDb] = useState<Database | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [statusText, setStatusText] = useState('');
    const [modelDownloadProgress, setModelDownloadProgress] = useState<number | null>(null);

    // 使用 ref 存储最新值，解决闭包陷阱问题
    // 在初始化完成时直接更新 ref（同步），确保 processImage 能立即访问到最新值
    const sessionRef = useRef<ort.InferenceSession | null>(null);
    const hashDatabaseRef = useRef<CardHashEntry[] | null>(null);
    const wasmDbRef = useRef<Database | null>(null);
    const localeRef = useRef(locale);
    localeRef.current = locale;

    // 等待初始化完成的方法
    const translationRef = useRef(t);
    translationRef.current = t;
    const activeRef = useRef(false);
    const waitForInit = useCallback(async () => {
        if (activeRef.current) setIsInitializing(true);
        try {
            const runtime = await getRecognitionRuntime();
            if (!activeRef.current) return;
            sessionRef.current = runtime.session;
            hashDatabaseRef.current = runtime.hashes;
            wasmDbRef.current = runtime.database;
            setSession(runtime.session);
            setHashDatabase(runtime.hashes);
            setWasmDb(runtime.database);
            setStatusText(translationRef.current('recognition.ready'));
        } catch (error) {
            if (activeRef.current) setStatusText(translationRef.current('recognition.initFailed', {
                message: error instanceof Error ? error.message : String(error),
            }));
            throw error;
        } finally {
            if (activeRef.current) {
                setIsInitializing(false);
                setModelDownloadProgress(null);
            }
        }
    }, []);

    // 图像和处理状态
    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
    const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
    const [progress, setProgress] = useState(0);
    const [processingVisual, setProcessingVisual] = useState<ProcessingVisual | null>(null);

    // 结果状态
    const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
    const [selectedCardIndex, setSelectedCardIndex] = useState(-1);
    const [selectedCardInfo, setSelectedCardInfo] = useState<CardInfo | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [cardInfoVersion, setCardInfoVersion] = useState(0);

    const latestRequestedNameRef = useRef<string | null>(null);

    // Share initialization across mounts; failures reject callers and can be retried.
    useEffect(() => {
        activeRef.current = true;
        const unsubscribe = subscribeRuntime(({ stage, percent }) => {
            setModelDownloadProgress(stage === 'download' ? (percent ?? 0) : null);
            const translate = translationRef.current;
            setStatusText(stage === 'download'
                ? (percent === null ? translate('recognition.downloadingModel')
                    : translate('recognition.downloadingModelProgress', { progress: percent }))
                : translate(stage === 'cache' ? 'recognition.readingModelCache' : 'recognition.initializingEngine'));
        });
        void waitForInit().catch(console.error);
        return () => { activeRef.current = false; unsubscribe(); };
    }, [waitForInit]);

    // 重置状态
    const resetState = useCallback(() => {
        setRecognizedCards([]);
        setSelectedCardIndex(-1);
        setSelectedCardInfo(null);
        setProcessingStage('idle');
        setProgress(0);
        setProcessingVisual(null);
    }, []);

    // 获取卡片信息
    const fetchCardInfo = useCallback(async (name: string, id: number, updateUI: boolean = true) => {
        if (globalCardInfoCache[name]) {
            if (updateUI && name === latestRequestedNameRef.current) {
                setSelectedCardInfo(globalCardInfoCache[name]);
            }
            return globalCardInfoCache[name];
        }

        if (updateUI) setIsDetailLoading(true);

        try {
            const data = await apiFetchCardInfo(name, id);

            if (updateUI && name === latestRequestedNameRef.current) {
                setSelectedCardInfo(data);
            }
            return data;
        } catch (error) {
            console.error('获取卡片信息失败:', error);
            if (updateUI && name === latestRequestedNameRef.current) {
                setSelectedCardInfo(null);
            }
            return null;
        } finally {
            if (updateUI && name === latestRequestedNameRef.current) {
                setIsDetailLoading(false);
            }
        }
    }, []);

    // 处理图像管道
    const processImage = useCallback(async (img: HTMLImageElement) => {
        // 使用 ref 获取最新值，避免闭包陷阱
        const currentSession = sessionRef.current;
        const currentHashDatabase = hashDatabaseRef.current;
        const currentWasmDb = wasmDbRef.current;

        if (!currentSession || !currentHashDatabase || !currentWasmDb) return;

        try {
            setProcessingStage('detecting');
            setStatusText(t('recognition.detectingCards'));
            await new Promise(resolve => requestAnimationFrame(resolve));

            const { tensor, scale, padX, padY } = preprocessImage(img);
            const feeds = { images: tensor };
            const results = await currentSession.run(feeds);
            const output = results[Object.keys(results)[0]];
            const boxes = postprocessYOLO(output, scale, padX, padY, img.width, img.height);

            if (boxes.length === 0) {
                setStatusText(t('recognition.noCardsDetected'));
                setProcessingStage('done');
                return;
            }

            const sortedBoxes = sortBoxesByRow(boxes);
            const initialCards: RecognizedCard[] = sortedBoxes.map((box, i) => ({
                box,
                index: i,
                matches: [],
                selectedMatchIndex: 0,
                hashStandard: '',
                hashPendulum: ''
            }));
            setRecognizedCards(initialCards);

            setProcessingStage('identifying');
            setStatusText(t('recognition.identifyingCards'));

            const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
            ctx.canvas.width = img.width;
            ctx.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const finalResults: RecognizedCard[] = [...initialCards];
            const BATCH_SIZE = 10;

            const imageProcessor = new ImageProcessor(128);

            for (let i = 0; i < sortedBoxes.length; i++) {
                const box = sortedBoxes[i];
                // 多采样识别：在中心点及周围偏移点进行采样，取最佳匹配
                let bestMatchResult = { distance: Infinity, matches: [] as Match[], hashStandard: '', hashPendulum: '' };

                const startTime = performance.now();
                let sampleCount = 0;

                for (const offset of SAMPLE_OFFSETS) {
                    sampleCount++;
                    const sampleBox = {
                        ...box,
                        x1: box.x1 + offset.dx,
                        y1: box.y1 + offset.dy,
                        x2: box.x2 + offset.dx,
                        y2: box.y2 + offset.dy
                    };

                    // 使用优化的处理器直接获取处理后的数据
                    const dataStandard = imageProcessor.process(ctx, sampleBox, STANDARD_CARD);
                    const dataPendulum = imageProcessor.process(ctx, sampleBox, PENDULUM_CARD);

                    // ImageProcessor 固定输出 128x128
                    const hashStandard = get_phash_raw(dataStandard, 128, 128);
                    const hashPendulum = get_phash_raw(dataPendulum, 128, 128);

                    const matchesStandard = currentWasmDb.find_best_match(hashStandard, 'standard');
                    const matchesPendulum = currentWasmDb.find_best_match(hashPendulum, 'pendulum');
                    const allMatches = [...matchesStandard, ...matchesPendulum].sort(
                        (a: any, b: any) => a.distance - b.distance
                    );

                    const bestDist = allMatches[0]?.distance || Infinity;

                    // 如果找到更好的匹配（距离更小），更新最佳结果
                    if (bestDist < bestMatchResult.distance) {
                        bestMatchResult = {
                            distance: bestDist,
                            matches: allMatches.slice(0, 3).map((m: any) => ({
                                id: m.id,
                                name: m.name,
                                distance: m.distance,
                                cardType: m.cardType,
                                dbHash: m.dbHash
                            })),
                            hashStandard,
                            hashPendulum
                        };
                    }

                    // 性能优化：如果首个采样点（中心点）的匹配距离小于阈值，则直接采纳，跳过后续采样
                    // 这样对于清晰的图片，性能消耗与修改前基本一致
                    if (sampleCount === 1 && bestDist < EARLY_EXIT_DISTANCE) {
                        break;
                    }
                }

                // console.log(`[Card ${i}] Processed with ${sampleCount} samples, best distance: ${bestMatchResult.distance}. Time: ${(performance.now() - startTime).toFixed(1)}ms`);

                // 使用中心点的放大图作为预览
                const artworkUrl = imageProcessor.getProcessDataURL(ctx, box, STANDARD_CARD);

                const matches = bestMatchResult.matches;
                const hashStandard = bestMatchResult.hashStandard;
                const hashPendulum = bestMatchResult.hashPendulum;



                setProcessingVisual({
                    index: i + 1,
                    artworkUrl,
                    currentMatchName: matches[0]?.name || '...'
                });

                finalResults[i] = {
                    ...finalResults[i],
                    matches,
                    hashStandard,
                    hashPendulum
                };

                setProgress(Math.round(((i + 1) / sortedBoxes.length) * 100));

                if ((i + 1) % BATCH_SIZE === 0 || i === sortedBoxes.length - 1) {
                    setRecognizedCards([...finalResults]);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            setProcessingStage('done');
            setStatusText(t('recognition.recognitionDone'));
            setProcessingVisual(null);

            // 预加载卡片信息 — batch fetch (all matches including alternates)
            const uniqueEntries = new Map<string, { id: number; name: string }>();
            for (const c of finalResults) {
                for (const m of c.matches) {
                    if (m && !uniqueEntries.has(m.name)) {
                        uniqueEntries.set(m.name, { id: m.id, name: m.name });
                    }
                }
            }
            const { fetchCardInfoBatch } = await import('../utils/cardApi');
            await fetchCardInfoBatch(Array.from(uniqueEntries.values()));

            // 预加载首选匹配的卡图（不含备选）
            const seenIds = new Set<number>();
            for (const c of finalResults) {
                const m = c.matches[c.selectedMatchIndex];
                if (!m) continue;
                const info = globalCardInfoCache[m.name];
                if (info?.password && !seenIds.has(info.password)) {
                    seenIds.add(info.password);
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = getCardImageUrl(info.password, localeRef.current);
                }
            }

            // Bump version so consumers re-render with localized names
            setCardInfoVersion(v => v + 1);
        } catch (error: any) {
            console.error(error);
            setStatusText(t('recognition.processingError', { message: error.message }));
            setProcessingStage('done');
        }
    }, [fetchCardInfo]);

    // 选择卡片
    const selectCard = useCallback(async (index: number) => {
        if (index === -1) return;
        const card = recognizedCards[index];
        setSelectedCardIndex(index);

        if (card.matches.length > 0) {
            const currentMatch = card.matches[card.selectedMatchIndex];
            latestRequestedNameRef.current = currentMatch.name;
            await fetchCardInfo(currentMatch.name, currentMatch.id, true);
        }
    }, [recognizedCards, fetchCardInfo]);

    // 重新处理卡片
    // box 参数可选，如果传入则使用传入的 box，否则从 recognizedCards 读取
    // 这解决了状态更新时序问题：当调用者已经有新的 box 时，直接传入避免读取旧状态
    const reprocessCard = useCallback(async (index: number, forcePendulum: boolean = false, boxOverride?: Box) => {
        const currentWasmDb = wasmDbRef.current;
        if (!originalImage || !currentWasmDb) return;
        const card = recognizedCards[index];
        const box = boxOverride || card.box;

        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        ctx.canvas.width = originalImage.width;
        ctx.canvas.height = originalImage.height;
        ctx.drawImage(originalImage, 0, 0);

        // 多采样识别
        let bestMatchResult = { distance: Infinity, matches: [] as Match[], hashStandard: '', hashPendulum: '' };

        const imageProcessor = new ImageProcessor(128);
        const startTime = performance.now();
        let sampleCount = 0;

        for (const offset of SAMPLE_OFFSETS) {
            sampleCount++;
            const sampleBox = {
                ...box,
                x1: box.x1 + offset.dx,
                y1: box.y1 + offset.dy,
                x2: box.x2 + offset.dx,
                y2: box.y2 + offset.dy
            };

            const dataStandard = imageProcessor.process(ctx, sampleBox, STANDARD_CARD);
            const dataPendulum = imageProcessor.process(ctx, sampleBox, PENDULUM_CARD);

            const hashStandard = get_phash_raw(dataStandard, 128, 128);
            const hashPendulum = get_phash_raw(dataPendulum, 128, 128);

            const matchesStandard = currentWasmDb.find_best_match(hashStandard, 'standard');
            const matchesPendulum = currentWasmDb.find_best_match(hashPendulum, 'pendulum');
            const allMatches = [...matchesStandard, ...matchesPendulum].sort(
                (a: any, b: any) => a.distance - b.distance
            );

            const bestDist = allMatches[0]?.distance || Infinity;

            if (bestDist < bestMatchResult.distance) {
                bestMatchResult = {
                    distance: bestDist,
                    matches: allMatches.slice(0, 3).map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        distance: m.distance,
                        cardType: m.cardType,
                        dbHash: m.dbHash
                    })),
                    hashStandard,
                    hashPendulum
                };
            }

            // 性能优化：Early Exit
            if (sampleCount === 1 && bestDist < EARLY_EXIT_DISTANCE) {
                break;
            }
        }

        // console.log(`[Reprocess Card ${index}] Processed with ${sampleCount} samples, best distance: ${bestMatchResult.distance}. Time: ${(performance.now() - startTime).toFixed(1)}ms`);

        const matches = bestMatchResult.matches;
        const hashStandard = bestMatchResult.hashStandard;
        const hashPendulum = bestMatchResult.hashPendulum;

        setRecognizedCards(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                matches,
                selectedMatchIndex: 0,
                hashStandard,
                hashPendulum
            };
            return next;
        });

        if (matches.length > 0) {
            latestRequestedNameRef.current = matches[0].name;
            await fetchCardInfo(matches[0].name, matches[0].id, true);
        }
    }, [originalImage, recognizedCards, fetchCardInfo]);

    // 选择备选匹配
    const handleSelectAltMatch = useCallback((matchIndex: number) => {
        if (selectedCardIndex === -1) return;
        setRecognizedCards(prev => {
            const next = [...prev];
            next[selectedCardIndex].selectedMatchIndex = matchIndex;
            return next;
        });

        const card = recognizedCards[selectedCardIndex];
        const newMatch = card.matches[matchIndex];
        if (newMatch) {
            latestRequestedNameRef.current = newMatch.name;
            fetchCardInfo(newMatch.name, newMatch.id, true);
        }
    }, [selectedCardIndex, recognizedCards, fetchCardInfo]);

    // 更新卡片框位置
    const updateCardBox = useCallback((index: number, box: Box) => {
        setRecognizedCards(prev => {
            const next = [...prev];
            next[index] = { ...next[index], box };
            return next;
        });
    }, []);

    return {
        isInitializing,
        statusText,
        processingStage,
        progress,
        processingVisual,
        recognizedCards,
        selectedCardIndex,
        selectedCardInfo,
        isDetailLoading,
        originalImage,
        modelDownloadProgress,
        session,
        wasmDb,
        processImage,
        selectCard,
        reprocessCard,
        handleSelectAltMatch,
        updateCardBox,
        setOriginalImage,
        setSelectedCardIndex,
        setRecognizedCards,
        setSelectedCardInfo,
        setProcessingStage,
        resetState,
        waitForInit,
        cardInfoVersion
    };
}
