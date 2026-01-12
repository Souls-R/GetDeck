import React, { useEffect, useRef, useState } from 'react';

interface BottomDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: string;
}

export default function BottomDrawer({
    isOpen,
    onClose,
    title,
    children,
    maxHeight = '70vh'
}: BottomDrawerProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            requestAnimationFrame(() => {
                setIsAnimating(true);
            });
        } else {
            setIsAnimating(false);
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // 触摸拖拽关闭
    const handleTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        currentY.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaY = e.touches[0].clientY - startY.current;
        if (deltaY > 0) {
            currentY.current = deltaY;
            if (drawerRef.current) {
                drawerRef.current.style.transform = `translateY(${deltaY}px)`;
            }
        }
    };

    const handleTouchEnd = () => {
        if (currentY.current > 100) {
            onClose();
        }
        if (drawerRef.current) {
            drawerRef.current.style.transform = '';
        }
        currentY.current = 0;
    };

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* 背景遮罩 */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                    isAnimating ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            {/* 抽屉内容 */}
            <div
                ref={drawerRef}
                className={`absolute bottom-0 left-0 right-0 bg-[var(--card-bg)] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
                    isAnimating ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ maxHeight }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* 拖拽指示条 */}
                <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-1 rounded-full bg-[var(--foreground-muted)]/30" />
                </div>

                {/* 标题 */}
                {title && (
                    <div className="px-4 pb-3 border-b border-[var(--card-border)]">
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
                    </div>
                )}

                {/* 内容区域 */}
                <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
