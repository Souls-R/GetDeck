import React, { useRef, useCallback, useEffect, useMemo } from 'react';

interface MobileCardCarouselProps<T> {
    items: T[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
    renderItem: (item: T, index: number, isActive: boolean) => React.ReactNode;
    keyExtractor: (item: T, index: number) => string | number;
    showIndicator?: boolean;
}

export default function MobileCardCarousel<T>({
    items,
    currentIndex,
    onIndexChange,
    renderItem,
    keyExtractor,
    showIndicator = true
}: MobileCardCarouselProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // 触摸状态 - 全部用 ref 避免重渲染
    const touchState = useRef({
        startX: 0,
        startY: 0,
        currentX: 0,
        startTime: 0,
        isDragging: false,
        direction: null as 'horizontal' | 'vertical' | null,
        hasDecidedDirection: false
    });

    // 当前索引的 ref（用于事件处理器中访问最新值）
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    // 直接操作 DOM 更新 transform，避免 React 重渲染
    const updateTrackPosition = useCallback((offset: number, animate: boolean, duration: number = 250) => {
        if (!trackRef.current) return;

        // 取消之前的动画帧
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        const baseTranslate = -currentIndexRef.current * 100;
        const containerWidth = containerRef.current?.offsetWidth || 300;
        const offsetPercent = (offset / containerWidth) * 100;

        trackRef.current.style.transition = animate ? `transform ${duration}ms ease-out` : 'none';
        trackRef.current.style.transform = `translateX(calc(${baseTranslate}% + ${offsetPercent}%))`;
    }, []);

    // 处理触摸开始 - 允许打断动画
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];

        // 立即停止当前动画
        if (trackRef.current) {
            const computedStyle = window.getComputedStyle(trackRef.current);
            const matrix = new DOMMatrix(computedStyle.transform);
            trackRef.current.style.transition = 'none';
            trackRef.current.style.transform = `translateX(${matrix.m41}px)`;
        }

        touchState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            startTime: Date.now(),
            isDragging: true,
            direction: null,
            hasDecidedDirection: false
        };
    }, []);

    // 处理触摸移动 - 直接操作 DOM
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchState.current.isDragging) return;

        const touch = e.touches[0];
        const dx = touch.clientX - touchState.current.startX;
        const dy = touch.clientY - touchState.current.startY;

        // 首次移动时决定方向
        if (!touchState.current.hasDecidedDirection) {
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // 需要移动超过 5px 才决定方向（降低阈值提高响应速度）
            if (absDx > 5 || absDy > 5) {
                touchState.current.hasDecidedDirection = true;
                touchState.current.direction = absDx >= absDy ? 'horizontal' : 'vertical';

                // 如果是垂直滑动，立即结束拖拽状态
                if (touchState.current.direction === 'vertical') {
                    touchState.current.isDragging = false;
                    return;
                }
            }
        }

        // 只处理水平滑动
        if (touchState.current.direction === 'horizontal') {
            e.preventDefault();
            e.stopPropagation();

            touchState.current.currentX = touch.clientX;

            let offset = dx;
            const idx = currentIndexRef.current;

            // 边界阻尼效果
            if ((idx === 0 && dx > 0) || (idx === items.length - 1 && dx < 0)) {
                offset = Math.sign(dx) * Math.min(Math.abs(dx) * 0.3, 50);
            }

            // 直接更新 DOM，不触发 React 重渲染
            updateTrackPosition(offset, false);
        }
    }, [items.length, updateTrackPosition]);

    // 处理触摸结束
    const handleTouchEnd = useCallback(() => {
        if (!touchState.current.isDragging && touchState.current.direction !== 'horizontal') {
            // 垂直滑动或未开始拖拽，重置状态
            touchState.current = {
                startX: 0,
                startY: 0,
                currentX: 0,
                startTime: 0,
                isDragging: false,
                direction: null,
                hasDecidedDirection: false
            };
            return;
        }

        const dx = touchState.current.currentX - touchState.current.startX;
        const dt = Date.now() - touchState.current.startTime;
        const velocity = dt > 0 ? Math.abs(dx) / dt : 0;

        const containerWidth = containerRef.current?.offsetWidth || 300;
        const threshold = containerWidth * 0.2; // 降低阈值，更容易触发切换

        let newIndex = currentIndexRef.current;

        // 只在水平滑动时处理切换
        if (touchState.current.direction === 'horizontal') {
            // 快速滑动（速度 > 0.3px/ms）或滑动距离超过阈值
            if (velocity > 0.3 || Math.abs(dx) > threshold) {
                if (dx > 0 && currentIndexRef.current > 0) {
                    newIndex = currentIndexRef.current - 1;
                } else if (dx < 0 && currentIndexRef.current < items.length - 1) {
                    newIndex = currentIndexRef.current + 1;
                }
            }
        }

        // 重置触摸状态
        touchState.current = {
            startX: 0,
            startY: 0,
            currentX: 0,
            startTime: 0,
            isDragging: false,
            direction: null,
            hasDecidedDirection: false
        };

        // 计算动画时间：根据剩余距离动态调整，最短100ms，最长250ms
        const remainingDistance = Math.abs(dx);
        const animDuration = Math.max(100, Math.min(250, remainingDistance * 0.8));

        // 动画回到目标位置
        updateTrackPosition(0, true, animDuration);

        if (newIndex !== currentIndexRef.current) {
            onIndexChange(newIndex);
        }
    }, [items.length, onIndexChange, updateTrackPosition]);

    // 处理触摸取消
    const handleTouchCancel = useCallback(() => {
        touchState.current = {
            startX: 0,
            startY: 0,
            currentX: 0,
            startTime: 0,
            isDragging: false,
            direction: null,
            hasDecidedDirection: false
        };
        updateTrackPosition(0, true, 150);
    }, [updateTrackPosition]);

    // 当 currentIndex 从外部改变时，更新位置
    useEffect(() => {
        updateTrackPosition(0, true, 250);
    }, [currentIndex, updateTrackPosition]);

    // 计算可见卡片索引 - 使用 useMemo 避免重复计算
    const visibleIndices = useMemo(() => {
        const indices: number[] = [];
        for (let i = Math.max(0, currentIndex - 1); i <= Math.min(items.length - 1, currentIndex + 1); i++) {
            indices.push(i);
        }
        return indices;
    }, [currentIndex, items.length]);

    // 预渲染卡片内容 - 使用 useMemo 缓存
    const renderedItems = useMemo(() => {
        return items.map((item, index) => {
            const isVisible = visibleIndices.includes(index);
            const isActive = index === currentIndex;

            return (
                <div
                    key={keyExtractor(item, index)}
                    className="w-full h-full flex-shrink-0 overflow-y-auto"
                    style={{
                        visibility: isVisible ? 'visible' : 'hidden'
                    }}
                >
                    {isVisible && renderItem(item, index, isActive)}
                </div>
            );
        });
    }, [items, currentIndex, visibleIndices, keyExtractor, renderItem]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            style={{ touchAction: 'pan-y pinch-zoom' }}
        >
            <div
                ref={trackRef}
                className="flex h-full"
                style={{
                    transform: `translateX(${-currentIndex * 100}%)`,
                    willChange: 'transform'
                }}
            >
                {renderedItems}
            </div>

            {/* 页码指示器 */}
            {showIndicator && items.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                    {items.map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 rounded-full transition-all duration-200 ${
                                index === currentIndex
                                    ? 'bg-white w-4'
                                    : 'bg-white/50 w-1.5'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
