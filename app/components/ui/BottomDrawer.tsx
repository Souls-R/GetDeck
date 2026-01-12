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
    const [overlayVisible, setOverlayVisible] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);
    const canDragClose = useRef(false);
    const isClosingByDragRef = useRef(false);

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
        currentY.current = 0;
        const content = contentRef.current;
        canDragClose.current = !content || content.scrollTop <= 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!canDragClose.current) return;

        const deltaY = e.touches[0].clientY - startY.current;
        if (deltaY > 0) {
            currentY.current = deltaY;
            if (drawerRef.current) {
                const dampedY = deltaY * 0.5;
                drawerRef.current.style.transform = `translateY(${dampedY}px)`;
            }
        }
    };

    const handleTouchEnd = () => {
        if (!canDragClose.current) {
            currentY.current = 0;
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

                <div ref={contentRef} className="overflow-y-auto custom-scrollbar" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
