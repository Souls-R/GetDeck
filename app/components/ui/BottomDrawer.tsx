import React, { useEffect, useRef, useState } from 'react';

interface BottomDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: string;
    enableHorizontalSwipe?: boolean;
}

export default function BottomDrawer({
    isOpen,
    onClose,
    title,
    children,
    maxHeight = '70vh',
    enableHorizontalSwipe = false
}: BottomDrawerProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startX = useRef(0);
    const currentY = useRef(0);
    const canDragClose = useRef(false);
    const isClosingByDragRef = useRef(false);

    // 手势方向判断
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const hasDecidedDirection = useRef(false);

    useEffect(() => {
        if (isOpen) {
            isClosingByDragRef.current = false;
            setShouldRender(true);
            setOverlayVisible(true);
            requestAnimationFrame(() => {
                setIsAnimating(true);
            });
        } else {
            if (isClosingByDragRef.current) {
                setShouldRender(false);
                setOverlayVisible(false);
                isClosingByDragRef.current = false;
            } else {
                setIsAnimating(false);
                setOverlayVisible(false);
                const timer = setTimeout(() => {
                    setShouldRender(false);
                }, 200);
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
        currentY.current = 0;

        // 重置方向判断
        gestureDirection.current = null;
        hasDecidedDirection.current = false;

        const content = contentRef.current;
        canDragClose.current = !content || content.scrollTop <= 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaY = e.touches[0].clientY - startY.current;
        const deltaX = e.touches[0].clientX - startX.current;

        // 首次移动时决定方向
        if (!hasDecidedDirection.current) {
            const absDx = Math.abs(deltaX);
            const absDy = Math.abs(deltaY);

            // 需要移动超过 10px 才决定方向
            if (absDx > 10 || absDy > 10) {
                hasDecidedDirection.current = true;
                gestureDirection.current = absDx > absDy ? 'horizontal' : 'vertical';
            }
        }

        // 如果启用了水平滑动且检测到水平方向，不处理下拉关闭
        if (enableHorizontalSwipe && gestureDirection.current === 'horizontal') {
            return;
        }

        // 只处理垂直方向的下拉关闭
        if (gestureDirection.current !== 'vertical') {
            return;
        }

        if (!canDragClose.current) return;

        if (deltaY > 0) {
            currentY.current = deltaY;
            if (drawerRef.current) {
                const dampedY = deltaY * 0.5;
                drawerRef.current.style.transform = `translateY(${dampedY}px)`;
            }
        }
    };

    const handleTouchEnd = () => {
        // 如果是水平滑动，不处理
        if (enableHorizontalSwipe && gestureDirection.current === 'horizontal') {
            gestureDirection.current = null;
            hasDecidedDirection.current = false;
            return;
        }

        if (!canDragClose.current) {
            currentY.current = 0;
            gestureDirection.current = null;
            hasDecidedDirection.current = false;
            return;
        }

        if (drawerRef.current) {
            if (currentY.current > 150) {
                isClosingByDragRef.current = true;
                setOverlayVisible(false);
                drawerRef.current.style.transition = 'transform 0.2s ease-out';
                drawerRef.current.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    onClose();
                }, 200);
            } else {
                drawerRef.current.style.transition = 'transform 0.2s ease-out';
                drawerRef.current.style.transform = '';
                setTimeout(() => {
                    if (drawerRef.current) {
                        drawerRef.current.style.transition = '';
                    }
                }, 200);
            }
        }
        currentY.current = 0;
        gestureDirection.current = null;
        hasDecidedDirection.current = false;
    };

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
                    overlayVisible ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            <div
                ref={drawerRef}
                className={`absolute bottom-0 left-0 right-0 bg-[var(--card-bg)] rounded-t-2xl shadow-2xl ${
                    isClosingByDragRef.current ? '' : 'transition-transform duration-200 ease-out'
                } ${
                    isAnimating ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ maxHeight }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--foreground-muted)]/30" />
                </div>

                {title && (
                    <div className="px-4 pb-3 border-b border-[var(--card-border)]">
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
                    </div>
                )}

                <div
                    ref={contentRef}
                    className="overflow-y-auto custom-scrollbar"
                    style={{ maxHeight: `calc(${maxHeight} - 60px)` }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
