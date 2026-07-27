"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as bincode from 'bincode-ts';
import { useRecognition } from '../hooks/useRecognition';
import { usePreventSwipeBack } from '../hooks/usePreventSwipeBack';
import { globalCardInfoCache, fetchCardInfoBatch, fetchCardInfoByPasswords, isExtraDeck } from '../utils/cardApi';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { useMobile } from '../hooks/useMobile';
import { extractArtwork, STANDARD_CARD, PENDULUM_CARD } from '../utils/recognition';
import { saveHistory, saveYdkHistory, updateHistory, getHistoryCount, DeckHistory } from '../utils/historyDb';
import { apiUrl } from '../config';
import { RecognizedCard } from '../types';
import { SearchResult } from './ui/CardSearchPanel';
import Header from './ui/Header';
import UploadArea from './ui/UploadArea';
import CardCanvas from './ui/CardCanvas';
import Sidebar from './ui/Sidebar';
import Magnifier from './ui/Magnifier';
import CropperModal from './ui/CropperModal';
import FloatingToolbar from './ui/FloatingToolbar';
import MobileCardDrawer from './ui/MobileCardDrawer';
import HistoryDrawer from './ui/HistoryDrawer';
import ShareModal from './ui/ShareModal';
import YdkCanvas from './ui/YdkCanvas';
import WelcomeModal from './ui/WelcomeModal';
import { useTranslation } from '@/app/i18n';

const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

// 解析 YDK 文本
const parseYdk = (text: string): { main: string[]; extra: string[] } => {
    const lines = text.split('\n').map(l => l.trim());
    const main: string[] = [];
    const extra: string[] = [];
    let section: 'main' | 'extra' | 'side' | null = null;

    for (const line of lines) {
        if (line === '#main') { section = 'main'; continue; }
        if (line === '#extra') { section = 'extra'; continue; }
        if (line === '!side') { section = 'side'; continue; }
        if (section === 'side') continue; // 忽略 side deck
        if (/^\d+$/.test(line)) {
            if (section === 'extra') extra.push(line);
            else if (section === 'main') main.push(line);
        }
    }
    return { main, extra };
};

// 检测文本是否为 YDK 格式
const isYdkText = (text: string): boolean => {
    return text.includes('#main') || text.includes('#extra');
};

// 检查图片是否需要裁剪
const shouldAutoCrop = (img: HTMLImageElement, isMobile: boolean): boolean => {
    const aspectRatio = img.width / img.height;
    // 移动端：始终需要裁剪
    // 电脑端：宽高比超过1.16时需要裁剪
    if (isMobile) {
        return true;
    }
    return aspectRatio > 1.16;
};

export default function DeckRecognizer() {
    const { t } = useTranslation();
    const isMobile = useMobile();
    usePreventSwipeBack();
    const recognition = useRecognition();
    const {
        isInitializing,
        processingStage,
        recognizedCards,
        selectedCardIndex,
        selectedCardInfo,
        isDetailLoading,
        originalImage,
        modelDownloadProgress,
        processImage,
        selectCard,
        reprocessCard,
        handleSelectAltMatch,
        updateCardBox,
        setOriginalImage,
        setSelectedCardIndex,
        setSelectedCardInfo,
        setProcessingStage,
        resetState,
        waitForInit,
        cardInfoVersion
    } = recognition;

    // New reference when cardInfoVersion bumps, so Sidebar/MobileCardDrawer re-render with localized names
    const recognizedCardsWithInfo = useMemo(() => [...recognizedCards], [recognizedCards, cardInfoVersion]);

    const [showCropper, setShowCropper] = useState(false);
    const [forcePendulumMode, setForcePendulumMode] = useState(false);
    const [selectedCardArtwork, setSelectedCardArtwork] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 移动端抽屉状态
    const [showMobileDrawer, setShowMobileDrawer] = useState(false);
    const [mobileDrawerViewMode, setMobileDrawerViewMode] = useState<'list' | 'detail'>('list');
    const [mobileDrawerEntryPoint, setMobileDrawerEntryPoint] = useState<'canvas' | 'list'>('list');

    // 卡片列表滚动位置（提升到父组件以防止子组件卸载时丢失）
    const [sidebarScrollPosition, setSidebarScrollPosition] = useState(0);
    const [mobileDrawerScrollPosition, setMobileDrawerScrollPosition] = useState(0);

    // 卡组码相关状态
    const [isGeneratingDeckCode, setIsGeneratingDeckCode] = useState(false);
    const [isExportingYdk, setIsExportingYdk] = useState(false);
    const [ydkExported, setYdkExported] = useState(false);
    const [deckCodeModal, setDeckCodeModal] = useState<{ show: boolean; code?: string; error?: string; warning?: string }>({ show: false });
    const [deckCodeCopied, setDeckCodeCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showLowCountWarning, setShowLowCountWarning] = useState(false);

    // 画布缩放状态
    const [isCanvasZoomed, setIsCanvasZoomed] = useState(false);

    // 数据来源类型
    const [sourceType, setSourceType] = useState<'image' | 'ydk'>('image');

    // 历史记录相关状态
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [historyCount, setHistoryCount] = useState(0);
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

    // 识别数量较少时的提示 (仅移动端)
    useEffect(() => {
        if (isMobile && processingStage === 'done' && sourceType === 'image' && recognizedCards.length < 20) {
            setShowLowCountWarning(true);
        }
    }, [isMobile, processingStage, sourceType, recognizedCards.length]);

    // Artwork 缓存（避免重复绘制 canvas）
    const artworkCacheRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        const cache = artworkCacheRef.current;
        return () => { cache.clear(); };
    }, []);

    // 使用 ref 存储 processImage 的最新引用，解决闭包陷阱
    const processImageRef = useRef(processImage);
    useEffect(() => { processImageRef.current = processImage; }, [processImage]);

    // 获取卡片 artwork 的函数（带缓存）
    const getCardArtwork = useCallback((index: number): string | null => {
        if (index === selectedCardIndex) {
            return selectedCardArtwork;
        }
        if (!originalImage || index < 0 || index >= recognizedCards.length) {
            return null;
        }

        const card = recognizedCards[index];
        if (card.box.x1 === 0 && card.box.y1 === 0 && card.box.x2 === 0 && card.box.y2 === 0) return null;
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulum = currentMatch?.cardType === 'pendulum';

        // 生成缓存 key
        const cacheKey = `${index}-${card.box.x1}-${card.box.y1}-${card.box.x2}-${card.box.y2}-${isPendulum}`;

        // 检查缓存
        if (artworkCacheRef.current.has(cacheKey)) {
            return artworkCacheRef.current.get(cacheKey)!;
        }

        // 生成 artwork
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        const cropConfig = isPendulum ? PENDULUM_CARD : STANDARD_CARD;
        const artworkData = extractArtwork(ctx, card.box, cropConfig);

        const artworkCanvas = document.createElement('canvas');
        artworkCanvas.width = artworkData.width;
        artworkCanvas.height = artworkData.height;
        artworkCanvas.getContext('2d')!.putImageData(artworkData, 0, 0);
        const dataUrl = artworkCanvas.toDataURL();

        // 存入缓存
        artworkCacheRef.current.set(cacheKey, dataUrl);

        return dataUrl;
    }, [originalImage, recognizedCards, selectedCardIndex, selectedCardArtwork]);

    const canvasInteraction = useCanvasInteraction({
        originalImage,
        recognizedCards,
        selectedCardIndex,
        forcePendulumMode,
        isZoomed: isCanvasZoomed,
        onSelectCard: (index) => {
            if (index === -1) {
                setSelectedCardIndex(-1);
                if (isMobile) {
                    setShowMobileDrawer(false);
                }
            } else {
                handleCardSelectFromCanvas(index);
            }
        },
        onUpdateCardBox: updateCardBox,
        onReprocessCard: (index) => reprocessCard(index, forcePendulumMode)
    });

    const {
        dragState,
        magnifier,
        canvasRef,
        containerRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave
    } = canvasInteraction;

    const handleFile = useCallback(async (file: File) => {
        artworkCacheRef.current.clear();
        resetState();
        setSourceType('image');
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setShowMobileDrawer(false);
        setShowLowCountWarning(false);
        setMobileDrawerViewMode('list');
        setMobileDrawerEntryPoint('list');
        setCurrentHistoryId(null);
        setDeckCodeModal({ show: false }); // 重置卡组码状态，避免新图片使用旧卡组码

        // 清除 URL 中的 hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }

        try {
            const img = await loadImage(file);
            setUploadedImage(img);

            // 先等待模型初始化完成
            await waitForInit();

            // 模型就绪后，检查是否需要自动裁剪
            if (shouldAutoCrop(img, isMobile)) {
                setShowCropper(true);
            } else {
                setOriginalImage(img);
                // 使用 ref 获取最新的 processImage，避免闭包陷阱
                processImageRef.current(img);
            }
        } catch (error: any) {
            console.error('图片加载失败:', error);
        }
    }, [resetState, setOriginalImage, isMobile, waitForInit]);

    // 加载 card_data.json 用于 YDK 导入
    const cardDataRef = useRef<{ id: number; name: string }[] | null>(null);
    const loadCardData = useCallback(async () => {
        if (cardDataRef.current) return cardDataRef.current;
        const res = await fetch('/card_data');
        const data = bincode.decode(bincode.Collection(bincode.Struct({
            id : bincode.u32,
            name : bincode.String,
            phash: bincode.String,
            card_type: bincode.u8
        })), await res.arrayBuffer()).value;
        cardDataRef.current = data;
        return data;
    }, []);

    // 处理 YDK 导入
    const handleYdkImport = useCallback(async (ydkText: string) => {
        resetState();
        setSourceType('ydk');
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setCurrentHistoryId(null);
        setUploadedImage(null);
        setProcessingStage('identifying');

        try {
            const { main, extra } = parseYdk(ydkText);
            const allPasswords = [...main, ...extra];
            if (allPasswords.length === 0) {
                setProcessingStage('idle');
                return;
            }

            // Batch fetch by passwords
            const resultMap = await fetchCardInfoByPasswords(allPasswords);

            // Also load card_data.json to get proper zh names
            const cardData = await loadCardData();
            const cardDataByPassword = new Map<number, { id: number; name: string }>();

            // Build a lookup: for each result, find the card_data entry by konamiId
            for (const [pw, info] of resultMap) {
                const cdEntry = cardData.find((c: { id: number; name: string }) => c.id === info.konamiId);
                if (cdEntry) {
                    // Override zh name with card_data.json name
                    info.name = cdEntry.name;
                    info.cardInfo.name.zh = cdEntry.name;
                    globalCardInfoCache[cdEntry.name] = info.cardInfo;
                    cardDataByPassword.set(Number(pw), cdEntry);
                } else {
                    globalCardInfoCache[info.name] = info.cardInfo;
                }
            }

            const buildCard = (pw: string, idx: number): RecognizedCard | null => {
                const info = resultMap.get(pw);
                if (!info) return null;
                const cdEntry = cardDataByPassword.get(Number(pw));
                return {
                    box: { x1: 0, y1: 0, x2: 0, y2: 0, conf: 1 },
                    index: idx,
                    matches: [{
                        id: cdEntry?.id || info.konamiId,
                        name: cdEntry?.name || info.name,
                        distance: 0,
                        cardType: 'standard',
                        dbHash: ''
                    }],
                    selectedMatchIndex: 0,
                    hashStandard: '',
                    hashPendulum: ''
                };
            };

            let idx = 0;
            const cards: RecognizedCard[] = [];
            for (const pw of allPasswords) {
                const card = buildCard(pw, idx);
                if (card) {
                    cards.push(card);
                    idx++;
                }
            }

            recognition.setRecognizedCards(cards);
            setProcessingStage('done');

            // 保存历史记录
            if (cards.length > 0) {
                saveYdkHistory(ydkText, cards)
                    .then((history) => {
                        setCurrentHistoryId(history.id);
                        setHistoryCount((prev) => prev + 1);
                    })
                    .catch(console.error);
            }

            // 移动端自动打开抽屉
            if (isMobile && cards.length > 0) {
                setShowMobileDrawer(true);
                setMobileDrawerViewMode('list');
                setMobileDrawerEntryPoint('list');
            }
        } catch (error) {
            console.error('YDK 导入失败:', error);
            setProcessingStage('idle');
        }
    }, [resetState, setProcessingStage, loadCardData, recognition, isMobile]);

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // 先检查文本是否为 YDK
            const text = e.clipboardData?.getData('text/plain');
            console.log('Paste detected, text:', text?.substring(0, 50), 'isYdk:', text ? isYdkText(text) : false);
            if (text && isYdkText(text)) {
                e.preventDefault();
                handleYdkImport(text);
                return;
            }

            // 否则检查图片
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        setSourceType('image');
                        handleFile(file);
                    }
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleFile, handleYdkImport]);

    // 加载历史记录数量
    useEffect(() => {
        getHistoryCount().then(setHistoryCount).catch(console.error);
    }, []);

    // 识别完成后自动保存历史
    useEffect(() => {
        if (processingStage === 'done' && originalImage && recognizedCards.length > 0 && !currentHistoryId) {
            saveHistory(originalImage, recognizedCards)
                .then((history) => {
                    setCurrentHistoryId(history.id);
                    setHistoryCount((prev) => prev + 1);
                })
                .catch(console.error);
        }
    }, [processingStage, originalImage, recognizedCards, currentHistoryId]);

    // 加载历史记录
    const handleLoadHistory = useCallback((image: HTMLImageElement | null, history: DeckHistory) => {
        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setShowMobileDrawer(false);
        setMobileDrawerViewMode('list');
        setMobileDrawerEntryPoint('list');
        setCurrentHistoryId(history.id);

        if (history.sourceType === 'ydk') {
            // YDK 模式
            setSourceType('ydk');
            setUploadedImage(null);
            setOriginalImage(null);
        } else {
            // 图片模式
            setSourceType('image');
            setUploadedImage(image);
            setOriginalImage(image);
        }

        // 恢复识别结果
        recognition.setRecognizedCards(history.recognizedCards);

        // 加载缺失的卡片信息到缓存
        const missingEntries: { id: number; name: string }[] = [];
        const passwordEntries: { password: string; name: string }[] = [];
        for (const c of history.recognizedCards) {
            const m = c.matches[c.selectedMatchIndex];
            if (m && !globalCardInfoCache[m.name]) {
                m.id ? missingEntries.push({ id: m.id, name: m.name })
                    : passwordEntries.push({ password: m.password!.toString(), name: m.name });
            }
        }
        if (missingEntries.length + passwordEntries.length)
            Promise.all([
                missingEntries.length > 0 ? fetchCardInfoBatch(missingEntries) : Promise.resolve(),
                passwordEntries.length > 0 ? fetchCardInfoByPasswords(passwordEntries.map((e) => e.password)) : Promise.resolve(new Map()),
            ]).then(([, passwordInfoMap]) => {
                passwordEntries.forEach(({ password, name }) => {
                    const info = passwordInfoMap.get(password);
                    if (info) {
                        globalCardInfoCache[name] = {
                            ...info.cardInfo,
                            name: { ...info.cardInfo.name, zh: name },
                        };
                    }
                });
                recognition.setRecognizedCards([...history.recognizedCards]);
            });

        // 设置处理阶段为完成
        setProcessingStage('done');

        // 如果有卡组码，保存到状态
        if (history.deckCode) {
            setDeckCodeModal({ show: false, code: history.deckCode });
        }
    }, [resetState, setOriginalImage, recognition, setProcessingStage]);

    // 全局拖拽支持
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer?.types.includes('Files')) {
                setIsDragOver(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            if (e.relatedTarget === null) {
                setIsDragOver(false);
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFile(file);
            }
        };

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, [handleFile]);

    const updateArtworkPreview = useCallback((index: number, isPendulum: boolean) => {
        if (!originalImage || index === -1) return;
        const card = recognizedCards[index];
        if (!card) return;
        // Skip artwork for edited/added cards with no canvas position
        if (card.box.x1 === 0 && card.box.y1 === 0 && card.box.x2 === 0 && card.box.y2 === 0) {
            setSelectedCardArtwork(null);
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        const cropConfig = isPendulum ? PENDULUM_CARD : STANDARD_CARD;
        const artworkData = extractArtwork(ctx, card.box, cropConfig);

        const artworkCanvas = document.createElement('canvas');
        artworkCanvas.width = artworkData.width;
        artworkCanvas.height = artworkData.height;
        artworkCanvas.getContext('2d')!.putImageData(artworkData, 0, 0);
        setSelectedCardArtwork(artworkCanvas.toDataURL());
    }, [originalImage, recognizedCards]);

    const handleCardSelect = useCallback(async (index: number, _fromList?: boolean) => {
        if (index === -1) {
            setSelectedCardIndex(-1);
            return;
        }
        const card = recognizedCards[index];
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulumMatch = currentMatch?.cardType === 'pendulum';

        setForcePendulumMode(isPendulumMatch);
        updateArtworkPreview(index, isPendulumMatch);
        selectCard(index);

        // 移动端：如果是从列表选择，不需要在这里打开抽屉（由drawer内部处理视图切换）
        // 如果不是从列表选择，不做额外操作
    }, [recognizedCards, selectCard, updateArtworkPreview]);

    // 从画布点击卡片时调用
    const handleCardSelectFromCanvas = useCallback(async (index: number) => {
        if (index === -1) return;
        const card = recognizedCards[index];
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulumMatch = currentMatch?.cardType === 'pendulum';

        setForcePendulumMode(isPendulumMatch);
        updateArtworkPreview(index, isPendulumMatch);
        selectCard(index);

        // 移动端：从画布点击
        if (isMobile) {
            // 如果抽屉已经打开且是从画布进入的，不需要重新设置状态，只需更新选中的卡片
            // 新状态会自动通过 selectedCardIndex 传递给 MobileCardDrawer
            if (!showMobileDrawer) {
                setMobileDrawerViewMode('detail');
                setMobileDrawerEntryPoint('canvas');
                setShowMobileDrawer(true);
            }
            // 如果抽屉已打开，selectedCardIndex 的变化会让 MobileCardCarousel 自动切换到对应卡片
        }
    }, [recognizedCards, selectCard, updateArtworkPreview, isMobile, showMobileDrawer]);

    // PC端方向键切换卡片
    useEffect(() => {
        if (isMobile) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 只在有选中卡片且有识别结果时处理
            if (selectedCardIndex === -1 || recognizedCards.length === 0) return;

            // 检查是否是方向键
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            e.preventDefault();

            const currentCard = recognizedCards[selectedCardIndex];
            if (currentCard.box.x1 === 0 && currentCard.box.y1 === 0 && currentCard.box.x2 === 0 && currentCard.box.y2 === 0) return;
            const currentCenterX = (currentCard.box.x1 + currentCard.box.x2) / 2;
            const currentCenterY = (currentCard.box.y1 + currentCard.box.y2) / 2;
            const cardHeight = currentCard.box.y2 - currentCard.box.y1;

            let bestIndex = -1;
            let bestScore = Infinity;

            // 用于左右换行：先找最近的行，再在该行中找目标
            let nextRowY = Infinity;  // 下一行的 Y 坐标
            let prevRowY = -Infinity; // 上一行的 Y 坐标

            const isZeroBox = (b: typeof currentCard.box) => b.x1 === 0 && b.y1 === 0 && b.x2 === 0 && b.y2 === 0;

            // 第一遍：找到最近的下一行和上一行的 Y 坐标
            recognizedCards.forEach((card, index) => {
                if (index === selectedCardIndex || isZeroBox(card.box)) return;
                const centerY = (card.box.y1 + card.box.y2) / 2;
                const dy = centerY - currentCenterY;

                // 下一行：Y 坐标比当前大，但要找最近的
                if (dy > cardHeight * 0.5 && centerY < nextRowY) {
                    nextRowY = centerY;
                }
                // 上一行：Y 坐标比当前小，但要找最近的
                if (dy < -cardHeight * 0.5 && centerY > prevRowY) {
                    prevRowY = centerY;
                }
            });

            recognizedCards.forEach((card, index) => {
                if (index === selectedCardIndex || isZeroBox(card.box)) return;

                const centerX = (card.box.x1 + card.box.x2) / 2;
                const centerY = (card.box.y1 + card.box.y2) / 2;
                const dx = centerX - currentCenterX;
                const dy = centerY - currentCenterY;

                let isValidDirection = false;
                let score = Infinity;

                switch (e.key) {
                    case 'ArrowUp':
                        // 向上：目标卡片中心在当前卡片上方
                        if (dy < -10) {
                            isValidDirection = true;
                            // 优先选择正上方的，横向偏移作为惩罚
                            score = Math.abs(dy) + Math.abs(dx) * 2;
                        }
                        break;
                    case 'ArrowDown':
                        // 向下：目标卡片中心在当前卡片下方
                        if (dy > 10) {
                            isValidDirection = true;
                            score = Math.abs(dy) + Math.abs(dx) * 2;
                        }
                        break;
                    case 'ArrowLeft':
                        // 向左：目标卡片中心在当前卡片左侧（同行）
                        if (dx < -10 && Math.abs(dy) < cardHeight * 0.5) {
                            isValidDirection = true;
                            score = Math.abs(dx) + Math.abs(dy) * 2;
                        }
                        // 换行备选：上一行最右边的卡片
                        else if (prevRowY > -Infinity && Math.abs(centerY - prevRowY) < cardHeight * 0.5) {
                            // 在上一行中，选择最右边的
                            isValidDirection = true;
                            score = 100000 - centerX; // 大基数确保换行优先级低于同行，centerX 越大分数越小
                        }
                        break;
                    case 'ArrowRight':
                        // 向右：目标卡片中心在当前卡片右侧（同行）
                        if (dx > 10 && Math.abs(dy) < cardHeight * 0.5) {
                            isValidDirection = true;
                            score = Math.abs(dx) + Math.abs(dy) * 2;
                        }
                        // 换行备选：下一行最左边的卡片
                        else if (nextRowY < Infinity && Math.abs(centerY - nextRowY) < cardHeight * 0.5) {
                            // 在下一行中，选择最左边的
                            isValidDirection = true;
                            score = 100000 + centerX; // 大基数确保换行优先级低于同行，centerX 越小分数越小
                        }
                        break;
                }

                if (isValidDirection && score < bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            });

            if (bestIndex !== -1) {
                handleCardSelect(bestIndex);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMobile, selectedCardIndex, recognizedCards, handleCardSelect]);

    const toggleCardMode = useCallback(() => {
        if (selectedCardIndex === -1) return;
        const newMode = !forcePendulumMode;
        setForcePendulumMode(newMode);
        updateArtworkPreview(selectedCardIndex, newMode);
    }, [selectedCardIndex, forcePendulumMode, updateArtworkPreview]);

    const handleAltMatchSelect = useCallback((matchIndex: number) => {
        if (selectedCardIndex === -1) return;
        const card = recognizedCards[selectedCardIndex];
        const newMatch = card.matches[matchIndex];
        const isPendulum = newMatch.cardType === 'pendulum';
        setForcePendulumMode(isPendulum);
        updateArtworkPreview(selectedCardIndex, isPendulum);
        handleSelectAltMatch(matchIndex);
    }, [selectedCardIndex, recognizedCards, handleSelectAltMatch, updateArtworkPreview]);

    const handleMoveCardBox = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        if (selectedCardIndex === -1 || !recognizedCards[selectedCardIndex]) return;

        const card = recognizedCards[selectedCardIndex];
        const { box } = card;
        const step = 1;

        const newBox = { ...box };
        switch (direction) {
            case 'up':
                newBox.y1 -= step;
                newBox.y2 -= step;
                break;
            case 'down':
                newBox.y1 += step;
                newBox.y2 += step;
                break;
            case 'left':
                newBox.x1 -= step;
                newBox.x2 -= step;
                break;
            case 'right':
                newBox.x1 += step;
                newBox.x2 += step;
                break;
        }

        // 先更新 box，然后基于新 box 更新预览和重新识别
        updateCardBox(selectedCardIndex, newBox);

        // 直接使用新 box 更新预览
        if (originalImage) {
            const canvas = document.createElement('canvas');
            canvas.width = originalImage.width;
            canvas.height = originalImage.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(originalImage, 0, 0);

            const cropConfig = forcePendulumMode ? PENDULUM_CARD : STANDARD_CARD;
            const artworkData = extractArtwork(ctx, newBox, cropConfig);

            const artworkCanvas = document.createElement('canvas');
            artworkCanvas.width = artworkData.width;
            artworkCanvas.height = artworkData.height;
            artworkCanvas.getContext('2d')!.putImageData(artworkData, 0, 0);
            setSelectedCardArtwork(artworkCanvas.toDataURL());
        }

        reprocessCard(selectedCardIndex, forcePendulumMode, newBox);
    }, [selectedCardIndex, recognizedCards, updateCardBox, originalImage, forcePendulumMode, reprocessCard]);

    // Deck editing handlers
    const buildMonsterTypeLine = (type: number): string | undefined => {
        if (!(type & 0x1)) return undefined; // not a monster
        const parts: string[] = [];
        if (type & 0x40) parts.push('Fusion');
        if (type & 0x2000) parts.push('Synchro');
        if (type & 0x800000) parts.push('Xyz');
        if (type & 0x4000000) parts.push('Link');
        if (type & 0x200) parts.push('Ritual');
        if (type & 0x1000000) parts.push('Pendulum');
        if (type & 0x20) parts.push('Effect');
        if (type & 0x10) parts.push('Normal');
        return parts.join(' / ') || 'Effect';
    };

    const buildCardInfo = (searchResult: SearchResult) => {
        const name = searchResult.cn_name || searchResult.sc_name;
        const type = searchResult.data.type;
        return {
            password: searchResult.id,
            card_type: (type & 0x1) ? 'Monster' : (type & 0x2) ? 'Spell' : 'Trap' as string,
            monster_type_line: buildMonsterTypeLine(type),
            name: { zh: name, ja: searchResult.jp_name, en: searchResult.en_name },
            text: { zh: searchResult.text?.desc },
            atk: searchResult.data.atk,
            def: searchResult.data.def,
            level: searchResult.data.level,
        };
    };

    const handleReplaceCard = useCallback((cardIndex: number, searchResult: SearchResult) => {
        const newCards = [...recognizedCards];
        const card = newCards[cardIndex];
        if (!card) return;
        const name = searchResult.cn_name || searchResult.sc_name;
        card.matches = [{ id: searchResult.cid, name, distance: 0, cardType: 'standard', dbHash: '' }];
        card.selectedMatchIndex = 0;
        card.isEdited = true;
        const info = buildCardInfo(searchResult) as any;
        globalCardInfoCache[name] = info;
        recognition.setRecognizedCards(newCards);
        setSelectedCardInfo(info);
    }, [recognizedCards, recognition, setSelectedCardInfo]);

    const handleDeleteCard = useCallback((cardIndex: number) => {
        const newCards = recognizedCards.filter((_, i) => i !== cardIndex).map((c, i) => ({ ...c, index: i }));
        recognition.setRecognizedCards(newCards);
        setSelectedCardIndex(-1);
    }, [recognizedCards, recognition, setSelectedCardIndex]);

    const handleDuplicateCard = useCallback((cardIndex: number) => {
        const source = recognizedCards[cardIndex];
        if (!source) return;
        const copy: RecognizedCard = {
            ...source,
            box: { x1: 0, y1: 0, x2: 0, y2: 0, conf: 0 },
            index: 0,
            isEdited: true,
        };
        const newCards = [
            ...recognizedCards.slice(0, cardIndex + 1),
            copy,
            ...recognizedCards.slice(cardIndex + 1),
        ].map((c, i) => ({ ...c, index: i }));
        recognition.setRecognizedCards(newCards);
        setSelectedCardIndex(cardIndex + 1);
    }, [recognizedCards, recognition, setSelectedCardIndex]);

    const handleAddCard = useCallback((searchResult: SearchResult) => {
        const name = searchResult.cn_name || searchResult.sc_name;
        const newCard: RecognizedCard = {
            box: { x1: 0, y1: 0, x2: 0, y2: 0, conf: 0 },
            index: recognizedCards.length,
            matches: [{ id: searchResult.cid, name, distance: 0, cardType: 'standard', dbHash: '' }],
            selectedMatchIndex: 0,
            hashStandard: '',
            hashPendulum: '',
            isEdited: true,
        };
        globalCardInfoCache[name] = buildCardInfo(searchResult) as any;
        recognition.setRecognizedCards([...recognizedCards, newCard]);
    }, [recognizedCards, recognition]);

    // 生成卡组码
    const handleGenerateDeckCode = useCallback(async () => {
        if (isGeneratingDeckCode) return;
        setIsGeneratingDeckCode(true);

        try {
            // Batch fetch missing card info
            const missingEntries: { id: number; name: string }[] = [];
            const missingEntries2: string[] = [];
            for (const c of recognizedCards) {
                const m = c.matches[c.selectedMatchIndex];
                if (m && !globalCardInfoCache[m.name]) {
                    m.id ? missingEntries.push({ id: m.id, name: m.name })
                        : missingEntries2.push(m.password!.toString());
                }
            }
            await Promise.all([
                missingEntries.length > 0 ? fetchCardInfoBatch(missingEntries) : Promise.resolve(),
                missingEntries2.length > 0 ? fetchCardInfoByPasswords(missingEntries2) : Promise.resolve(),
            ]);

            const deck: { monsters: string[]; spells: string[]; traps: string[]; extra: string[] } = {
                monsters: [], spells: [], traps: [], extra: []
            };

            recognizedCards.forEach(card => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;
                const cid = String(match.id);
                const cardInfo = globalCardInfoCache[match.name];

                if (isExtraDeck(cardInfo)) {
                    deck.extra.push(cid);
                } else if (cardInfo?.card_type === 'Spell') {
                    deck.spells.push(cid);
                } else if (cardInfo?.card_type === 'Trap') {
                    deck.traps.push(cid);
                } else {
                    deck.monsters.push(cid);
                }
            });

            // 主卡组不足40张时记录警告
            const mainDeckCount = deck.monsters.length + deck.spells.length + deck.traps.length;
            const mainDeckWarning = mainDeckCount < 40;

            // 调用API生成卡组码
            const payload = { deck };
            console.log('Deck data:', payload);
            const response = await fetch(`${apiUrl}/deck-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            console.log('Deck code response:', data);
            if (data.error) {
                setDeckCodeModal({ show: true, error: data.error });
            } else if (data.deck_code) {
                setDeckCodeModal({ show: true, code: data.deck_code, warning: mainDeckWarning ? t('deckCodeModal.mainDeckTooFew') : undefined });
                // 更新历史记录中的卡组码
                if (currentHistoryId) {
                    updateHistory(currentHistoryId, { deckCode: data.deck_code }).catch(console.error);
                }
            } else {
                setDeckCodeModal({ show: true, error: t('deckCodeModal.unknownError') });
            }
        } catch (error) {
            console.error('Failed to generate deck code:', error);
            setDeckCodeModal({ show: true, error: t('deckCodeModal.networkError') });
        } finally {
            setIsGeneratingDeckCode(false);
        }
    }, [recognizedCards, isGeneratingDeckCode, currentHistoryId]);

    // 分享功能：如果已有卡组码直接分享，否则先生成再分享
    const handleShare = useCallback(async () => {
        if (deckCodeModal.code) {
            // 已有卡组码，直接打开分享
            setShowShareModal(true);
            return;
        }

        if (isGeneratingDeckCode) return;

        setIsGeneratingDeckCode(true);

        try {
            // Batch fetch missing card info
            const missingEntries: { id: number; name: string }[] = [];
            const missingEntries2: string[] = [];
            for (const c of recognizedCards) {
                const m = c.matches[c.selectedMatchIndex];
                if (m && !globalCardInfoCache[m.name]) {
                    m.id ? missingEntries.push({ id: m.id, name: m.name })
                        : missingEntries2.push(m.password!.toString());
                }
            }
            await Promise.all([
                missingEntries.length > 0 ? fetchCardInfoBatch(missingEntries) : Promise.resolve(),
                missingEntries2.length > 0 ? fetchCardInfoByPasswords(missingEntries2) : Promise.resolve(),
            ]);

            const deck: { monsters: string[]; spells: string[]; traps: string[]; extra: string[] } = {
                monsters: [], spells: [], traps: [], extra: []
            };

            recognizedCards.forEach(card => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;
                const cid = String(match.id);
                const cardInfo = globalCardInfoCache[match.name];

                if (isExtraDeck(cardInfo)) {
                    deck.extra.push(cid);
                } else if (cardInfo?.card_type === 'Spell') {
                    deck.spells.push(cid);
                } else if (cardInfo?.card_type === 'Trap') {
                    deck.traps.push(cid);
                } else {
                    deck.monsters.push(cid);
                }
            });

            // 主卡组不足40张时记录警告
            const mainDeckCount = deck.monsters.length + deck.spells.length + deck.traps.length;
            const mainDeckWarning = mainDeckCount < 40;

            const response = await fetch(`${apiUrl}/deck-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ deck })
            });
            const data = await response.json();

            if (data.error) {
                setDeckCodeModal({ show: true, error: data.error });
            } else if (data.deck_code) {
                setDeckCodeModal({ show: false, code: data.deck_code, warning: mainDeckWarning ? t('deckCodeModal.mainDeckTooFew') : undefined });
                setShowShareModal(true);
                if (currentHistoryId) {
                    updateHistory(currentHistoryId, { deckCode: data.deck_code }).catch(console.error);
                }
            } else {
                setDeckCodeModal({ show: true, error: t('deckCodeModal.unknownError') });
            }
        } catch (error) {
            console.error('Failed to generate deck code:', error);
            setDeckCodeModal({ show: true, error: t('deckCodeModal.networkError') });
        } finally {
            setIsGeneratingDeckCode(false);
        }
    }, [recognizedCards, isGeneratingDeckCode, currentHistoryId, deckCodeModal.code]);

    // 导出 YDK 文件
    const handleExportYdk = useCallback(async () => {
        if (isExportingYdk) return;
        setIsExportingYdk(true);

        try {
            // Batch fetch missing card info
            const missingEntries: { id: number; name: string }[] = [];
            const missingEntries2: string[] = [];
            for (const c of recognizedCards) {
                const m = c.matches[c.selectedMatchIndex];
                if (m && !globalCardInfoCache[m.name]) {
                    m.id ? missingEntries.push({ id: m.id, name: m.name })
                        : missingEntries2.push(m.password!.toString());
                }
            }
            await Promise.all([
                missingEntries.length > 0 ? fetchCardInfoBatch(missingEntries) : Promise.resolve(),
                missingEntries2.length > 0 ? fetchCardInfoByPasswords(missingEntries2) : Promise.resolve(),
            ]);

            const mainDeck: number[] = [];
            const extraDeck: number[] = [];

            recognizedCards.forEach(card => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;
                const cardInfo = globalCardInfoCache[match.name];
                const baigeId = cardInfo?.password;
                if (!baigeId) return;

                if (isExtraDeck(cardInfo)) {
                    extraDeck.push(baigeId);
                } else {
                    mainDeck.push(baigeId);
                }
            });

            const ydk = `#created by GetDeck\n#main\n${mainDeck.join('\n')}\n#extra\n${extraDeck.join('\n')}\n!side\n`;

            // 复制到剪贴板
            navigator.clipboard.writeText(ydk).catch(() => {});

            // 下载文件
            const blob = new Blob([ydk], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'deck.ydk';
            a.click();
            URL.revokeObjectURL(url);

            setYdkExported(true);
            setTimeout(() => setYdkExported(false), 2000);
        } finally {
            setIsExportingYdk(false);
        }
    }, [recognizedCards, isExportingYdk]);

    const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = imageSrc;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = pixelCrop.width;
                canvas.height = pixelCrop.height;
                ctx?.drawImage(
                    image,
                    pixelCrop.x,
                    pixelCrop.y,
                    pixelCrop.width,
                    pixelCrop.height,
                    0,
                    0,
                    pixelCrop.width,
                    pixelCrop.height
                );
                canvas.toBlob(blob => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }
                    const croppedImage = new Image();
                    croppedImage.src = URL.createObjectURL(blob);
                    croppedImage.onload = () => resolve(croppedImage);
                });
            };
            image.onerror = reject;
        });
    };

    const applyCrop = async (croppedAreaPixels: any) => {
        if (!uploadedImage) return;
        try {
            const croppedImage = await getCroppedImg(uploadedImage.src, croppedAreaPixels);
            setOriginalImage(croppedImage);
            setShowCropper(false);
            resetState();
            setForcePendulumMode(false);
            setSelectedCardArtwork(null);
            // 模型已在 handleFile 中等待完成，可直接处理
            processImageRef.current(croppedImage);
        } catch (error: any) {
            console.error('裁剪失败:', error);
        }
    };

    const handleCropCancel = () => {
        setShowCropper(false);
        // 如果取消裁剪且没有已处理的图片，直接使用原图
        if (uploadedImage && !originalImage) {
            setOriginalImage(uploadedImage);
            // 模型已在 handleFile 中等待完成，可直接处理
            processImageRef.current(uploadedImage);
        }
    };

    const isProcessing = processingStage === 'detecting' || processingStage === 'identifying';

    return (
        <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
            {/* 全局拖拽覆盖层 */}
            {isDragOver && (
                <div className="fixed inset-0 z-50 bg-(--primary)/10 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-(--card-bg) border-2 border-dashed border-(--primary) shadow-2xl">
                        <svg className="w-12 h-12 text-(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-lg font-medium text-foreground">{t('upload.dropOverlay')}</span>
                    </div>
                </div>
            )}

            <Magnifier {...magnifier} />

            <Header
                show={uploadedImage !== null || originalImage !== null || sourceType === 'ydk'}
                onQuickStart={() => setShowWelcome(true)}
            />

            <div className={`flex flex-1 overflow-hidden relative ${isMobile ? 'flex-col' : ''}`}>
                {/* 裁剪器 */}
                {showCropper && uploadedImage && (
                    <CropperModal
                        imageSrc={uploadedImage.src}
                        onApply={applyCrop}
                        onCancel={handleCropCancel}
                    />
                )}

                {/* 上传区域 - 未上传图片时显示 */}
                {!uploadedImage && !originalImage && sourceType !== 'ydk' && (
                    <UploadArea
                        isInitializing={isInitializing}
                        modelDownloadProgress={modelDownloadProgress}
                        onFileSelect={handleFile}
                        onYdkImport={handleYdkImport}
                        onHistoryClick={() => setShowHistoryDrawer(true)}
                        onQuickStart={() => setShowWelcome(true)}
                        historyCount={historyCount}
                    />
                )}

                {/* 等待模型加载界面 - 已上传图片但模型还在加载时显示 */}
                {uploadedImage && !originalImage && isInitializing && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-(--background)">
                        <div className="flex flex-col items-center gap-4 p-8">
                            <div className="w-12 h-12 rounded-full border-3 border-(--card-border) border-t-(--primary) animate-spin"></div>
                            <div className="text-center">
                                <p className="text-(--foreground) font-medium mb-1">
                                    {modelDownloadProgress !== null ? t('recognition.downloadingModelTitle') : t('recognition.loadingModel')}
                                </p>
                                <p className="text-sm text-(--foreground-muted)">
                                    {modelDownloadProgress !== null
                                        ? `${modelDownloadProgress}%`
                                        : t('recognition.firstVisitHint')}
                                </p>
                            </div>
                            {modelDownloadProgress !== null && (
                                <div className="w-full max-w-xs h-1.5 bg-(--card-border) rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-(--primary) transition-all duration-300"
                                        style={{ width: `${modelDownloadProgress}%` }}
                                    />
                                </div>
                            )}
                            <p className="text-xs text-(--foreground-subtle) mt-2">
                                {t('recognition.imageReady')}
                            </p>
                        </div>
                    </div>
                )}

                {/* 主画布区域 */}
                <div className={`relative flex-1 flex flex-col overflow-hidden ${(originalImage || sourceType === 'ydk') ? 'animate-fade-in' : ''}`}>
                    {sourceType === 'ydk' ? (
                        <YdkCanvas
                            recognizedCards={recognizedCards}
                            selectedCardIndex={selectedCardIndex}
                            onCardClick={(index) => {
                                if (isMobile) {
                                    handleCardSelectFromCanvas(index);
                                } else {
                                    if (index === -1) {
                                        setSelectedCardIndex(-1);
                                    } else {
                                        selectCard(index);
                                    }
                                }
                            }}
                            isMobile={isMobile}
                        />
                    ) : (
                        <CardCanvas
                            originalImage={originalImage}
                            recognizedCards={recognizedCards}
                            selectedCardIndex={selectedCardIndex}
                            isDragging={dragState.isDragging}
                            canvasRef={canvasRef}
                            containerRef={containerRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            onCardTap={isMobile ? (index) => {
                                handleCardSelectFromCanvas(index);
                            } : undefined}
                            onZoomChange={setIsCanvasZoomed}
                            onBackgroundClick={!isMobile ? () => setSelectedCardIndex(-1) : undefined}
                        />
                    )}
                </div>

                {/* 底部浮动工具栏 - 放在主画布外面避免被 overflow-hidden 限制 */}
                {(originalImage || sourceType === 'ydk') && (
                    <FloatingToolbar
                        onCropClick={() => setShowCropper(true)}
                        onUploadClick={() => fileInputRef.current?.click()}
                        onHistoryClick={() => setShowHistoryDrawer(true)}
                        onCardListClick={() => {
                            if (isMobile) {
                                setMobileDrawerViewMode('list');
                                setMobileDrawerEntryPoint('list');
                                setShowMobileDrawer(true);
                            } else {
                                // PC端：取消选中卡片，回到列表视图
                                setSelectedCardIndex(-1);
                            }
                        }}
                        showCardListButton={isMobile}
                        cardCount={recognizedCards.length}
                        disabled={isInitializing || isProcessing}
                        hideCropButton={sourceType === 'ydk'}
                        onQuickStart={() => setShowWelcome(true)}
                    />
                )}

                {/* 电脑端侧边栏 */}
                {!isMobile && (originalImage || sourceType === 'ydk') && (
                    <div className="animate-fade-in h-full relative z-10">
                        <Sidebar
                            processingStage={processingStage}
                            recognizedCards={recognizedCardsWithInfo}
                            selectedCardIndex={selectedCardIndex}
                            selectedCardInfo={selectedCardInfo}
                            isDetailLoading={isDetailLoading}
                            selectedCardArtwork={selectedCardArtwork}
                            forcePendulumMode={forcePendulumMode}
                            onToggleCardMode={toggleCardMode}
                            onSelectAltMatch={handleAltMatchSelect}
                            onSelectCard={handleCardSelect}
                            onMoveCardBox={handleMoveCardBox}
                            scrollPosition={sidebarScrollPosition}
                            onScrollPositionChange={setSidebarScrollPosition}
                            onGenerateDeckCode={handleGenerateDeckCode}
                            isGeneratingDeckCode={isGeneratingDeckCode}
                            onShare={handleShare}
                            onExportYdk={handleExportYdk}
                            isExportingYdk={isExportingYdk}
                            ydkExported={ydkExported}
                            sourceType={sourceType}
                            onReplaceCard={handleReplaceCard}
                            onDeleteCard={handleDeleteCard}
                            onDuplicateCard={handleDuplicateCard}                            onAddCard={handleAddCard}
                        />
                    </div>
                )}

                {/* 移动端抽屉 */}
                {isMobile && (
                    <MobileCardDrawer
                        isOpen={showMobileDrawer}
                        onClose={() => {
                            setShowMobileDrawer(false);
                            setSelectedCardIndex(-1);
                        }}
                        processingStage={processingStage}
                        recognizedCards={recognizedCardsWithInfo}
                        selectedCardIndex={selectedCardIndex}
                        onSelectCard={handleCardSelect}
                        scrollPosition={mobileDrawerScrollPosition}
                        onScrollPositionChange={setMobileDrawerScrollPosition}
                        onGenerateDeckCode={handleGenerateDeckCode}
                        isGeneratingDeckCode={isGeneratingDeckCode}
                        onShare={handleShare}
                        onExportYdk={handleExportYdk}
                        isExportingYdk={isExportingYdk}
                        ydkExported={ydkExported}
                        getCardInfo={(cardName) => globalCardInfoCache[cardName] || null}
                        isDetailLoading={isDetailLoading}
                        getCardArtwork={getCardArtwork}
                        forcePendulumMode={forcePendulumMode}
                        onToggleCardMode={toggleCardMode}
                        onSelectAltMatch={handleAltMatchSelect}
                        onMoveCardBox={handleMoveCardBox}
                        initialViewMode={mobileDrawerViewMode}
                        entryPoint={mobileDrawerEntryPoint}
                        onReplaceCard={handleReplaceCard}
                        onDeleteCard={handleDeleteCard}
                        onDuplicateCard={handleDuplicateCard}
                        onAddCard={handleAddCard}
                    />
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                }}
            />

            {/* 卡组码弹窗 */}
            {deckCodeModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-(--card-bg) rounded-2xl shadow-2xl border border-(--card-border) p-6 mx-4 max-w-md w-full animate-scale-in">
                        {deckCodeModal.error ? (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground">{t('deckCodeModal.generateFailed')}</h3>
                                </div>
                                <p className="text-sm text-(--foreground-muted) mb-6">{deckCodeModal.error}</p>
                                <button
                                    onClick={() => setDeckCodeModal({ show: false })}
                                    className="w-full py-2.5 rounded-lg bg-(--background-secondary) text-foreground font-medium hover:bg-(--card-border) transition-colors"
                                >
                                    {t('common.close')}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground">{t('deckCodeModal.generateSuccess')}</h3>
                                </div>
                                <div className="bg-(--background-secondary) rounded-lg p-4 mb-4">
                                    <p className="text-sm text-foreground font-mono break-all select-all">{deckCodeModal.code}</p>
                                </div>
                                {deckCodeModal.warning && (
                                    <p className="text-xs text-yellow-500 mb-4">{deckCodeModal.warning}</p>
                                )}
                                <p className="text-xs text-(--foreground-muted) mb-4">{t('deckCodeModal.thankSharer')}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (deckCodeModal.code) {
                                                navigator.clipboard.writeText(deckCodeModal.code);
                                                setDeckCodeCopied(true);
                                                setTimeout(() => setDeckCodeCopied(false), 2000);
                                            }
                                        }}
                                        className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                            deckCodeCopied
                                                ? 'bg-[var(--success)] text-white'
                                                : 'bg-(--primary) text-white hover:bg-(--primary)/90'
                                        }`}
                                    >
                                        {deckCodeCopied ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {t('common.copied')}
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                {t('common.copy')}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDeckCodeModal(prev => ({ ...prev, show: false }));
                                            setShowShareModal(true);
                                        }}
                                        className="flex-1 py-2.5 rounded-lg bg-(--primary) text-white font-medium hover:bg-(--primary-hover) transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                        {t('common.share')}
                                    </button>
                                    <button
                                        onClick={() => setDeckCodeModal({ show: false })}
                                        className="py-2.5 px-4 rounded-lg bg-(--background-secondary) text-foreground font-medium hover:bg-(--card-border) transition-colors"
                                    >
                                        {t('common.close')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 识别数量过少提示 (移动端) */}
            {showLowCountWarning && (
                <div className="fixed inset-0 z-60 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-(--card-bg) rounded-2xl shadow-2xl border border-(--warning)/30 p-6 max-w-sm w-full animate-scale-in relative overflow-hidden">
                        {/* 背景装饰 */}
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-(--warning)/5 rounded-full blur-2xl" />
                        
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-(--warning)/10 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6 text-(--warning)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-foreground">{t('mobile.lowCountTitle')}</h3>
                            </div>
                            
                            <div className="space-y-3 mb-6">
                                <p className="text-sm text-foreground leading-relaxed">
                                    {(() => {
                                        const desc = t('mobile.lowCountDesc', { bold: '\x01', '/bold': '\x02' });
                                        const parts = desc.split(/\x01|\x02/);
                                        return <>{parts[0]}<span className="font-bold">{parts[1]}</span>{parts[2]}</>;
                                    })()}
                                </p>
                                <div className="p-3 rounded-xl bg-(--background-secondary) border border-(--card-border)">
                                    <p className="text-xs text-(--foreground-muted) leading-relaxed">
                                        {t('mobile.lowCountCropHint').split('{icon}')[0]}<svg className="w-3.5 h-3.5 inline-block align-text-bottom text-(--primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>{t('mobile.lowCountCropHint').split('{icon}')[1]}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowLowCountWarning(false)}
                                className="w-full py-3 rounded-xl bg-(--primary) text-white font-bold hover:bg-(--primary-hover) transition-all active:scale-[0.98] shadow-lg shadow-(--primary)/20"
                            >
                                {t('common.gotIt')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 历史记录抽屉 */}
            <HistoryDrawer
                isOpen={showHistoryDrawer}
                onClose={() => setShowHistoryDrawer(false)}
                onLoadHistory={handleLoadHistory}
                onHistoryCountChange={setHistoryCount}
            />

            {/* 分享弹窗 */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                deckCode={deckCodeModal.code || ''}
                recognizedCards={recognizedCards}
            />

            {/* 首次访问欢迎弹窗 */}
            <WelcomeModal isOpen={showWelcome || undefined} onClose={() => setShowWelcome(false)} />
        </div>
    );
}
