import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecognizedCard } from '../../types';
import { globalCardInfoCache, isExtraDeck } from '../../utils/cardApi';
import { useTranslation } from '@/app/i18n';

interface YdkCanvasProps {
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    onCardClick: (index: number) => void;
    isMobile?: boolean;
}

export default function YdkCanvas({ recognizedCards, selectedCardIndex, onCardClick, isMobile = false }: YdkCanvasProps) {
    const { t } = useTranslation();
    // 分离主卡组和额外卡组
    const mainDeck: { card: RecognizedCard; index: number; baigeId?: number }[] = [];
    const extraDeck: { card: RecognizedCard; index: number; baigeId?: number }[] = [];

    recognizedCards.forEach((card, index) => {
        const match = card.matches[card.selectedMatchIndex];
        if (!match) return;
        const cardInfo = globalCardInfoCache[match.name];
        const baigeId = cardInfo?.password;

        if (isExtraDeck(cardInfo)) {
            extraDeck.push({ card, index, baigeId });
        } else {
            mainDeck.push({ card, index, baigeId });
        }
    });

    // PC端卡片高度状态
    const [cardHeight, setCardHeight] = useState<number | null>(null);
    const [baseCardHeight, setBaseCardHeight] = useState<number | null>(null);
    const [autoSizeCalculated, setAutoSizeCalculated] = useState(false);
    const cardGridRef = useRef<HTMLDivElement>(null);

    const mainCardsPerRow = mainDeck.length <= 50 ? 10 : mainDeck.length >= 60 ? 12 : 11;

    // 计算卡片高度，使所有卡片在一屏内显示（仅 PC 端）
    useEffect(() => {
        if (recognizedCards.length === 0 || autoSizeCalculated || isMobile) return;

        const calculateCardHeight = () => {
            const container = cardGridRef.current;
            if (!container) return false;

            const containerHeight = container.clientHeight - 32;
            if (containerHeight <= 0) return false;

            const mainRows = Math.ceil(mainDeck.length / mainCardsPerRow);
            const extraRows = Math.ceil(extraDeck.length / 10);

            const gap = 2;
            const headerHeight = 28;
            const sectionGap = 16;

            const totalRows = mainRows + extraRows;
            const fixedHeight = headerHeight + (extraDeck.length > 0 ? sectionGap + headerHeight : 0);
            const totalGaps = Math.max(0, mainRows - 1) * gap + (extraDeck.length > 0 ? Math.max(0, extraRows - 1) * gap : 0);
            const availableHeight = containerHeight - fixedHeight - totalGaps;

            const calculatedCardHeight = availableHeight / totalRows * 0.95;
            const finalHeight = Math.max(60, calculatedCardHeight);
            setCardHeight(finalHeight);
            setBaseCardHeight(finalHeight);

            return true;
        };

        let retryCount = 0;
        const maxRetries = 10;

        const tryCalculate = () => {
            if (calculateCardHeight()) {
                setAutoSizeCalculated(true);
            } else if (retryCount < maxRetries) {
                retryCount++;
                requestAnimationFrame(tryCalculate);
            }
        };

        const frameId = requestAnimationFrame(tryCalculate);
        return () => cancelAnimationFrame(frameId);
    }, [recognizedCards.length, autoSizeCalculated, isMobile, mainDeck.length, extraDeck.length, mainCardsPerRow]);

    // 滚轮缩放处理 - 仅 PC 端
    useEffect(() => {
        if (isMobile) return;
        const container = cardGridRef.current;
        if (!container || recognizedCards.length === 0) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -5 : 5;
            setCardHeight(prev => prev ? Math.max(40, Math.min(200, prev + delta)) : 80);
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [isMobile, recognizedCards.length]);

    const renderCard = (item: { card: RecognizedCard; index: number; baigeId?: number }) => {
        const match = item.card.matches[item.card.selectedMatchIndex];
        if (!match) return null;
        const isSelected = item.index === selectedCardIndex;

        return (
            <div
                key={item.index}
                onClick={() => onCardClick(item.index)}
                className={`relative cursor-pointer transition-all duration-150 ${
                    isSelected ? 'ring-2 ring-[var(--primary)] scale-105 z-10' : 'hover:brightness-110'
                }`}
                style={!isMobile && cardHeight ? { height: `${cardHeight}px` } : undefined}
            >
                {item.baigeId ? (
                    <img
                        src={`https://cdn.233.momobako.com/ygoimg/sc/${item.baigeId}.webp`}
                        alt={match.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full aspect-[59/86] bg-[var(--background-secondary)] rounded-sm flex items-center justify-center">
                        <span className="text-xs text-[var(--foreground-muted)] text-center px-1 line-clamp-2">{match.name}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={cardGridRef}
            className={`flex-1 overflow-auto p-4 bg-[var(--background-secondary)] ${!isMobile ? 'flex flex-col items-center' : ''}`}
            onClick={(e) => {
                // 点击空白区域返回列表
                const target = e.target as HTMLElement;
                if (target === e.currentTarget || target.classList.contains('space-y-4')) {
                    onCardClick(-1);
                }
            }}
        >
            <div className={`space-y-4 select-none ${isMobile ? 'w-full' : ''}`}>
                {/* 主卡组 */}
                {mainDeck.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-purple-500" />
                            <span className="text-xs font-medium text-[var(--foreground-muted)]">{t('deck.mainDeck')}</span>
                            <span className="text-xs text-[var(--foreground-muted)]">{mainDeck.length}</span>
                        </div>
                        <div
                            className="grid gap-0.5"
                            style={isMobile ? {
                                gridTemplateColumns: `repeat(${mainCardsPerRow}, 1fr)`
                            } : {
                                gridTemplateColumns: cardHeight
                                    ? `repeat(${mainCardsPerRow}, ${Math.round(cardHeight * 59 / 86)}px)`
                                    : `repeat(${mainCardsPerRow}, minmax(0, 1fr))`
                            }}
                        >
                            {mainDeck.map(renderCard)}
                        </div>
                    </div>
                )}

                {/* 额外卡组 */}
                {extraDeck.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 rounded-full bg-[var(--primary)]" />
                            <span className="text-xs font-medium text-[var(--foreground-muted)]">{t('deck.extraDeck')}</span>
                            <span className="text-xs text-[var(--foreground-muted)]">{extraDeck.length}</span>
                        </div>
                        <div
                            className="grid gap-0.5"
                            style={isMobile ? {
                                gridTemplateColumns: 'repeat(10, 1fr)'
                            } : {
                                gridTemplateColumns: cardHeight
                                    ? `repeat(10, ${Math.round(cardHeight * 59 / 86)}px)`
                                    : 'repeat(10, minmax(0, 1fr))'
                            }}
                        >
                            {extraDeck.map(renderCard)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
