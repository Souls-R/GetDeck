import React, { useEffect, useCallback } from 'react';
import { RecognizedCard } from '../../types';
import { ProcessingStage } from '../../hooks/useRecognition';

interface CardCanvasProps {
    originalImage: HTMLImageElement | null;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    processingStage: ProcessingStage;
    isDragging: boolean;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
}

export default function CardCanvas({
    originalImage,
    recognizedCards,
    selectedCardIndex,
    processingStage,
    isDragging,
    canvasRef,
    containerRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave
}: CardCanvasProps) {
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !originalImage || !container) return;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        const imgAspect = originalImage.width / originalImage.height;
        const containerAspect = containerW / containerH;

        let renderW, renderH;
        if (containerAspect > imgAspect) {
            renderH = containerH;
            renderW = renderH * imgAspect;
        } else {
            renderW = containerW;
            renderH = renderW / imgAspect;
        }

        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        canvas.style.width = `${renderW}px`;
        canvas.style.height = `${renderH}px`;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        recognizedCards.forEach((card, i) => {
            const { box } = card;
            const isSelected = i === selectedCardIndex;
            const isIdentified = card.matches.length > 0;

            if (isSelected) {
                // 选中状态 - 使用主题色
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = isDragging ? 6 : 4;
                ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            } else if (isIdentified) {
                // 已识别状态 - 成功色
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
            } else {
                // 未识别状态
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'transparent';
            }

            // 绘制圆角矩形
            const radius = 4;
            const x = box.x1;
            const y = box.y1;
            const w = box.x2 - box.x1;
            const h = box.y2 - box.y1;

            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();

            ctx.stroke();
            if (isSelected || isIdentified) ctx.fill();
        });
    }, [originalImage, recognizedCards, selectedCardIndex, isDragging, canvasRef, containerRef]);

    useEffect(() => {
        drawCanvas();
        const resizeObserver = new ResizeObserver(() => drawCanvas());
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [drawCanvas, containerRef]);

    return (
        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden flex items-center justify-center p-6 bg-[var(--background-secondary)]"
        >
            {/* Canvas面板 */}
            <div className={`panel panel-elevated overflow-hidden transition-all duration-300 ${isDragging ? 'scale-[1.005]' : ''}`}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    className="block"
                    style={{ opacity: originalImage ? 1 : 0 }}
                />
            </div>

            {/* 提示信息 */}
            {originalImage && processingStage === 'done' && !isDragging && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass px-5 py-2.5 rounded-full text-sm text-[var(--foreground-muted)] shadow-lg animate-float-in pointer-events-none">
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        长按卡片边框进行微调
                    </span>
                </div>
            )}
        </div>
    );
}
