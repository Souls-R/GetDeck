"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRecognition, globalCardInfoCache } from '../hooks/useRecognition';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { useMobile } from '../hooks/useMobile';
import { extractArtwork, STANDARD_CARD, PENDULUM_CARD } from '../utils/recognition';
import { saveHistory, updateHistory, getHistoryCount, DeckHistory } from '../utils/historyDb';
import { apiUrl } from '../config';
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

const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
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
    const isMobile = useMobile();
    const recognition = useRecognition();
    const {
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
        setProcessingStage,
        resetState,
        waitForInit
    } = recognition;

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
    const [deckCodeModal, setDeckCodeModal] = useState<{ show: boolean; code?: string; error?: string }>({ show: false });
    const [deckCodeCopied, setDeckCodeCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // 画布缩放状态
    const [isCanvasZoomed, setIsCanvasZoomed] = useState(false);

    // 历史记录相关状态
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [historyCount, setHistoryCount] = useState(0);
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

    // Artwork 缓存（避免重复绘制 canvas）
    const artworkCacheRef = useRef<Map<string, string>>(new Map());

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
        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setShowMobileDrawer(false);
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

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) handleFile(file);
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleFile]);

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
    const handleLoadHistory = useCallback((image: HTMLImageElement, history: DeckHistory) => {
        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setShowMobileDrawer(false);
        setMobileDrawerViewMode('list');
        setMobileDrawerEntryPoint('list');
        setCurrentHistoryId(history.id);

        // 设置图片和识别结果
        setUploadedImage(image);
        setOriginalImage(image);

        // 恢复识别结果
        recognition.setRecognizedCards(history.recognizedCards);

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

    const handleCardSelect = useCallback(async (index: number, fromList?: boolean) => {
        if (index === -1) return;
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
            const currentCenterX = (currentCard.box.x1 + currentCard.box.x2) / 2;
            const currentCenterY = (currentCard.box.y1 + currentCard.box.y2) / 2;
            const cardHeight = currentCard.box.y2 - currentCard.box.y1;

            let bestIndex = -1;
            let bestScore = Infinity;

            // 用于左右换行：先找最近的行，再在该行中找目标
            let nextRowY = Infinity;  // 下一行的 Y 坐标
            let prevRowY = -Infinity; // 上一行的 Y 坐标

            // 第一遍：找到最近的下一行和上一行的 Y 坐标
            recognizedCards.forEach((card, index) => {
                if (index === selectedCardIndex) return;
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
                if (index === selectedCardIndex) return;

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

        let newBox = { ...box };
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

    // 生成卡组码
    const handleGenerateDeckCode = useCallback(async () => {
        if (isGeneratingDeckCode) return;

        // 开始加载
        setIsGeneratingDeckCode(true);

        try {
            // 先确保所有卡片信息都已加载
            const uniqueNames = Array.from(
                new Set(recognizedCards.map(c => c.matches[c.selectedMatchIndex]?.name).filter(Boolean))
            );

            // 并行加载所有缺失的卡片信息
            const missingNames = uniqueNames.filter(name => !globalCardInfoCache[name]);
            if (missingNames.length > 0) {
                await Promise.all(
                    missingNames.map(name =>
                        fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`)
                            .then(r => r.json())
                            .then(data => {
                                globalCardInfoCache[name] = data;
                            })
                            .catch(err => console.error(`Failed to fetch card info for ${name}:`, err))
                    )
                );
            }

            // 额外卡组的怪兽类型关键词
            const extraDeckTypes = ['融合', '超量', '连接', '同调', '链接', '同步'];

            const deck: {
                monsters: string[];
                spells: string[];
                traps: string[];
                extra: string[];
            } = {
                monsters: [],
                spells: [],
                traps: [],
                extra: []
            };

            recognizedCards.forEach(card => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;

                const cid = String(match.id);
                const cardInfo = globalCardInfoCache[match.name];
                const types = cardInfo?.result?.[0]?.text?.types || '';

                if (extraDeckTypes.some(t => types.includes(t))) {
                    // 融合/同步/超量/链接怪兽放入额外卡组
                    deck.extra.push(cid);
                    console.log(`Adding to deck: ${match.name} (Types: ${types}) added to Extra Deck`);
                } else if (types.includes('魔法') && !types.includes('魔法师')) {
                    deck.spells.push(cid);
                } else if (types.includes('陷阱')) {
                    deck.traps.push(cid);
                } else {
                    // 其他怪兽卡放入主卡组
                    deck.monsters.push(cid);
                }
            });

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
                setDeckCodeModal({ show: true, code: data.deck_code });
                // 更新历史记录中的卡组码
                if (currentHistoryId) {
                    updateHistory(currentHistoryId, { deckCode: data.deck_code }).catch(console.error);
                }
            } else {
                setDeckCodeModal({ show: true, error: '未知错误' });
            }
        } catch (error) {
            console.error('Failed to generate deck code:', error);
            setDeckCodeModal({ show: true, error: '网络错误，请重试' });
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
            // 先确保所有卡片信息都已加载
            const uniqueNames = Array.from(
                new Set(recognizedCards.map(c => c.matches[c.selectedMatchIndex]?.name).filter(Boolean))
            );

            // 并行加载所有缺失的卡片信息
            const missingNames = uniqueNames.filter(name => !globalCardInfoCache[name]);
            if (missingNames.length > 0) {
                await Promise.all(
                    missingNames.map(name =>
                        fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`)
                            .then(r => r.json())
                            .then(data => {
                                globalCardInfoCache[name] = data;
                            })
                            .catch(err => console.error(`Failed to fetch card info for ${name}:`, err))
                    )
                );
            }

            // 额外卡组的怪兽类型关键词
            const extraDeckTypes = ['融合', '超量', '连接', '同调', '链接', '同步'];

            const deck: {
                monsters: string[];
                spells: string[];
                traps: string[];
                extra: string[];
            } = {
                monsters: [],
                spells: [],
                traps: [],
                extra: []
            };

            recognizedCards.forEach(card => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;

                const cid = String(match.id);
                const cardInfo = globalCardInfoCache[match.name];
                const types = cardInfo?.result?.[0]?.text?.types || '';

                if (extraDeckTypes.some(t => types.includes(t))) {
                    deck.extra.push(cid);
                } else if (types.includes('魔法') && !types.includes('魔法师')) {
                    deck.spells.push(cid);
                } else if (types.includes('陷阱')) {
                    deck.traps.push(cid);
                } else {
                    deck.monsters.push(cid);
                }
            });

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
                setDeckCodeModal({ show: false, code: data.deck_code });
                setShowShareModal(true);
                if (currentHistoryId) {
                    updateHistory(currentHistoryId, { deckCode: data.deck_code }).catch(console.error);
                }
            } else {
                setDeckCodeModal({ show: true, error: '未知错误' });
            }
        } catch (error) {
            console.error('Failed to generate deck code:', error);
            setDeckCodeModal({ show: true, error: '网络错误，请重试' });
        } finally {
            setIsGeneratingDeckCode(false);
        }
    }, [recognizedCards, isGeneratingDeckCode, currentHistoryId, deckCodeModal.code]);

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

    const selectedCard = selectedCardIndex !== -1 ? recognizedCards[selectedCardIndex] : null;

    return (
        <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
            {/* 全局拖拽覆盖层 */}
            {isDragOver && (
                <div className="fixed inset-0 z-50 bg-(--primary)/10 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-(--card-bg) border-2 border-dashed border-(--primary) shadow-2xl">
                        <svg className="w-12 h-12 text-(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-lg font-medium text-foreground">松开以上传图片</span>
                    </div>
                </div>
            )}

            <Magnifier {...magnifier} />

            <Header
                show={uploadedImage !== null || originalImage !== null}
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
                {!uploadedImage && !originalImage && (
                    <UploadArea
                        isInitializing={isInitializing}
                        modelDownloadProgress={modelDownloadProgress}
                        onFileSelect={handleFile}
                        onHistoryClick={() => setShowHistoryDrawer(true)}
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
                                    {modelDownloadProgress !== null ? '正在下载识别模型' : '正在加载模型'}
                                </p>
                                <p className="text-sm text-(--foreground-muted)">
                                    {modelDownloadProgress !== null
                                        ? `${modelDownloadProgress}%`
                                        : '首次访问需要几秒钟下载模型文件...'}
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
                                图片已准备好，模型加载完成后将自动处理
                            </p>
                        </div>
                    </div>
                )}

                {/* 主画布区域 */}
                <div className={`relative flex-1 flex flex-col overflow-hidden ${originalImage ? 'animate-fade-in' : ''}`}>
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
                </div>

                {/* 底部浮动工具栏 - 放在主画布外面避免被 overflow-hidden 限制 */}
                {originalImage && (
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
                    />
                )}

                {/* 电脑端侧边栏 */}
                {!isMobile && originalImage && (
                    <div className="animate-fade-in h-full relative z-10">
                        <Sidebar
                            processingStage={processingStage}
                            recognizedCards={recognizedCards}
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
                        recognizedCards={recognizedCards}
                        selectedCardIndex={selectedCardIndex}
                        onSelectCard={handleCardSelect}
                        scrollPosition={mobileDrawerScrollPosition}
                        onScrollPositionChange={setMobileDrawerScrollPosition}
                        onGenerateDeckCode={handleGenerateDeckCode}
                        isGeneratingDeckCode={isGeneratingDeckCode}
                        onShare={handleShare}
                        getCardInfo={(cardName) => globalCardInfoCache[cardName] || null}
                        isDetailLoading={isDetailLoading}
                        getCardArtwork={getCardArtwork}
                        forcePendulumMode={forcePendulumMode}
                        onToggleCardMode={toggleCardMode}
                        onSelectAltMatch={handleAltMatchSelect}
                        onMoveCardBox={handleMoveCardBox}
                        initialViewMode={mobileDrawerViewMode}
                        entryPoint={mobileDrawerEntryPoint}
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
                                    <h3 className="text-lg font-bold text-foreground">生成失败</h3>
                                </div>
                                <p className="text-sm text-(--foreground-muted) mb-6">{deckCodeModal.error}</p>
                                <button
                                    onClick={() => setDeckCodeModal({ show: false })}
                                    className="w-full py-2.5 rounded-lg bg-(--background-secondary) text-foreground font-medium hover:bg-(--card-border) transition-colors"
                                >
                                    关闭
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
                                    <h3 className="text-lg font-bold text-foreground">卡组码生成成功</h3>
                                </div>
                                <div className="bg-(--background-secondary) rounded-lg p-4 mb-4">
                                    <p className="text-sm text-foreground font-mono break-all select-all">{deckCodeModal.code}</p>
                                </div>
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
                                                已复制
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                复制
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
                                        分享
                                    </button>
                                    <button
                                        onClick={() => setDeckCodeModal({ show: false })}
                                        className="py-2.5 px-4 rounded-lg bg-(--background-secondary) text-foreground font-medium hover:bg-(--card-border) transition-colors"
                                    >
                                        关闭
                                    </button>
                                </div>
                            </>
                        )}
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
        </div>
    );
}
