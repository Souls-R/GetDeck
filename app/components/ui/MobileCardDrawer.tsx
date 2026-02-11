import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import { ProcessingStage } from '../../hooks/useRecognition';
import MobileCardCarousel from './MobileCardCarousel';
import HoloCard from './HoloCard';
import { useTranslation } from '@/app/i18n';
import { getCardBadges } from '../../utils/cardApi';
import { getLocalizedCardName, getLocalizedCardText } from '../../i18n/cardName';

// 视图模式：列表或详情
type ViewMode = 'list' | 'detail';
// 进入详情的来源：画布或列表
type EntryPoint = 'canvas' | 'list';

interface MobileCardDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    processingStage: ProcessingStage;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    onSelectCard: (index: number, fromList?: boolean) => void;
    scrollPosition: number;
    onScrollPositionChange: (position: number) => void;
    onGenerateDeckCode: () => void;
    isGeneratingDeckCode: boolean;
    onShare: () => void;
    onExportYdk: () => void;
    isExportingYdk: boolean;
    ydkExported: boolean;
    getCardInfo: (cardName: string) => CardInfo | null;
    isDetailLoading: boolean;
    getCardArtwork: (index: number) => string | null;
    forcePendulumMode: boolean;
    onToggleCardMode: () => void;
    onSelectAltMatch: (matchIndex: number) => void;
    onMoveCardBox: (direction: 'up' | 'down' | 'left' | 'right') => void;
    // 初始视图：从画布点击时是detail，从按钮打开时是list
    initialViewMode?: ViewMode;
    // 当请求显示详情时，传入entry point
    entryPoint?: EntryPoint;
}

// 格式化卡片描述文字
function formatCardDesc(desc: string): string {
    if (!desc) return '';
    return desc.replace(/([^\n])(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)(?=：|:)/g, '$1\n$2');
}

// 带渐变过渡的图片组件
function FadeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
    const [displaySrc, setDisplaySrc] = useState(src);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (src !== displaySrc) {
            setIsTransitioning(true);
            const timer = setTimeout(() => {
                setDisplaySrc(src);
                setIsTransitioning(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [src, displaySrc]);

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'} ${className || ''}`}
            draggable={false}
        />
    );
}

export default function MobileCardDrawer({
    isOpen,
    onClose,
    processingStage,
    recognizedCards,
    selectedCardIndex,
    onSelectCard,
    scrollPosition,
    onScrollPositionChange,
    onGenerateDeckCode,
    isGeneratingDeckCode,
    onShare,
    onExportYdk,
    isExportingYdk,
    ydkExported,
    getCardInfo,
    isDetailLoading,
    getCardArtwork,
    forcePendulumMode,
    onToggleCardMode,
    onSelectAltMatch,
    onMoveCardBox,
    initialViewMode = 'list',
    entryPoint = 'list'
}: MobileCardDrawerProps) {
    const { t, locale } = useTranslation();
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // 视图状态
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [currentEntryPoint, setCurrentEntryPoint] = useState<EntryPoint>(entryPoint);

    // 视图切换动画状态
    const [isViewTransitioning, setIsViewTransitioning] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');

    // 窥视状态：从画布进入时先显示30vh，触摸后展开到80vh
    const [isPeeking, setIsPeeking] = useState(false);

    // 高度计算
    const getDrawerHeight = () => {
        if (currentEntryPoint === 'list') return '92vh';
        if (isPeeking) return '35vh';
        return '80vh';
    };
    const drawerHeight = getDrawerHeight();

    // refs
    const drawerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const cardListScrollRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startX = useRef(0);
    const currentY = useRef(0);
    const canDragClose = useRef(false);
    const isClosingByDragRef = useRef(false);
    const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null);
    const hasDecidedDirection = useRef(false);

    // 识别源面板状态
    const [showSourcePanel, setShowSourcePanel] = useState(false);

    // ydkExported 变为 false 时关闭菜单
    useEffect(() => {
        if (!ydkExported && !isExportingYdk) {
            setShowExportMenu(false);
        }
    }, [ydkExported, isExportingYdk]);

    // 详情视图的当前卡片信息
    const currentCard = recognizedCards[selectedCardIndex];
    const currentMatch = currentCard?.matches?.[currentCard?.selectedMatchIndex];
    const cardInfo = currentMatch ? getCardInfo(currentMatch.name) : null;
    const artwork = getCardArtwork(selectedCardIndex);

    // 卡片名称渐变动画
    const [displayName, setDisplayName] = useState(currentMatch?.name || '');
    const [isNameFading, setIsNameFading] = useState(false);

    // 徽章渐变动画
    const [displayBadges, setDisplayBadges] = useState<string[]>([]);
    const [isBadgesFading, setIsBadgesFading] = useState(false);
    const prevTypesRef = useRef<string | undefined>(undefined);

    // 同步initialViewMode和entryPoint（当从外部触发变化时）
    useEffect(() => {
        if (isOpen) {
            setViewMode(initialViewMode);
            setCurrentEntryPoint(entryPoint);
            // 从画布进入时，初始为窥视状态
            if (entryPoint === 'canvas') {
                setIsPeeking(true);
            } else {
                setIsPeeking(false);
            }
        }
    }, [isOpen, initialViewMode, entryPoint]);



    // 抽屉开关动画
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
                    // 重置视图为列表
                    setViewMode('list');
                    setCurrentEntryPoint('list');
                    setIsPeeking(false);
                }, 200);
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen]);

    // 名称淡入淡出
    useEffect(() => {
        const newName = currentMatch ? getLocalizedCardName(cardInfo, currentMatch.name, locale) : '';
        if (newName !== displayName && newName) {
            setIsNameFading(true);
            const timer = setTimeout(() => {
                setDisplayName(newName);
                setIsNameFading(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [currentMatch?.name, cardInfo, locale, displayName]);

    // 徽章淡入淡出
    useEffect(() => {
        const badgeKey = cardInfo ? `${cardInfo.card_type}|${cardInfo.monster_type_line}` : '';
        if (badgeKey !== prevTypesRef.current) {
            prevTypesRef.current = badgeKey;
            const newBadges = cardInfo ? getCardBadges(cardInfo, locale) : [];
            setIsBadgesFading(true);
            const timer = setTimeout(() => {
                setDisplayBadges(newBadges);
                setIsBadgesFading(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [cardInfo, locale]);

    // 滚动保存
    const handleScroll = () => {
        if (cardListScrollRef.current) {
            onScrollPositionChange(cardListScrollRef.current.scrollTop);
        }
    };

    // 恢复滚动位置
    useEffect(() => {
        if (isOpen && viewMode === 'list') {
            setTimeout(() => {
                if (cardListScrollRef.current) {
                    cardListScrollRef.current.scrollTop = scrollPosition;
                }
            }, 0);
        }
    }, [isOpen, viewMode, scrollPosition]);

    // 合并相同卡片
    const cardGroups: { name: string; count: number; indices: number[]; cardType: string }[] = [];
    recognizedCards.forEach((card, index) => {
        const match = card.matches[card.selectedMatchIndex];
        if (!match) return;

        const existing = cardGroups.find(g => g.name === match.name);
        if (existing) {
            existing.count++;
            existing.indices.push(index);
        } else {
            cardGroups.push({
                name: match.name,
                count: 1,
                indices: [index],
                cardType: match.cardType
            });
        }
    });

    // 从列表点击卡片，切换到详情视图
    const handleCardClickFromList = (index: number) => {
        setSlideDirection('left');
        setIsViewTransitioning(true);
        setCurrentEntryPoint('list');

        setTimeout(() => {
            onSelectCard(index, true);
            setViewMode('detail');
            setTimeout(() => {
                setIsViewTransitioning(false);
            }, 250);
        }, 150);
    };

    // 从详情回到列表
    const handleBackToList = useCallback(() => {
        setSlideDirection('right');
        setIsViewTransitioning(true);

        setTimeout(() => {
            setViewMode('list');
            setTimeout(() => {
                setIsViewTransitioning(false);
            }, 250);
        }, 150);
    }, []);

    // 点击遮罩
    const handleOverlayClick = () => {
        if (viewMode === 'detail' && currentEntryPoint === 'list') {
            // 从列表进入详情 -> 返回列表
            handleBackToList();
        } else {
            // 从画布进入或者在列表视图 -> 关闭抽屉
            onClose();
        }
    };

    // 触摸手势处理
    const handleTouchStart = (e: React.TouchEvent) => {
        // 如果是窥视状态，触摸即展开
        if (isPeeking) {
            setIsPeeking(false);
        }

        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
        currentY.current = 0;
        gestureDirection.current = null;
        hasDecidedDirection.current = false;

        const content = contentRef.current;
        canDragClose.current = !content || content.scrollTop <= 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaY = e.touches[0].clientY - startY.current;
        const deltaX = e.touches[0].clientX - startX.current;

        if (!hasDecidedDirection.current) {
            const absDx = Math.abs(deltaX);
            const absDy = Math.abs(deltaY);

            if (absDx > 10 || absDy > 10) {
                hasDecidedDirection.current = true;
                gestureDirection.current = absDx > absDy ? 'horizontal' : 'vertical';
            }
        }

        // 详情视图允许水平滑动（轮播）
        if (viewMode === 'detail' && gestureDirection.current === 'horizontal') {
            return;
        }

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
        if (viewMode === 'detail' && gestureDirection.current === 'horizontal') {
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

    // 轮播相关
    const handleIndexChange = useCallback((newIndex: number) => {
        onSelectCard(newIndex, false);
    }, [onSelectCard]);

    const handleToggleSourcePanel = useCallback(() => {
        setShowSourcePanel(prev => !prev);
    }, []);

    const keyExtractor = useCallback((_card: RecognizedCard, index: number) => {
        return index;
    }, []);

    // 渲染单个卡片详情
    const renderCardContent = useCallback((card: RecognizedCard, index: number, isActive: boolean) => {
        const match = card.matches[card.selectedMatchIndex];
        const info = match ? getCardInfo(match.name) : null;

        return (
            <div className="p-4 space-y-4">
                {info && (
                    <div className="space-y-4">
                        <div className="w-full rounded-xl overflow-visible">
                            <HoloCard
                                src={`https://cdn.233.momobako.com/ygoimg/sc/${info.password}.webp`}
                                alt="Official Art"
                            />
                        </div>

                        {(info.atk !== undefined || info.def !== undefined) && (
                            <div className="flex gap-3">
                                {info.atk !== undefined && (
                                    <div className="flex-1 panel p-3 text-center">
                                        <div className="text-xs text-[var(--foreground-muted)]">ATK</div>
                                        <div className="text-xl font-bold text-[var(--warning)]">
                                            {info.atk}
                                        </div>
                                    </div>
                                )}
                                {info.def !== undefined && (
                                    <div className="flex-1 panel p-3 text-center">
                                        <div className="text-xs text-[var(--foreground-muted)]">DEF</div>
                                        <div className="text-xl font-bold text-[var(--primary)]">
                                            {info.def}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {getLocalizedCardText(info, locale) && (
                            <div className="panel p-3">
                                <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                                    {formatCardDesc(getLocalizedCardText(info, locale))}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {isActive && isDetailLoading && (
                    <div className="flex items-center justify-center py-6">
                        <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                    </div>
                )}

                {card.matches.length > 1 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                            {t('sidebar.altMatches')}
                        </h3>
                        {card.matches.map((m, idx) => (
                            idx !== card.selectedMatchIndex && (
                                <button
                                    key={idx}
                                    onClick={() => onSelectAltMatch(idx)}
                                    className="w-full text-left p-3 rounded-xl bg-[var(--background-secondary)] active:bg-[var(--card-border)] border border-transparent transition-all duration-200"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-[var(--foreground)] truncate flex-1 font-medium">
                                            {m.name}
                                        </span>
                                        <span className="text-xs text-[var(--foreground-muted)] ml-3 font-mono bg-[var(--card-bg)] px-2 py-1 rounded">
                                            {m.distance}
                                        </span>
                                    </div>
                                </button>
                            )
                        ))}
                    </div>
                )}
            </div>
        );
    }, [getCardInfo, isDetailLoading, onSelectAltMatch, locale]);

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-50 ${isPeeking ? 'pointer-events-none' : ''}`}>
            {/* 遮罩 - peek状态下透明且允许点击穿透 */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
                    overlayVisible && !isPeeking ? 'opacity-100' : 'opacity-0'
                } ${isPeeking ? 'pointer-events-none' : ''}`}
                onClick={handleOverlayClick}
            />

            {/* 抽屉主体 */}
            <div
                ref={drawerRef}
                className={`absolute bottom-0 left-0 right-0 bg-[var(--card-bg)] rounded-t-2xl shadow-2xl pointer-events-auto ${
                    isClosingByDragRef.current ? '' : 'transition-[transform,height] duration-250 ease-out'
                } ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ 
                    height: drawerHeight, 
                    willChange: 'transform, height',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* 拖拽指示条 */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--foreground-muted)]/30" />
                </div>

                {/* 内容区域 */}
                <div
                    ref={contentRef}
                    className="overflow-hidden transition-[height] duration-250 ease-out"
                    style={{ height: `calc(${drawerHeight} - 44px)` }}
                >
                    {/* 视图容器 - 用于切换动画 */}
                    <div className="relative w-full h-full">
                        {/* 列表视图 */}
                        <div
                            className={`absolute inset-0 transition-all duration-250 ease-out ${
                                viewMode === 'list'
                                    ? 'opacity-100 translate-x-0'
                                    : isViewTransitioning && slideDirection === 'left'
                                        ? 'opacity-0 -translate-x-full'
                                        : isViewTransitioning && slideDirection === 'right'
                                            ? 'opacity-0 -translate-x-full'
                                            : 'opacity-0 -translate-x-full pointer-events-none'
                            }`}
                            style={{ 
                                visibility: viewMode === 'list' || isViewTransitioning ? 'visible' : 'hidden'
                            }}
                        >
                            {renderListView()}
                        </div>

                        {/* 详情视图 */}
                        <div
                            className={`absolute inset-0 transition-all duration-250 ease-out ${
                                viewMode === 'detail'
                                    ? 'opacity-100 translate-x-0'
                                    : isViewTransitioning && slideDirection === 'left'
                                        ? 'opacity-0 translate-x-full'
                                        : isViewTransitioning && slideDirection === 'right'
                                            ? 'opacity-0 translate-x-full'
                                            : 'opacity-0 translate-x-full pointer-events-none'
                            }`}
                            style={{ 
                                visibility: viewMode === 'detail' || isViewTransitioning ? 'visible' : 'hidden'
                            }}
                        >
                            {renderDetailView()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 列表视图渲染
    function renderListView() {
        return (
            <div className="flex flex-col h-full overflow-y-auto">
                {/* 处理中状态 */}
                {processingStage === 'identifying' && (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-10 h-10 rounded-full border-2 border-(--card-border) border-t-(--primary) animate-spin mb-4" />
                        <p className="text-foreground font-medium">{t('sidebar.recognizing')}</p>
                    </div>
                )}

                {/* 卡片列表 */}
                {processingStage === 'done' && (
                    <div className="flex flex-col h-full">
                        {/* 头部统计 */}
                        <div className="p-4 border-b border-(--card-border) bg-gradient-card shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow">
                                        <span className="text-lg font-bold text-white">{recognizedCards.length}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-foreground">{t('sidebar.recognitionDone')}</h2>
                                        <p className="text-xs text-(--foreground-muted)">{t('sidebar.cardTypes', { count: cardGroups.length })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* 分享按钮 */}
                                    <button
                                        onClick={onShare}
                                        className="p-1.5 rounded-lg bg-(--background-secondary) text-(--foreground-muted) hover:text-(--foreground) active:bg-(--card-border) transition-colors"
                                        title={t('sidebar.shareDeck')}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                    </button>
                                    {/* 生成卡组码按钮 - 分体式 */}
                                    <div className="relative flex">
                                        <button
                                            onClick={onGenerateDeckCode}
                                            disabled={isGeneratingDeckCode}
                                            className={`px-3 py-1.5 text-sm rounded-l-lg font-medium transition-colors flex items-center gap-1.5 ${
                                                isGeneratingDeckCode
                                                    ? 'bg-(--primary)/70 text-white cursor-not-allowed'
                                                    : 'bg-(--primary) text-white active:bg-(--primary)/80'
                                            }`}
                                            title={t('sidebar.deckCode')}
                                        >
                                            {isGeneratingDeckCode ? (
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                            {t('sidebar.deckCode')}
                                        </button>
                                        <button
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                            className="px-1.5 rounded-r-lg bg-(--primary) text-white active:bg-(--primary)/80 border-l border-white/20 transition-colors flex items-center"
                                            title={t('sidebar.moreExport')}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {(showExportMenu || ydkExported) && (
                                            <>
                                                {!ydkExported && <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />}
                                                <div className={`absolute right-0 top-full mt-1 z-20 rounded-lg shadow-lg overflow-hidden ${
                                                    ydkExported
                                                        ? 'bg-[var(--success)]'
                                                        : 'bg-[var(--card-bg)] border border-[var(--card-border)]'
                                                }`}>
                                                    <button
                                                        onClick={() => { onExportYdk(); }}
                                                        disabled={isExportingYdk || ydkExported}
                                                        className={`px-3 py-1.5 text-sm transition-colors whitespace-nowrap flex items-center gap-2 disabled:cursor-default ${
                                                            ydkExported
                                                                ? 'text-white'
                                                                : 'text-[var(--foreground)] active:bg-[var(--background-secondary)]'
                                                        }`}
                                                    >
                                                        {isExportingYdk ? (
                                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : ydkExported ? (
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : null}
                                                        {ydkExported ? t('common.copied') : t('sidebar.exportYdk')}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 卡片列表 */}
                        <div ref={cardListScrollRef} onScroll={handleScroll} className="p-2 space-y-1 overflow-y-auto flex-1">
                            {cardGroups.map((group, groupIndex) => (
                                <button
                                    key={groupIndex}
                                    onClick={() => handleCardClickFromList(group.indices[0])}
                                    className="w-full text-left px-3 py-2.5 rounded-lg bg-(--background-secondary) hover:bg-(--card-border) active:bg-(--card-border) border border-transparent hover:border-(--primary)/30 transition-all duration-150 group"
                                >
                                    <div className="flex items-center gap-2">
                                        {/* 数量 */}
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                                            group.count > 1
                                                ? 'bg-(--primary) text-white'
                                                : 'bg-(--card-bg) border border-(--card-border) text-(--foreground-muted)'
                                        }`}>
                                            {group.count}
                                        </div>
                                        {/* 卡名 */}
                                        <span className="flex-1 text-sm text-foreground truncate">
                                            {group.name}
                                        </span>
                                        {/* 类型标记 */}
                                        {group.cardType === 'pendulum' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--success)/15 text-(--success) font-medium">P</span>
                                        )}
                                        <svg className="w-3.5 h-3.5 text-(--foreground-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 空闲/检测中状态 */}
                {(processingStage === 'idle' || processingStage === 'detecting') && (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-(--background-secondary) flex items-center justify-center mb-4">
                            {processingStage === 'detecting' ? (
                                <div className="w-8 h-8 rounded-full border-2 border-(--card-border) border-t-(--primary) animate-spin" />
                            ) : (
                                <svg className="w-8 h-8 text-(--foreground-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            )}
                        </div>
                        <p className="text-foreground font-medium mb-1">
                            {processingStage === 'detecting' ? t('mobile.detecting') : t('sidebar.waitingUpload')}
                        </p>
                        <p className="text-sm text-(--foreground-muted)">
                            {processingStage === 'detecting' ? t('mobile.pleaseWait') : t('sidebar.uploadHint')}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // 详情视图渲染
    function renderDetailView() {
        if (recognizedCards.length === 0) return null;

        return (
            <div className="flex flex-col h-full">
                {/* 固定头部 */}
                <div className="flex-shrink-0 p-4 border-b border-[var(--card-border)] bg-gradient-card">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        {/* 返回按钮（仅从列表进入时显示） */}
                        {currentEntryPoint === 'list' && (
                            <button
                                onClick={handleBackToList}
                                className="p-1.5 -ml-1 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--background-secondary)] transition-colors shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <h2
                            onClick={() => {
                                if (cardInfo?.password) {
                                    window.open(`https://ygocdb.com/card/${cardInfo.password}`, '_blank');
                                }
                            }}
                            className={`text-lg font-bold text-[var(--foreground)] line-clamp-2 leading-tight flex-1 min-w-0 transition-opacity duration-150 cursor-pointer ${isNameFading ? 'opacity-0' : 'opacity-100'}`}
                        >
                            {displayName}
                        </h2>
                        {/* 位置指示器 + 识别源按钮 */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-[var(--foreground-muted)] font-mono">
                                {selectedCardIndex + 1}/{recognizedCards.length}
                            </span>
                            <button
                                onClick={handleToggleSourcePanel}
                                className={`p-1 rounded-lg transition-colors ${showSourcePanel
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                }`}
                                title={t('sidebar.sourceImage')}
                            >
                                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* 徽章 */}
                    <div className={`flex flex-wrap gap-1.5 transition-opacity duration-150 ${isBadgesFading ? 'opacity-0' : 'opacity-100'} ${currentEntryPoint === 'list' ? 'ml-7' : ''}`}>
                        {displayBadges.map((badge, i) => (
                            <span key={i} className="badge text-xs">{badge}</span>
                        ))}
                    </div>

                    {/* 识别源面板 */}
                    {showSourcePanel && (
                        <div className="mt-3 pt-3 border-t border-[var(--card-border)] animate-slide-up">
                            <div className="flex items-center gap-3">
                                {/* 预览图 */}
                                <div className="w-14 h-14 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                    {artwork ? (
                                        <FadeImage src={artwork} alt="source crop" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-[var(--foreground-muted)]">{t('sidebar.noSource')}</span>
                                    )}
                                </div>
                                {/* 模式切换 */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${!forcePendulumMode
                                                ? 'bg-[var(--primary)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                            }`}
                                        >
                                            {t('mobile.standard')}
                                        </button>
                                        <button
                                            onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${forcePendulumMode
                                                ? 'bg-[var(--success)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                            }`}
                                        >
                                            {t('mobile.pendulum')}
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-[var(--foreground-muted)]">{t('mobile.adjustHint')}</span>
                                </div>
                                {/* 四向微调按钮 */}
                                <div className="relative w-16 h-16 shrink-0 ml-auto">
                                    <button
                                        onClick={() => onMoveCardBox('up')}
                                        className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-7 rounded-lg bg-[var(--background-secondary)] active:bg-[var(--primary)] active:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onMoveCardBox('down')}
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-7 rounded-lg bg-[var(--background-secondary)] active:bg-[var(--primary)] active:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onMoveCardBox('left')}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-[var(--background-secondary)] active:bg-[var(--primary)] active:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onMoveCardBox('right')}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-[var(--background-secondary)] active:bg-[var(--primary)] active:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--foreground-muted)]/30" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 可滑动的内容区域 */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <MobileCardCarousel
                        items={recognizedCards}
                        currentIndex={selectedCardIndex >= 0 ? selectedCardIndex : 0}
                        onIndexChange={handleIndexChange}
                        renderItem={renderCardContent}
                        keyExtractor={keyExtractor}
                        showIndicator={false}
                    />
                </div>
            </div>
        );
    }
}
