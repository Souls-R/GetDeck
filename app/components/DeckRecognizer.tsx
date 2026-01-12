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
import FloatingToolbar from './ui/FloatingToolbar';

const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

export default function DeckRecognizer() {
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

    const [showCropper, setShowCropper] = useState(false);
    const [forcePendulumMode, setForcePendulumMode] = useState(false);
    const [selectedCardArtwork, setSelectedCardArtwork] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null); // 原始上传图片
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFile = useCallback(async (file: File) => {
        if (!session || !wasmDb) return;

        resetState();
        setForcePendulumMode(false);
        setSelectedCardArtwork(null);

        try {
            const img = await loadImage(file);
            setUploadedImage(img); // 保存原始上传图片
            setOriginalImage(img);
            processImage(img);
        } catch (error: any) {
            console.error('图片加载失败:', error);
        }
    }, [session, wasmDb, resetState, setOriginalImage, processImage]);

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
    }, [recognizedCards, selectCard, updateArtworkPreview]);

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

    const isProcessing = processingStage === 'detecting' || processingStage === 'identifying';

    return (
        <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden select-none">
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
                statusText={statusText}
                progress={progress}
                processingStage={processingStage}
            />

            <div className="flex flex-1 overflow-hidden relative">
                {showCropper && uploadedImage && (
                    <CropperModal
                        imageSrc={uploadedImage.src}
                        onApply={applyCrop}
                        onCancel={() => setShowCropper(false)}
                    />
                )}

                {!originalImage && (
                    <UploadArea
                        isInitializing={isInitializing}
                        onFileSelect={handleFile}
                    />
                )}

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
                        disabled={isInitializing || isProcessing}
                    />
                )}

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
