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
    onCardTap?: (index: number) => void;
    onZoomChange?: (isZoomed: boolean) => void;
    onBackgroundClick?: () => void;
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
    onMouseLeave,
    onCardTap,
    onZoomChange,
    onBackgroundClick
}: CardCanvasProps) {
    // 缩放和平移状态 - 使用 ref 避免状态更新延迟
    const [, forceUpdate] = useState(0);
    const [isZoomed, setIsZoomed] = useState(false);
    const [isPanDragging, setIsPanDragging] = useState(false);
    const transformRef = useRef({ scale: 1, x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // 触摸状态
    const touchStateRef = useRef({
        lastDistance: 0,
        lastCenter: { x: 0, y: 0 },
        lastSingleTouch: { x: 0, y: 0 },
        startSingleTouch: { x: 0, y: 0 },
        isPinching: false,
        isDragging: false,
        touchCount: 0,
        hasMoved: false,
        wasPinching: false  // 标记是否刚刚结束双指操作
    });

    // PC端鼠标拖动状态
    const mouseStateRef = useRef({
        isDragging: false,
        lastMousePos: { x: 0, y: 0 }
    });

    // 重置缩放当图片改变时
    useEffect(() => {
        transformRef.current = { scale: 1, x: 0, y: 0 };
        if (panelRef.current) {
            panelRef.current.style.transform = 'scale(1) translate(0px, 0px)';
        }
    }, [originalImage]);

    // 存储 canvas 渲染尺寸，用于计算边框位置
    const [canvasSize, setCanvasSize] = useState({ renderW: 0, renderH: 0 });

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

        // 更新渲染尺寸状态
        setCanvasSize({ renderW, renderH });

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);
    }, [originalImage, canvasRef, containerRef]);

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
            const zoomed = scale > 1;
            setIsZoomed(zoomed);
            onZoomChange?.(zoomed);
        }
    }, [onZoomChange]);

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

    const handleNativeTouchStart = useCallback((e: TouchEvent) => {
        const touches = e.touches;
        touchStateRef.current.touchCount = touches.length;
        touchStateRef.current.hasMoved = false;

        if (touches.length === 2) {
            // 双指缩放开始
            if (e.cancelable) e.preventDefault();
            const distance = getDistance(touches[0] as unknown as React.Touch, touches[1] as unknown as React.Touch);
            const center = getCenter(touches[0] as unknown as React.Touch, touches[1] as unknown as React.Touch);
            touchStateRef.current.lastDistance = distance;
            touchStateRef.current.lastCenter = center;
            touchStateRef.current.isPinching = true;
            touchStateRef.current.isDragging = false;
            touchStateRef.current.wasPinching = true;  // 标记正在进行双指操作
        } else if (touches.length === 1) {
            // 记录起始位置
            touchStateRef.current.startSingleTouch = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };
            touchStateRef.current.lastSingleTouch = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };
            // 新的单指触摸开始时，如果不是正在双指操作，重置 wasPinching
            // 这确保双指缩放后完全松开再触摸时可以正常触发点击
            if (!touchStateRef.current.isPinching) {
                touchStateRef.current.wasPinching = false;
            }
            if (transformRef.current.scale > 1) {
                // 单指拖动开始（仅在缩放状态下）
                touchStateRef.current.isDragging = true;
                touchStateRef.current.isPinching = false;
            }
        }
    }, []);

    const handleNativeTouchMove = useCallback((e: TouchEvent) => {
        const touches = e.touches;

        if (touches.length === 2 && touchStateRef.current.isPinching) {
            // 双指缩放
            if (e.cancelable) e.preventDefault();
            const distance = getDistance(touches[0] as unknown as React.Touch, touches[1] as unknown as React.Touch);
            const center = getCenter(touches[0] as unknown as React.Touch, touches[1] as unknown as React.Touch);

            // 计算缩放比例变化
            const scaleChange = distance / touchStateRef.current.lastDistance;
            const oldScale = transformRef.current.scale;
            const newScale = Math.min(Math.max(oldScale * scaleChange, 1), 5);

            // 获取面板的中心位置
            if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                const panelCenterX = rect.left + rect.width / 2;
                const panelCenterY = rect.top + rect.height / 2;

                // 计算缩放中心相对于面板中心的位置
                const pinchCenterX = center.x - panelCenterX;
                const pinchCenterY = center.y - panelCenterY;

                // 计算双指中心的移动
                const dx = center.x - touchStateRef.current.lastCenter.x;
                const dy = center.y - touchStateRef.current.lastCenter.y;

                if (newScale > 1) {
                    // 以双指中心为缩放中心
                    // 补偿缩放产生的位移: M_vis * (1 - K)
                    // 加上拖动产生的位移: dx
                    const actualScaleChange = newScale / oldScale;
                    transformRef.current.x = transformRef.current.x + pinchCenterX * (1 - actualScaleChange) + dx;
                    transformRef.current.y = transformRef.current.y + pinchCenterY * (1 - actualScaleChange) + dy;
                } else {
                    transformRef.current.x = 0;
                    transformRef.current.y = 0;
                }
            }

            transformRef.current.scale = newScale;
            touchStateRef.current.lastDistance = distance;
            touchStateRef.current.lastCenter = center;

            updateTransform();
        } else if (touches.length === 1 && touchStateRef.current.isDragging && transformRef.current.scale > 1) {
            // 单指拖动
            if (e.cancelable) e.preventDefault();
            const dx = touches[0].clientX - touchStateRef.current.lastSingleTouch.x;
            const dy = touches[0].clientY - touchStateRef.current.lastSingleTouch.y;

            // 检测是否有明显移动（超过10像素认为是拖动）
            const totalDx = touches[0].clientX - touchStateRef.current.startSingleTouch.x;
            const totalDy = touches[0].clientY - touchStateRef.current.startSingleTouch.y;
            if (Math.abs(totalDx) > 10 || Math.abs(totalDy) > 10) {
                touchStateRef.current.hasMoved = true;
            }

            transformRef.current.x += dx;
            transformRef.current.y += dy;

            touchStateRef.current.lastSingleTouch = {
                x: touches[0].clientX,
                y: touches[0].clientY
            };

            updateTransform();
        }
    }, [updateTransform]);

    const handleNativeTouchEnd = useCallback((e: TouchEvent) => {
        const remainingTouches = e.touches.length;

        if (remainingTouches === 0) {
            // 检测是否是单击（没有移动、不是双指操作、且在缩放状态下）
            if (transformRef.current.scale > 1 &&
                !touchStateRef.current.hasMoved &&
                !touchStateRef.current.wasPinching &&  // 排除刚刚结束的双指操作
                onCardTap) {
                // 计算点击位置对应的canvas坐标
                const canvas = canvasRef.current;
                const panel = panelRef.current;
                if (canvas && panel) {
                    const { startSingleTouch } = touchStateRef.current;
                    const { scale, x, y } = transformRef.current;

                    const panelRect = panel.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();

                    // 计算点击位置相对于canvas的位置（考虑缩放和平移）
                    const canvasScaleX = canvas.width / canvasRect.width;
                    const canvasScaleY = canvas.height / canvasRect.height;

                    // 点击位置相对于canvas元素的位置
                    const clickX = (startSingleTouch.x - canvasRect.left) * canvasScaleX;
                    const clickY = (startSingleTouch.y - canvasRect.top) * canvasScaleY;

                    // 检查点击了哪张卡片
                    for (let i = recognizedCards.length - 1; i >= 0; i--) {
                        const card = recognizedCards[i];
                        if (clickX >= card.box.x1 && clickX <= card.box.x2 &&
                            clickY >= card.box.y1 && clickY <= card.box.y2) {
                            onCardTap(i);
                            break;
                        }
                    }
                }
            }

            touchStateRef.current.isPinching = false;
            touchStateRef.current.isDragging = false;
            touchStateRef.current.wasPinching = false;  // 重置双指操作标记

            // 如果缩放回到1，重置平移
            if (transformRef.current.scale <= 1) {
                transformRef.current = { scale: 1, x: 0, y: 0 };
                updateTransform();
            }
        } else if (remainingTouches === 1 && touchStateRef.current.isPinching) {
            // 从双指变成单指，标记为刚结束双指操作
            touchStateRef.current.isPinching = false;
            touchStateRef.current.wasPinching = true;  // 保持标记，防止松开最后一指时触发点击
            if (transformRef.current.scale > 1) {
                touchStateRef.current.isDragging = true;
                touchStateRef.current.lastSingleTouch = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                touchStateRef.current.startSingleTouch = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                touchStateRef.current.hasMoved = false;
            }
        }

        touchStateRef.current.touchCount = remainingTouches;
    }, [updateTransform, onCardTap, recognizedCards, canvasRef]);

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

    // PC端滚轮缩放
    // PC端滚轮缩放 - 使用非被动事件监听器以支持 preventDefault
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const onWheel = (e: WheelEvent) => {
            // 只有当鼠标在 panel 内部时才处理缩放，避免阻止 Sidebar 滚动
            if (!panel.contains(e.target as Node)) {
                return;
            }
            e.preventDefault();

            // 使用指数平滑缩放
            const sensitivity = 0.001;
            const delta = Math.exp(-e.deltaY * sensitivity);

            const oldScale = transformRef.current.scale;
            const newScale = Math.min(Math.max(oldScale * delta, 1), 5);

            // 以鼠标位置为中心缩放
            // 获取面板当前的屏幕位置
            const rect = panel.getBoundingClientRect();

            // 面板中心点在屏幕上的坐标 (transform-origin 默认为 center)
            const panelCenterX = rect.left + rect.width / 2;
            const panelCenterY = rect.top + rect.height / 2;

            // 鼠标相对于面板中心的向量
            const mouseX = e.clientX - panelCenterX;
            const mouseY = e.clientY - panelCenterY;

            // 计算缩放比例变化
            const scaleChange = newScale / oldScale;

            if (newScale > 1) {
                // 更新平移量，保持鼠标下的点位置不变
                // 公式: NewTranslate = OldTranslate + MouseVector * (1 - ScaleFactor)
                transformRef.current.x += mouseX * (1 - scaleChange);
                transformRef.current.y += mouseY * (1 - scaleChange);
            } else {
                // 缩放回 1 时重置位置
                transformRef.current.x = 0;
                transformRef.current.y = 0;
            }

            transformRef.current.scale = newScale;
            updateTransform();
        };

        panel.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            panel.removeEventListener('wheel', onWheel);
        };
    }, [updateTransform]);

    // 移动端触摸事件 - 使用非被动事件监听器以支持 preventDefault
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        panel.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
        panel.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
        panel.addEventListener('touchend', handleNativeTouchEnd, { passive: true });

        return () => {
            panel.removeEventListener('touchstart', handleNativeTouchStart);
            panel.removeEventListener('touchmove', handleNativeTouchMove);
            panel.removeEventListener('touchend', handleNativeTouchEnd);
        };
    }, [handleNativeTouchStart, handleNativeTouchMove, handleNativeTouchEnd]);

    // PC端鼠标拖动开始
    const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
        // 左键点击时启用拖动（无论是否缩放）
        if (e.button === 0) {
            mouseStateRef.current.isDragging = true;
            mouseStateRef.current.lastMousePos = { x: e.clientX, y: e.clientY };
            setIsPanDragging(true);
            e.preventDefault();
        }
    }, []);

    // PC端鼠标拖动移动
    const handlePanelMouseMove = useCallback((e: React.MouseEvent) => {
        if (mouseStateRef.current.isDragging) {
            const dx = e.clientX - mouseStateRef.current.lastMousePos.x;
            const dy = e.clientY - mouseStateRef.current.lastMousePos.y;

            transformRef.current.x += dx;
            transformRef.current.y += dy;

            mouseStateRef.current.lastMousePos = { x: e.clientX, y: e.clientY };
            updateTransform();
        }
    }, [updateTransform]);

    // PC端鼠标拖动结束
    const handlePanelMouseUp = useCallback(() => {
        mouseStateRef.current.isDragging = false;
        setIsPanDragging(false);
    }, []);

    // PC端鼠标离开
    const handlePanelMouseLeave = useCallback(() => {
        mouseStateRef.current.isDragging = false;
        setIsPanDragging(false);
    }, []);

    // PC端双击重置
    const lastClickRef = useRef(0);
    const handlePanelDoubleClick = useCallback((e: React.MouseEvent) => {
        // 只有点击的是 panel 本身（不是 canvas）时才触发双击重置
        if (e.target !== panelRef.current) return;

        const now = Date.now();
        if (now - lastClickRef.current < 300) {
            // 双击检测 - 重置
            transformRef.current = { scale: 1, x: 0, y: 0 };
            updateTransform();
        }
        lastClickRef.current = now;
    }, [updateTransform]);

    // 点击背景处理（PC端）
    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        // 只有点击容器本身（不是panel或canvas）时才触发
        if (e.target === containerRef.current && onBackgroundClick) {
            onBackgroundClick();
        }
    }, [onBackgroundClick, containerRef]);

    return (
        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 bg-[var(--background-secondary)]"
            style={{ paddingBottom: 'max(4rem, 15%)' }}
            onClick={handleContainerClick}
        >
            {/* Canvas面板 */}
            <div
                ref={panelRef}
                className={`panel panel-elevated overflow-hidden relative ${isDragging ? 'scale-[1.005]' : ''} ${isPanDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    touchAction: 'none',
                    willChange: 'transform'
                }}
                onTouchStart={handleDoubleTap}

                onMouseDown={handlePanelMouseDown}
                onMouseMove={handlePanelMouseMove}
                onMouseUp={handlePanelMouseUp}
                onMouseLeave={handlePanelMouseLeave}
                onClick={handlePanelDoubleClick}
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
                {/* SVG 边框覆盖层 */}
                {originalImage && canvasSize.renderW > 0 && (
                    <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        width={canvasSize.renderW}
                        height={canvasSize.renderH}
                        style={{ overflow: 'visible' }}
                    >
                        {recognizedCards.map((card, i) => {
                            const { box } = card;
                            const isSelected = i === selectedCardIndex;
                            const isIdentified = card.matches.length > 0;

                            // 计算缩放比例
                            const scaleX = canvasSize.renderW / originalImage.width;
                            const scaleY = canvasSize.renderH / originalImage.height;

                            // 计算边框位置和尺寸
                            const x = box.x1 * scaleX;
                            const y = box.y1 * scaleY;
                            const width = (box.x2 - box.x1) * scaleX;
                            const height = (box.y2 - box.y1) * scaleY;

                            // 根据状态设置样式
                            let strokeColor: string;
                            let strokeWidth: number;
                            let fillColor: string;

                            if (isSelected) {
                                strokeColor = '#8b5cf6';
                                strokeWidth = isDragging ? 3 : 2;
                                fillColor = 'rgba(139, 92, 246, 0.15)';
                            } else if (isIdentified) {
                                strokeColor = 'rgba(16, 185, 129, 0.8)';
                                strokeWidth = 1.5;
                                fillColor = 'rgba(16, 185, 129, 0.08)';
                            } else {
                                strokeColor = 'rgba(148, 163, 184, 0.6)';
                                strokeWidth = 1.5;
                                fillColor = 'transparent';
                            }

                            return (
                                <rect
                                    key={i}
                                    x={x}
                                    y={y}
                                    width={width}
                                    height={height}
                                    fill={fillColor}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    vectorEffect="non-scaling-stroke"
                                />
                            );
                        })}
                    </svg>
                )}
            </div>
        </div>
    );
}
