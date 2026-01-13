"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRecognition } from '../hooks/useRecognition';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { useMobile } from '../hooks/useMobile';
import { extractArtwork, STANDARD_CARD, PENDULUM_CARD } from '../utils/recognition';
import Header from './ui/Header';
import UploadArea from './ui/UploadArea';
import CardCanvas from './ui/CardCanvas';
import Sidebar from './ui/Sidebar';
import Magnifier from './ui/Magnifier';
import CropperModal from './ui/CropperModal';
import FloatingToolbar from './ui/FloatingToolbar';
import MobileCardListDrawer from './ui/MobileCardListDrawer';
import MobileCardDetailDrawer from './ui/MobileCardDetailDrawer';

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
        resetState
    } = recognition;

    const [showCropper, setShowCropper] = useState(false);
    const [forcePendulumMode, setForcePendulumMode] = useState(false);
    const [selectedCardArtwork, setSelectedCardArtwork] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 移动端抽屉状态
    const [showCardListDrawer, setShowCardListDrawer] = useState(false);
    const [showCardDetailDrawer, setShowCardDetailDrawer] = useState(false);

    const canvasInteraction = useCanvasInteraction({
        originalImage,
        recognizedCards,
        selectedCardIndex,
        forcePendulumMode,
        onSelectCard: (index) => {
            if (index === -1) {
                setSelectedCardIndex(-1);
                if (isMobile) {
                    setShowCardDetailDrawer(false);
                }
            } else {
                handleCardSelect(index);
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
        if (!session || !wasmDb) return;

        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);
        setShowCardListDrawer(false);
        setShowCardDetailDrawer(false);

        try {
            const img = await loadImage(file);
            setUploadedImage(img);

            // 检查是否需要自动裁剪
            if (shouldAutoCrop(img, isMobile)) {
                setShowCropper(true);
            } else {
                setOriginalImage(img);
                processImage(img);
            }
        } catch (error: any) {
            console.error('图片加载失败:', error);
        }
    }, [session, wasmDb, resetState, setOriginalImage, processImage, isMobile]);

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

    const handleCardSelect = useCallback(async (index: number) => {
        if (index === -1) return;
        const card = recognizedCards[index];
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulumMatch = currentMatch?.cardType === 'pendulum';

        setForcePendulumMode(isPendulumMatch);
        updateArtworkPreview(index, isPendulumMatch);
        selectCard(index);

        // 移动端：打开卡片详情抽屉
        if (isMobile) {
            setShowCardDetailDrawer(true);
        }
    }, [recognizedCards, selectCard, updateArtworkPreview, isMobile]);

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

        reprocessCard(selectedCardIndex, forcePendulumMode);
    }, [selectedCardIndex, recognizedCards, updateCardBox, originalImage, forcePendulumMode, reprocessCard]);

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
            processImage(croppedImage);
        } catch (error: any) {
            console.error('裁剪失败:', error);
        }
    };

    const handleCropCancel = () => {
        setShowCropper(false);
        // 如果取消裁剪且没有已处理的图片，直接使用原图
        if (uploadedImage && !originalImage) {
            setOriginalImage(uploadedImage);
            processImage(uploadedImage);
        }
    };

    const isProcessing = processingStage === 'detecting' || processingStage === 'identifying';

    const selectedCard = selectedCardIndex !== -1 ? recognizedCards[selectedCardIndex] : null;

    return (
        <div className="flex flex-col h-dvh bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
            {/* 全局拖拽覆盖层 */}
            {isDragOver && (
                <div className="fixed inset-0 z-50 bg-[var(--primary)]/10 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
                    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-[var(--card-bg)] border-2 border-dashed border-[var(--primary)] shadow-2xl">
                        <svg className="w-12 h-12 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-lg font-medium text-[var(--foreground)]">松开以上传图片</span>
                    </div>
                </div>
            )}

            <Magnifier {...magnifier} />

            <Header
                show={uploadedImage !== null || originalImage !== null}
            />

            <div className={`flex flex-1 overflow-hidden relative ${isMobile ? 'flex-col' : ''}`}>
                {showCropper && uploadedImage && (
                    <CropperModal
                        imageSrc={uploadedImage.src}
                        onApply={applyCrop}
                        onCancel={handleCropCancel}
                    />
                )}

                {!originalImage && (
                    <UploadArea
                        isInitializing={isInitializing}
                        modelDownloadProgress={modelDownloadProgress}
                        onFileSelect={handleFile}
                    />
                )}

                {/* 主画布区域 */}
                <div className="relative flex-1 flex flex-col overflow-hidden">
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
                    />

                    {/* 底部浮动工具栏 */}
                    {originalImage && (
                        <FloatingToolbar
                            onCropClick={() => setShowCropper(true)}
                            onUploadClick={() => fileInputRef.current?.click()}
                            onCardListClick={() => setShowCardListDrawer(true)}
                            showCardListButton={isMobile}
                            cardCount={recognizedCards.length}
                            disabled={isInitializing || isProcessing}
                        />
                    )}
                </div>

                {/* 电脑端侧边栏 */}
                {!isMobile && (
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
                    />
                )}

                {/* 移动端抽屉 */}
                {isMobile && (
                    <>
                        <MobileCardListDrawer
                            isOpen={showCardListDrawer}
                            onClose={() => setShowCardListDrawer(false)}
                            processingStage={processingStage}
                            recognizedCards={recognizedCards}
                            onSelectCard={handleCardSelect}
                        />

                        <MobileCardDetailDrawer
                            isOpen={showCardDetailDrawer}
                            onClose={() => {
                                setShowCardDetailDrawer(false);
                                setSelectedCardIndex(-1);
                            }}
                            selectedCard={selectedCard}
                            selectedCardInfo={selectedCardInfo}
                            isDetailLoading={isDetailLoading}
                            selectedCardArtwork={selectedCardArtwork}
                            forcePendulumMode={forcePendulumMode}
                            onToggleCardMode={toggleCardMode}
                            onSelectAltMatch={handleAltMatchSelect}
                            onMoveCardBox={handleMoveCardBox}
                        />
                    </>
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
        </div>
    );
}
