import React, { useEffect, useCallback, useState, useRef } from 'react';
import { RecognizedCard } from '../../types';

interface CardCanvasProps {
    originalImage: HTMLImageElement | null;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
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
    isDragging,
    canvasRef,
    containerRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave
}: CardCanvasProps) {
    // 缩放和平移状态 - 使用 ref 避免状态更新延迟
    const [, forceUpdate] = useState(0);
    const transformRef = useRef({ scale: 1, x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // 触摸状态
    const touchStateRef = useRef({
        lastDistance: 0,
        lastCenter: { x: 0, y: 0 },
        lastSingleTouch: { x: 0, y: 0 },
        isPinching: false,
        isDragging: false,
        touchCount: 0
    });

    // 重置缩放当图片改变时
    useEffect(() => {
        transformRef.current = { scale: 1, x: 0, y: 0 };
        if (panelRef.current) {
            panelRef.current.style.transform = 'scale(1) translate(0px, 0px)';
        }
    }, [originalImage]);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !originalImage || !container) return;

        // Get computed padding to calculate available space
        const computedStyle = getComputedStyle(container);
        const paddingX = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
        const paddingY = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);

        // Available space after accounting for padding
        const availableW = container.clientWidth - paddingX;
        const availableH = container.clientHeight - paddingY;

        const imgAspect = originalImage.width / originalImage.height;
        const availableAspect = availableW / availableH;

        let renderW, renderH;
        if (availableAspect > imgAspect) {
            renderH = availableH;
            renderW = renderH * imgAspect;
        } else {
            renderW = availableW;
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
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = isDragging ? 6 : 4;
                ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            } else if (isIdentified) {
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
            } else {
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'transparent';
            }

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

    // 直接更新 DOM，不经过 React 状态
    const updateTransform = useCallback(() => {
        if (panelRef.current) {
            const { scale, x, y } = transformRef.current;
            panelRef.current.style.transform = `scale(${scale}) translate(${x / scale}px, ${y / scale}px)`;
        }
    }, []);

    // 计算两点之间的距离
    const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // 计算两点的中心
    const getCenter = (touch1: React.Touch, touch2: React.Touch) => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        touchStateRef.current.touchCount = touches.length;

        if (touches.length === 2) {
            // 双指缩放开始
            e.preventDefault();
            const distance = getDistance(touches[0], touches[1]);
            const center = getCenter(touches[0], touches[1]);
            touchStateRef.current.lastDistance = distance;
            touchStateRef.current.lastCenter = center;
            touchStateRef.current.isPinching = true;
            touchStateRef.current.isDragging = false;
        } else if (touches.length === 1 && transformRef.current.scale > 1) {
            // 单指拖动开始（仅在缩放状态下）
            touchStateRef.current.lastSingleTouch = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };
            touchStateRef.current.isDragging = true;
            touchStateRef.current.isPinching = false;
        }
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;

        if (touches.length === 2 && touchStateRef.current.isPinching) {
            // 双指缩放
            e.preventDefault();
            const distance = getDistance(touches[0], touches[1]);
            const center = getCenter(touches[0], touches[1]);

            // 计算缩放
            const scaleChange = distance / touchStateRef.current.lastDistance;
            const newScale = Math.min(Math.max(transformRef.current.scale * scaleChange, 1), 5);

            // 计算平移
            const dx = center.x - touchStateRef.current.lastCenter.x;
            const dy = center.y - touchStateRef.current.lastCenter.y;

            transformRef.current.scale = newScale;
            if (newScale > 1) {
                transformRef.current.x += dx;
                transformRef.current.y += dy;
            } else {
                transformRef.current.x = 0;
                transformRef.current.y = 0;
            }

            touchStateRef.current.lastDistance = distance;
            touchStateRef.current.lastCenter = center;

            updateTransform();
        } else if (touches.length === 1 && touchStateRef.current.isDragging && transformRef.current.scale > 1) {
            // 单指拖动
            e.preventDefault();
            const dx = touches[0].clientX - touchStateRef.current.lastSingleTouch.x;
            const dy = touches[0].clientY - touchStateRef.current.lastSingleTouch.y;

            transformRef.current.x += dx;
            transformRef.current.y += dy;

            touchStateRef.current.lastSingleTouch = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };

            updateTransform();
        }
    }, [updateTransform]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const remainingTouches = e.touches.length;

        if (remainingTouches === 0) {
            touchStateRef.current.isPinching = false;
            touchStateRef.current.isDragging = false;

            // 如果缩放回到1，重置平移
            if (transformRef.current.scale <= 1) {
                transformRef.current = { scale: 1, x: 0, y: 0 };
                updateTransform();
            }
        } else if (remainingTouches === 1 && touchStateRef.current.isPinching) {
            // 从双指变成单指，开始拖动
            touchStateRef.current.isPinching = false;
            if (transformRef.current.scale > 1) {
                touchStateRef.current.isDragging = true;
                touchStateRef.current.lastSingleTouch = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
        }

        touchStateRef.current.touchCount = remainingTouches;
    }, [updateTransform]);

    // 双击重置缩放
    const lastTapRef = useRef(0);
    const handleDoubleTap = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
                // 双击检测 - 重置
                transformRef.current = { scale: 1, x: 0, y: 0 };
                updateTransform();
            }
            lastTapRef.current = now;
        }
    }, [updateTransform]);

    return (
        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 bg-[var(--background-secondary)]"
            style={{ paddingBottom: 'max(4rem, 15%)' }}
        >
            {/* Canvas面板 */}
            <div
                ref={panelRef}
                className={`panel panel-elevated overflow-hidden ${isDragging ? 'scale-[1.005]' : ''}`}
                style={{
                    touchAction: 'none',
                    willChange: 'transform'
                }}
                onTouchStart={(e) => {
                    handleTouchStart(e);
                    handleDoubleTap(e);
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
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
        </div>
    );
}
