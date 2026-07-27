import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/app/i18n';
import * as ort from 'onnxruntime-web';
import init, { Database, get_phash_raw } from 'core-wasm';
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
import { modelPath, getCardImageUrl } from '../config';
import { globalCardInfoCache, fetchCardInfo as apiFetchCardInfo, fetchCardInfoByPasswords } from '../utils/cardApi';

export { globalCardInfoCache };

const MODEL_PATH = modelPath;
const HASH_DB_PATH = '/card_data';

enum CARD_TYPE {
    STANDARD = 0,
    PENDULUM = 1
};

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

// 初始化 Promise 的 resolve 函数引用
let initResolve: (() => void) | null = null;
const initPromise = new Promise<void>((resolve) => {
    initResolve = resolve;
});

export function useRecognition(): UseRecognitionReturn {
    const { t, locale } = useTranslation();
    // 会话状态
    const [session, setSession] = useState<ort.InferenceSession | null>(null);
    const [hashDatabase, setHashDatabase] = useState<Uint8Array | null>(null);
    const [wasmDb, setWasmDb] = useState<Database | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [statusText, setStatusText] = useState('');
    const [modelDownloadProgress, setModelDownloadProgress] = useState<number | null>(null);

    // 使用 ref 存储最新值，解决闭包陷阱问题
    // 在初始化完成时直接更新 ref（同步），确保 processImage 能立即访问到最新值
    const sessionRef = useRef<ort.InferenceSession | null>(null);
    const hashDatabaseRef = useRef<Uint8Array | null>(null);
    const wasmDbRef = useRef<Database | null>(null);
    const localeRef = useRef(locale);
    localeRef.current = locale;

    // 等待初始化完成的方法
    const waitForInit = useCallback(() => initPromise, []);

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

    // 初始化
    useEffect(() => {
        async function initialize() {
            try {
                // 判断是否为国内用户，选择合适的 CDN
                const isChinaUser = () => {
                    // 1. 检查浏览器语言
                    const lang = navigator.language || (navigator as any).userLanguage || '';
                    if (lang.toLowerCase().startsWith('zh')) return true;

                    // 2. 检查时区 (UTC+8)
                    const offset = new Date().getTimezoneOffset();
                    if (offset === -480) return true; // UTC+8

                    return false;
                };

                // 国内用户使用 npmmirror，国外用户使用 jsdelivr (全球 CDN)
                const wasmCdnPath = isChinaUser()
                    ? 'https://registry.npmmirror.com/onnxruntime-web/1.23.2/files/dist/'
                    : 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

                // 提前设置 ONNX Runtime WASM 路径
                ort.env.wasm.wasmPaths = wasmCdnPath;
                ort.env.wasm.numThreads = 1;

                // 5秒后开始显示下载进度
                let showProgressTimer: ReturnType<typeof setTimeout> | null = null;
                let shouldShowProgress = false;

                showProgressTimer = setTimeout(() => {
                    shouldShowProgress = true;
                    setModelDownloadProgress(0);
                    setStatusText(t('recognition.downloadingModel'));
                }, 5000);

                // 并行下载所有资源：
                // 1. core-wasm 初始化
                // 2. ONNX 模型文件下载
                // 3. 卡片哈希数据库下载
                // 4. 预热 ONNX Runtime (触发 WASM 文件下载)

                // 预热 ONNX Runtime - 创建一个最小 session 来触发 WASM 下载
                // ONNX Runtime 会自动选择合适的 WASM 文件
                const wasmWarmupPromise = (async () => {
                    try {
                        // 创建一个最小的有效 ONNX 模型来触发 WASM 加载
                        // 这是一个只有一个 Identity 节点的最小模型
                        const minimalModel = new Uint8Array([
                            0x08, 0x08, 0x12, 0x0c, 0x6f, 0x6e, 0x6e, 0x78, 0x2d, 0x77, 0x61, 0x72,
                            0x6d, 0x75, 0x70, 0x00, 0x1a, 0x23, 0x0a, 0x01, 0x78, 0x12, 0x01, 0x79,
                            0x1a, 0x0b, 0x0a, 0x01, 0x78, 0x12, 0x01, 0x79, 0x22, 0x03, 0x41, 0x64,
                            0x64, 0x22, 0x0e, 0x0a, 0x01, 0x78, 0x10, 0x01, 0x1a, 0x07, 0x0a, 0x01,
                            0x31, 0x12, 0x02, 0x08, 0x01, 0x22, 0x0e, 0x0a, 0x01, 0x79, 0x10, 0x01,
                            0x1a, 0x07, 0x0a, 0x01, 0x31, 0x12, 0x02, 0x08, 0x01
                        ]);
                        await ort.InferenceSession.create(minimalModel.buffer, {
                            executionProviders: ['wasm']
                        });
                    } catch {
                        // 模型可能无效，但 WASM 文件应该已经开始下载了
                    }
                })();

                // 下载模型文件（带进度）
                // 注意：layout.tsx 中已配置 <link rel="preload" crossOrigin="anonymous"> 来提前开始下载
                // 这里的 fetch 必须使用相同的 credentials 模式才能复用 preload 的请求/缓存
                const modelDownloadPromise = (async () => {
                    const response = await fetch(MODEL_PATH, {
                        // 与 preload 的 crossOrigin="anonymous" 匹配
                        // credentials: 'omit',
                        mode: 'cors'
                    });
                    if (!response.ok) throw new Error(`模型加载失败: ${response.statusText}`);

                    const contentLength = response.headers.get('content-length');
                    const total = contentLength ? parseInt(contentLength, 10) : 0;

                    if (!response.body || !total) {
                        return await response.arrayBuffer();
                    }

                    const reader = response.body.getReader();
                    const chunks: Uint8Array[] = [];
                    let received = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        received += value.length;

                        if (shouldShowProgress) {
                            const progressPercent = Math.round((received / total) * 100);
                            setModelDownloadProgress(progressPercent);
                            setStatusText(t('recognition.downloadingModelProgress', { progress: progressPercent }));
                        }
                    }

                    // 合并所有 chunks
                    const buffer = new Uint8Array(received);
                    let position = 0;
                    for (const chunk of chunks) {
                        buffer.set(chunk, position);
                        position += chunk.length;
                    }

                    return buffer.buffer;
                })();

                // 下载哈希数据库
                const hashDbPromise = fetch(HASH_DB_PATH).then(r => {
                    if (!r.ok) throw new Error(`数据库加载失败: ${r.statusText}`);
                    return r.arrayBuffer();
                });

                // 初始化 core-wasm
                const wasmInitPromise = init();

                // 并行等待所有下载完成
                const [, modelBuffer, dbResult] = await Promise.all([
                    wasmInitPromise,
                    modelDownloadPromise,
                    hashDbPromise,
                    wasmWarmupPromise // 不需要结果，只是确保 WASM 开始下载
                ]);
                const dbUint8Result = new Uint8Array(dbResult);

                // 创建 ONNX Session（此时 WASM 应该已经缓存了）
                const sessionResult = await ort.InferenceSession.create(modelBuffer, {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                });

                // 清除定时器
                if (showProgressTimer) {
                    clearTimeout(showProgressTimer);
                }

                const db = new Database();
                db.load_database_from_buffer(dbUint8Result);

                // 先更新 ref（同步），确保 processImage 能立即访问到最新值
                sessionRef.current = sessionResult;
                hashDatabaseRef.current = dbUint8Result;
                wasmDbRef.current = db;

                // 再更新 state（异步）
                setSession(sessionResult);
                setHashDatabase(dbUint8Result);
                setWasmDb(db);
                setIsInitializing(false);
                setModelDownloadProgress(null);
                setStatusText(t('recognition.ready'));

                // 通知等待初始化的代码
                if (initResolve) {
                    initResolve();
                }
            } catch (error: any) {
                setStatusText(t('recognition.initFailed', { message: error.message }));
                setModelDownloadProgress(null);
                console.error(error);
            }
        }
        initialize();
    }, []);

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

    const fetchCardInfoByPassword = useCallback(async (name: string, password: number, updateUI: boolean = true) => {
        if (globalCardInfoCache[name]) {
            if (updateUI && name === latestRequestedNameRef.current) {
                setSelectedCardInfo(globalCardInfoCache[name]);
            }
            return globalCardInfoCache[name];
        }

        if (updateUI) setIsDetailLoading(true);

        try {
            const passwordInfoMap = await fetchCardInfoByPasswords([password.toString()]);
            const info = passwordInfoMap.get(password.toString());
            if (!info) return null;

            const cardInfo: CardInfo = {
                ...info.cardInfo,
                name: { ...info.cardInfo.name, zh: name },
            };
            globalCardInfoCache[name] = cardInfo;

            if (updateUI && name === latestRequestedNameRef.current) {
                setSelectedCardInfo(cardInfo);
            }
            return cardInfo;
        } catch (error) {
            console.error(error);
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

                    const matchesStandard = currentWasmDb.find_best_match(hashStandard, CARD_TYPE.STANDARD);
                    const matchesPendulum = currentWasmDb.find_best_match(hashPendulum, CARD_TYPE.PENDULUM);
                    const allMatches = [...matchesStandard, ...matchesPendulum].sort(
                        (a: any, b: any) => a.distance - b.distance
                    );

                    const bestDist = allMatches[0]?.distance || Infinity;

                    // 如果找到更好的匹配（距离更小），更新最佳结果
                    if (bestDist < bestMatchResult.distance) {
                        bestMatchResult = {
                            distance: bestDist,
                            matches: allMatches.slice(0, 3).map((m: any) => ({
                                password: m.id,
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
            const uniquePasswords = new Set<string>();
            for (const c of finalResults) {
                for (const m of c.matches) {
                    const password = m.password ?? m.id;
                    if (password) uniquePasswords.add(String(password));
                }
            }
            const passwordInfoMap = await fetchCardInfoByPasswords(Array.from(uniquePasswords));
            for (const c of finalResults) {
                for (const m of c.matches) {
                    const password = m.password ?? m.id;
                    const info = password ? passwordInfoMap.get(String(password)) : undefined;
                    if (!info) continue;
                    globalCardInfoCache[m.name] = {
                        ...info.cardInfo,
                        name: { ...info.cardInfo.name, zh: m.name },
                    };
                    m.id = info.konamiId;
                }
            }
            setRecognizedCards([...finalResults]);

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
            if (currentMatch.id)
                await fetchCardInfo(currentMatch.name, currentMatch.id, true);
            else if (currentMatch.password)
                await fetchCardInfoByPassword(currentMatch.name, currentMatch.password, true);
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

            const matchesStandard = currentWasmDb.find_best_match(hashStandard, CARD_TYPE.STANDARD);
            const matchesPendulum = currentWasmDb.find_best_match(hashPendulum, CARD_TYPE.PENDULUM);
            const allMatches = [...matchesStandard, ...matchesPendulum].sort(
                (a: any, b: any) => a.distance - b.distance
            );

            const bestDist = allMatches[0]?.distance || Infinity;

            if (bestDist < bestMatchResult.distance) {
                bestMatchResult = {
                    distance: bestDist,
                    matches: allMatches.slice(0, 3).map((m: any) => ({
                        password: m.id,
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

        let matches = bestMatchResult.matches;
        const hashStandard = bestMatchResult.hashStandard;
        const hashPendulum = bestMatchResult.hashPendulum;

        if (matches.length > 0) {
            const passwords = matches
                .map(m => m.password ?? m.id)
                .filter((password): password is number => Boolean(password))
                .map(String);
            const passwordInfoMap = await fetchCardInfoByPasswords(passwords);
            matches = matches.map(m => {
                const password = m.password ?? m.id;
                const info = password ? passwordInfoMap.get(String(password)) : undefined;
                if (!info) return m;
                globalCardInfoCache[m.name] = {
                    ...info.cardInfo,
                    name: { ...info.cardInfo.name, zh: m.name },
                };
                return { ...m, id: info.konamiId };
            });
        }

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
            if (matches[0].id)
                await fetchCardInfo(matches[0].name, matches[0].id, true);
            else if (matches[0].password)
                await fetchCardInfoByPassword(matches[0].name, matches[0].password, true);
        }
    }, [originalImage, recognizedCards, fetchCardInfo, fetchCardInfoByPassword]);

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
            if (newMatch.id)
                fetchCardInfo(newMatch.name, newMatch.id, true);
            else if (newMatch.password)
                fetchCardInfoByPassword(newMatch.name, newMatch.password, true);
        }
    }, [selectedCardIndex, recognizedCards, fetchCardInfo, fetchCardInfoByPassword]);

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
