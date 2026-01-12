"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRecognition } from '../hooks/useRecognition';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { extractArtwork, STANDARD_CARD, PENDULUM_CARD } from '../utils/recognition';
import Header from './ui/Header';
import UploadArea from './ui/UploadArea';
import CardCanvas from './ui/CardCanvas';
import Sidebar from './ui/Sidebar';
import Magnifier from './ui/Magnifier';
import CropperModal from './ui/CropperModal';

const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

export default function DeckRecognizer() {
    // 使用自定义hooks
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

    // 本地状态
    const [showCropper, setShowCropper] = useState(false);
    const [forcePendulumMode, setForcePendulumMode] = useState(false);
    const [selectedCardArtwork, setSelectedCardArtwork] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Canvas交互hook
    const canvasInteraction = useCanvasInteraction({
        originalImage,
        recognizedCards,
        selectedCardIndex,
        forcePendulumMode,
        onSelectCard: (index) => {
            if (index === -1) {
                setSelectedCardIndex(-1);
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

    // 处理文件选择
    const handleFile = useCallback(async (file: File) => {
        if (!session || !wasmDb) return;

        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);

        try {
            const img = await loadImage(file);
            setOriginalImage(img);
            processImage(img);
        } catch (error: any) {
            console.error('图片加载失败:', error);
        }
    }, [session, wasmDb, resetState, setOriginalImage, processImage]);

    // 粘贴事件处理
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

    // 更新artwork预览
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

    // 处理卡片选择
    const handleCardSelect = useCallback(async (index: number) => {
        if (index === -1) return;
        const card = recognizedCards[index];
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulumMatch = currentMatch?.cardType === 'pendulum';

        setForcePendulumMode(isPendulumMatch);
        updateArtworkPreview(index, isPendulumMatch);
        selectCard(index);
    }, [recognizedCards, selectCard, updateArtworkPreview]);

    // 切换卡片模式
    const toggleCardMode = useCallback(() => {
        if (selectedCardIndex === -1) return;
        const newMode = !forcePendulumMode;
        setForcePendulumMode(newMode);
        updateArtworkPreview(selectedCardIndex, newMode);
    }, [selectedCardIndex, forcePendulumMode, updateArtworkPreview]);

    // 处理备选匹配选择
    const handleAltMatchSelect = useCallback((matchIndex: number) => {
        if (selectedCardIndex === -1) return;
        const card = recognizedCards[selectedCardIndex];
        const newMatch = card.matches[matchIndex];
        const isPendulum = newMatch.cardType === 'pendulum';

        setForcePendulumMode(isPendulum);
        updateArtworkPreview(selectedCardIndex, isPendulum);
        handleSelectAltMatch(matchIndex);
    }, [selectedCardIndex, recognizedCards, handleSelectAltMatch, updateArtworkPreview]);

    // 裁剪相关
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
        if (!originalImage) return;
        try {
            const croppedImage = await getCroppedImg(originalImage.src, croppedAreaPixels);
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

    return (
        <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden select-none">
            {/* 放大镜 */}
            <Magnifier {...magnifier} />

            {/* 头部 */}
            <Header
                statusText={statusText}
                progress={progress}
                processingStage={processingStage}
                isInitializing={isInitializing}
                hasImage={!!originalImage}
                onCropClick={() => setShowCropper(true)}
                onFileClick={() => fileInputRef.current?.click()}
            />

            {/* 主体内容 */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* 裁剪器 */}
                {showCropper && originalImage && (
                    <CropperModal
                        imageSrc={originalImage.src}
                        onApply={applyCrop}
                        onCancel={() => setShowCropper(false)}
                    />
                )}

                {/* 空状态/上传区域 */}
                {!originalImage && (
                    <UploadArea
                        isInitializing={isInitializing}
                        onFileSelect={handleFile}
                    />
                )}

                {/* Canvas区域 */}
                <CardCanvas
                    originalImage={originalImage}
                    recognizedCards={recognizedCards}
                    selectedCardIndex={selectedCardIndex}
                    processingStage={processingStage}
                    isDragging={dragState.isDragging}
                    canvasRef={canvasRef}
                    containerRef={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                />

                {/* 侧边栏 */}
                <Sidebar
                    processingStage={processingStage}
                    processingVisual={processingVisual}
                    recognizedCards={recognizedCards}
                    selectedCardIndex={selectedCardIndex}
                    selectedCardInfo={selectedCardInfo}
                    isDetailLoading={isDetailLoading}
                    selectedCardArtwork={selectedCardArtwork}
                    forcePendulumMode={forcePendulumMode}
                    onToggleCardMode={toggleCardMode}
                    onSelectAltMatch={handleAltMatchSelect}
                    onSelectCard={handleCardSelect}
                />
            </div>

            {/* 隐藏的文件输入 */}
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
