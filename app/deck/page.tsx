"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import * as bincode from 'bincode-ts';
import BottomDrawer from '../components/ui/BottomDrawer';
import HoloCard from '../components/ui/HoloCard';
import { apiUrl, siteUrl, getCardImageUrl } from '../config';
import { useTranslation } from '@/app/i18n';
import { CardInfo } from '../types';
import { globalCardInfoCache, fetchCardInfoBatch, isExtraDeck, getCardBadges } from '../utils/cardApi';
import { getLocalizedCardName, getLocalizedCardText } from '../i18n/cardName';

interface DeckData {
    monsters: string[];
    spells: string[];
    traps: string[];
    extra: string[];
    side?: string[];
}

interface DeckResponse {
    deck_code: string;
    deck: DeckData;
    card_count: number;
    created_at: number;
}

interface CardData {
    id: number;
    name: string;
}

// 加载本地卡片数据
let cardDataCache: CardData[] | null = null;
let cardDataPromise: Promise<CardData[]> | null = null;

async function loadCardData(): Promise<CardData[]> {
    if (cardDataCache) return cardDataCache;
    if (cardDataPromise) return cardDataPromise;

    cardDataPromise = fetch('/card_data')
        .then(res => res.arrayBuffer())
        .then(data => {
            const result = bincode.decode(bincode.Collection(bincode.Struct({
                id : bincode.u32,
                name : bincode.String,
                phash: bincode.String,
                card_type: bincode.u8
            })), data).value;
            cardDataCache = result;
            return result;
        });

    return cardDataPromise;
}


// 通过游戏ID获取卡片数据条目
async function getCardDataById(gameId: string): Promise<CardData | null> {
    const cardData = await loadCardData();
    return cardData.find(c => String(c.id) === gameId) || null;
}

// 格式化卡片描述文字
function formatCardDesc(desc: string): string {
    if (!desc) return '';
    return desc.replace(/([^\n])(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)(?=：|:)/g, '$1\n$2');
}

// 卡片信息组件
function CardItem({
    gameId,
    baigeId,
    onClick,
    isSelected,
    locale
}: {
    gameId: string;
    baigeId: number | null;
    onClick: () => void;
    isSelected: boolean;
    locale: string;
}) {
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`relative overflow-hidden cursor-pointer transition-all aspect-[59/86] ${
                isSelected ? 'ring-2 ring-[var(--primary)] scale-105 z-10' : 'hover:brightness-110'
            }`}
        >
            {baigeId ? (
                <img
                    src={getCardImageUrl(baigeId, locale)}
                    alt={gameId}
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain card-image"
                    loading="lazy"
                    draggable={false}
                />
            ) : (
                <div className="w-full h-full bg-[var(--background-secondary)] flex items-center justify-center">
                    <span className="text-xs text-[var(--foreground-muted)]">?</span>
                </div>
            )}
        </div>
    );
}

// 卡片详情面板 - 复用 Sidebar 样式
function CardDetailPanel({
    gameId,
    onClose
}: {
    gameId: string;
    onClose: () => void;
}) {
    const { t, locale } = useTranslation();
    const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
    const [cardName, setCardName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const cdEntry = await getCardDataById(gameId);
            if (cancelled) return;
            if (cdEntry) {
                setCardName(cdEntry.name);
                setCardInfo(globalCardInfoCache[cdEntry.name] || null);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [gameId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
            </div>
        );
    }

    if (!cardInfo) {
        return (
            <div className="p-6 text-center text-[var(--foreground-muted)]">
                {t('deck.cannotLoadCard')}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-scale-in">
            {/* 头部 - 复用 Sidebar 样式 */}
            <div className="p-6 border-b border-[var(--card-border)] bg-gradient-card">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <h2
                        onClick={() => window.open(`https://ygocdb.com/card/${cardInfo.password}`, '_blank')}
                        className="text-xl font-bold text-[var(--foreground)] line-clamp-2 leading-tight flex-1 min-w-0 cursor-pointer hover:text-[var(--primary)] transition-colors"
                    >
                        {getLocalizedCardName(cardInfo, cardName, locale)}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {cardInfo && (
                    <div className="flex flex-wrap gap-2">
                        {getCardBadges(cardInfo, locale).map((badge, i) => (
                            <span key={i} className="badge text-xs">{badge}</span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* 官方卡图 - 使用 HoloCard */}
                <div className="w-full rounded-xl overflow-visible">
                    <HoloCard
                        src={getCardImageUrl(cardInfo.password, locale)}
                        alt={cardName}
                    />
                </div>

                {/* 卡片描述 */}
                {getLocalizedCardText(cardInfo, locale) && (
                    <div className="panel p-4">
                        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                            {formatCardDesc(getLocalizedCardText(cardInfo, locale))}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function DeckContent() {
    const { t, locale } = useTranslation();
    const searchParams = useSearchParams();
    const deckCode = searchParams.get('code');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deckData, setDeckData] = useState<DeckResponse | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedCardIndex, setSelectedCardIndex] = useState(-1);
    const [isExportingYdk, setIsExportingYdk] = useState(false);
    const [ydkExported, setYdkExported] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [ydkModalContent, setYdkModalContent] = useState<string | null>(null);

    // 移动端状态
    const [showCardListDrawer, setShowCardListDrawer] = useState(false);
    const [showCardDetailDrawer, setShowCardDetailDrawer] = useState(false);
    const [cardNameMap, setCardNameMap] = useState<Map<string, string>>(new Map());
    const [baigeIdMap, setBaigeIdMap] = useState<Map<string, number>>(new Map());

    // 检测是否为移动端
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // PC端卡片宽度状态（用于网格自适应布局和缩放）
    const [cardWidth, setCardWidth] = useState<number>(70);
    const cardGridRef = useRef<HTMLDivElement>(null);

    // 缩放按钮处理（调整卡片网格列宽）- 仅 PC 端
    const handleZoomIn = useCallback(() => {
        if (isMobile) return;
        setCardWidth(prev => Math.min(150, prev + 10));
    }, [isMobile]);

    const handleZoomOut = useCallback(() => {
        if (isMobile) return;
        setCardWidth(prev => Math.max(40, prev - 10));
    }, [isMobile]);

    // 滚轮缩放处理 - 仅 PC 端
    useEffect(() => {
        if (isMobile) return;
        const container = cardGridRef.current;
        if (!container || !deckData) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            setCardWidth(prev => e.deltaY < 0 ? Math.min(150, prev + 5) : Math.max(40, prev - 5));
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [deckData, isMobile]);

    // 拖动滚动状态 - 仅 PC 端
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (isMobile) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        const container = cardGridRef.current;
        if (container) {
            setScrollStart({ x: container.scrollLeft, y: container.scrollTop });
        }
    }, [isMobile]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (isMobile || !isDragging) return;
        const container = cardGridRef.current;
        if (container) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            container.scrollLeft = scrollStart.x - dx;
            container.scrollTop = scrollStart.y - dy;
        }
    }, [isMobile, isDragging, dragStart, scrollStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 加载卡组数据
    useEffect(() => {
        if (!deckCode) {
            setLoading(false);
            setError(t('deck.missingCode'));
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`${apiUrl}/deck/${deckCode}`, {
            headers: {
                'Origin': siteUrl,
                'Referer': `${siteUrl}/`,
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(t('deck.deckNotFound'));
                return res.json();
            })
            .then((data: DeckResponse) => {
                setDeckData(data);
            })
            .catch(err => {
                setError(err.message || t('deck.loadFailed'));
            })
            .finally(() => {
                setLoading(false);
            });
    }, [deckCode]);

    // 复制卡组码
    const handleCopy = useCallback(() => {
        if (!deckData) return;
        navigator.clipboard.writeText(deckData.deck_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [deckData]);

    // 导出 YDK 文件
    const handleExportYdk = useCallback(async () => {
        if (isExportingYdk || !deckData) return;
        setIsExportingYdk(true);

        try {
            const allGameIds = [
                ...(deckData.deck.monsters || []),
                ...(deckData.deck.spells || []),
                ...(deckData.deck.traps || []),
                ...(deckData.deck.extra || []),
            ];

            // Batch fetch all card info
            const cardData = await loadCardData();
            const entries: { id: number; name: string }[] = [];
            for (const gameId of [...new Set(allGameIds)]) {
                const card = cardData.find(c => String(c.id) === gameId);
                if (card) entries.push({ id: card.id, name: card.name });
            }
            await fetchCardInfoBatch(entries);

            const mainIds: number[] = [];
            const extraIds: number[] = [];

            for (const gameId of allGameIds) {
                const card = cardData.find(c => String(c.id) === gameId);
                if (!card) continue;
                const info = globalCardInfoCache[card.name];
                const baigeId = info?.password;
                if (!baigeId) continue;

                if (isExtraDeck(info)) {
                    extraIds.push(baigeId);
                } else {
                    mainIds.push(baigeId);
                }
            }

            const ydk = `#created by GetDeck\n#main\n${mainIds.join('\n')}\n#extra\n${extraIds.join('\n')}\n!side\n`;

            navigator.clipboard.writeText(ydk).catch(() => {});

            // 移动端显示弹窗，PC端下载文件
            if (window.innerWidth < 1024) {
                setYdkModalContent(ydk);
            } else {
                const blob = new Blob([ydk], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'deck.ydk';
                a.click();
                URL.revokeObjectURL(url);
            }

            setYdkExported(true);
            setTimeout(() => setYdkExported(false), 2000);
        } finally {
            setIsExportingYdk(false);
        }
    }, [deckData, isExportingYdk]);

    // 合并主卡组（怪兽+魔法+陷阱）
    const mainDeck = deckData ? [
        ...(deckData.deck.monsters || []),
        ...(deckData.deck.spells || []),
        ...(deckData.deck.traps || []),
    ] : [];

    const extraDeck = deckData?.deck.extra || [];

    // 合并所有卡片用于索引
    const allCards = [...mainDeck, ...extraDeck];
    const extraStart = mainDeck.length;

    const selectedGameId = selectedCardIndex >= 0 ? allCards[selectedCardIndex] : null;

    // 加载卡片名称 + 批量获取卡片信息
    useEffect(() => {
        if (allCards.length === 0) return;
        const uniqueIds = [...new Set(allCards)];
        (async () => {
            const cardData = await loadCardData();
            const newMap = new Map<string, string>();
            const entries: { id: number; name: string }[] = [];
            for (const gameId of uniqueIds) {
                const card = cardData.find(c => String(c.id) === gameId);
                if (card) {
                    newMap.set(gameId, card.name);
                    entries.push({ id: card.id, name: card.name });
                }
            }
            setCardNameMap(newMap);
            await fetchCardInfoBatch(entries);
            // Update names and baigeIds after cache populated
            const idMap = new Map<string, number>();
            for (const [gameId, zhName] of newMap) {
                const info = globalCardInfoCache[zhName];
                if (info) {
                    newMap.set(gameId, getLocalizedCardName(info, zhName, locale));
                    if (info.password) idMap.set(gameId, info.password);
                }
            }
            setCardNameMap(new Map(newMap));
            setBaigeIdMap(idMap);
        })();
    }, [deckData]); // eslint-disable-line react-hooks/exhaustive-deps

    // 合并相同卡片用于列表显示
    const cardGroups: { name: string; count: number; indices: number[] }[] = [];
    const processedIds = new Set<string>();

    allCards.forEach((gameId, index) => {
        if (processedIds.has(gameId)) {
            const existing = cardGroups.find(g => g.indices.includes(allCards.indexOf(gameId)));
            if (existing) {
                existing.count++;
                existing.indices.push(index);
            }
        } else {
            processedIds.add(gameId);
            cardGroups.push({
                name: cardNameMap.get(gameId) || gameId,
                count: 1,
                indices: [index]
            });
        }
    });

    return (
        <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <span className="font-semibold text-[var(--foreground)]">GetDeck</span>
                    </Link>

                    {deckData && (
                        <>
                            <div className="hidden sm:block h-6 w-px bg-[var(--card-border)]" />
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                                    <span className="text-sm font-bold text-white">{deckData.card_count}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold font-mono text-[var(--primary)]">{deckData.deck_code}</p>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {t('deck.mainExtraSummary', { main: mainDeck.length, extra: extraDeck.length })}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {deckData && (
                    <div className="flex items-center gap-2">
                        {/* 缩放控件 */}
                        <div className="hidden lg:flex items-center gap-1">
                            <button
                                onClick={handleZoomOut}
                                className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                                title={t('deck.zoomOut')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <span className="text-xs text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-2 py-1 rounded min-w-[48px] text-center">
                                {Math.round((cardWidth / 70) * 100)}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                                title={t('deck.zoomIn')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={handleCopy}
                            className="btn-primary flex items-center gap-2 py-1.5 text-sm"
                        >
                            {/* {copied ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    已复制
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">复制卡组码</span>
                                </>
                            )} */}
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin mb-4" />
                        <p className="text-[var(--foreground-muted)]">{t('deck.loadingDeck')}</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-[var(--foreground-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-[var(--foreground)] font-medium mb-2">{error}</p>
                        <Link href="/" className="text-sm text-[var(--primary)] hover:underline">
                            {t('deck.backToHome')}
                        </Link>
                    </div>
                ) : deckData ? (
                    <>
                        {/* 左侧：卡组展示区 */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background-secondary)]">
                            {/* 卡片网格 */}
                            <div
                                ref={cardGridRef}
                                className={`flex-1 overflow-auto p-3 lg:p-4 ${isMobile ? 'pb-24' : ''} ${!isMobile && isDragging ? 'cursor-grabbing' : !isMobile ? 'cursor-grab' : ''} ${isMobile ? '' : 'flex flex-col items-center'} scrollbar-hide`}
                                onMouseDown={!isMobile ? handleMouseDown : undefined}
                                onMouseMove={!isMobile ? handleMouseMove : undefined}
                                onMouseUp={!isMobile ? handleMouseUp : undefined}
                                onMouseLeave={!isMobile ? handleMouseUp : undefined}
                                onClick={(e) => {
                                    // 点击空白区域时取消选中（PC端显示卡组列表）
                                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.space-y-4') === e.target) {
                                        setSelectedCardIndex(-1);
                                    }
                                }}
                            >
                                <div className={`space-y-4 select-none ${isMobile ? 'w-full' : ''}`}>
                                    {/* 主卡组 */}
                                    {mainDeck.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-4 rounded-full bg-purple-500" />
                                                <span className="text-xs font-medium text-[var(--foreground-muted)]">{t('deck.mainDeck')}</span>
                                                <span className="text-xs text-[var(--foreground-muted)]">{mainDeck.length}</span>
                                            </div>
                                            <div
                                                className="grid gap-0.5"
                                                style={{
                                                    gridTemplateColumns: isMobile 
                                                        ? 'repeat(5, minmax(0, 1fr))' 
                                                        : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`
                                                }}
                                            >
                                                {mainDeck.map((cid, i) => (
                                                    <CardItem
                                                        key={`main-${cid}-${i}`}
                                                        gameId={cid}
                                                        baigeId={baigeIdMap.get(cid) || null}
                                                        onClick={() => {
                                                            setSelectedCardIndex(i);
                                                            if (isMobile) setShowCardDetailDrawer(true);
                                                        }}
                                                        isSelected={selectedCardIndex === i}
                                                        locale={locale}
                                                    />
                                                ))}
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
                                                style={{
                                                    gridTemplateColumns: isMobile 
                                                        ? 'repeat(5, minmax(0, 1fr))' 
                                                        : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`
                                                }}
                                            >
                                                {extraDeck.map((cid, i) => (
                                                    <CardItem
                                                        key={`extra-${cid}-${i}`}
                                                        gameId={cid}
                                                        baigeId={baigeIdMap.get(cid) || null}
                                                        onClick={() => {
                                                            setSelectedCardIndex(extraStart + i);
                                                            if (isMobile) setShowCardDetailDrawer(true);
                                                        }}
                                                        isSelected={selectedCardIndex === extraStart + i}
                                                        locale={locale}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 右侧：卡片详情侧边栏 - 复用 Sidebar 样式 */}
                        <div className="hidden lg:flex w-[400px] border-l border-[var(--card-border)] bg-[var(--card-bg)] flex-col shrink-0 overflow-hidden">
                            {selectedGameId ? (
                                <CardDetailPanel
                                    gameId={selectedGameId}
                                    onClose={() => setSelectedCardIndex(-1)}
                                />
                            ) : (
                                <div className="flex flex-col h-full">
                                    {/* 头部统计 */}
                                    <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow">
                                                    <span className="text-lg font-bold text-white">{deckData.card_count}</span>
                                                </div>
                                                <div>
                                                    <h2 className="text-base font-bold text-[var(--foreground)]">{t('deck.deckDetail')}</h2>
                                                    <p className="text-xs text-[var(--foreground-muted)]">
                                                        {t('deck.mainExtraSummary', { main: mainDeck.length, extra: extraDeck.length })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="relative flex">
                                                <button
                                                    onClick={handleCopy}
                                                    className={`px-3 py-1.5 text-sm rounded-l-lg font-medium transition-colors flex items-center gap-1.5 ${
                                                        copied
                                                            ? 'bg-[var(--success)] text-white'
                                                            : 'bg-(--primary) text-white hover:bg-(--primary)/90'
                                                    }`}
                                                    title={t('deck.copyDeckCode')}
                                                >
                                                    {copied ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                    {copied ? t('common.copied') : t('deck.deckCode')}
                                                </button>
                                                <button
                                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                                    className="px-1.5 rounded-r-lg bg-(--primary) text-white hover:bg-(--primary)/90 border-l border-white/20 transition-colors flex items-center"
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
                                                                onClick={() => { handleExportYdk(); }}
                                                                disabled={isExportingYdk || ydkExported}
                                                                className={`px-3 py-1.5 text-sm transition-colors whitespace-nowrap flex items-center gap-2 disabled:cursor-default ${
                                                                    ydkExported
                                                                        ? 'text-white'
                                                                        : 'text-[var(--foreground)] hover:bg-[var(--background-secondary)]'
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

                                    {/* 引导到主页 - 识别自己的卡组 */}
                                    <div className="p-3 border-t border-[var(--card-border)]">
                                        <Link
                                            href="/"
                                            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 border border-[var(--primary)]/20 hover:border-[var(--primary)]/40 transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">{t('deck.recognizeMyDeck')}</p>
                                                <p className="text-xs text-[var(--foreground-muted)]">{t('deck.recognizeMyDeckDesc')}</p>
                                            </div>
                                            <svg className="w-5 h-5 text-[var(--foreground-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    </div>
                                    {/* 卡片列表 */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                        <div className="space-y-1">
                                            {cardGroups.map((group, groupIndex) => (
                                                <button
                                                    key={groupIndex}
                                                    onClick={() => setSelectedCardIndex(group.indices[0])}
                                                    className="w-full text-left px-3 py-2 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)] border border-transparent hover:border-[var(--primary)]/30 transition-all duration-150 group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {/* 数量 */}
                                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                                                            group.count > 1
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground-muted)]'
                                                        }`}>
                                                            {group.count}
                                                        </div>
                                                        {/* 卡名 */}
                                                        <span className="flex-1 text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] truncate transition-colors">
                                                            {group.name}
                                                        </span>
                                                        <svg className="w-3.5 h-3.5 text-[var(--foreground-muted)] group-hover:text-[var(--primary)] transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            {/* 移动端底部工具栏 */}
            {deckData && (
                <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
                    <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl">
                        {/* 卡组列表按钮 */}
                        <button
                            onClick={() => setShowCardListDrawer(true)}
                            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white font-medium text-sm transition-colors active:bg-[var(--primary-hover)]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            {/* <span>列表</span> */}
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                                {deckData.card_count}
                            </span>
                        </button>

                        {/* 分隔线 */}
                        <div className="w-px h-8 bg-[var(--card-border)]" />

                        {/* 复制卡组码按钮 */}
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors active:bg-[var(--card-border)]"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </>
                            )}
                        </button>

                        {/* 分隔线 */}
                        <div className="w-px h-8 bg-[var(--card-border)]" />

                        {/* 导出 YDK 按钮 */}
                        <button
                            onClick={handleExportYdk}
                            disabled={isExportingYdk}
                            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-[var(--foreground)] hover:bg-[var(--background-secondary)] transition-colors active:bg-[var(--card-border)]"
                        >
                            {isExportingYdk ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <span className="text-sm font-medium">YDK</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 移动端卡组列表 Drawer */}
            <BottomDrawer
                isOpen={showCardListDrawer}
                onClose={() => setShowCardListDrawer(false)}
                maxHeight="92vh"
            >
                <div className="flex flex-col">
                    {/* 头部统计 */}
                    <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow">
                                    <span className="text-lg font-bold text-white">{deckData?.card_count || 0}</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[var(--foreground)]">{t('deck.deckDetail')}</h2>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {t('deck.mainExtraSummary', { main: mainDeck.length, extra: extraDeck.length })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[var(--foreground-muted)]">{t('deck.deckCode')}</p>
                                <p className="text-sm font-bold text-[var(--foreground)] font-mono">{deckData?.deck_code}</p>
                            </div>
                        </div>
                    </div>

                    {/* 引导到主页 - 识别自己的卡组 */}
                    <div className="p-3 border-t border-[var(--card-border)]">
                        <Link
                            href="/"
                            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 border border-[var(--primary)]/20 hover:border-[var(--primary)]/40 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">{t('deck.recognizeMyDeck')}</p>
                                <p className="text-xs text-[var(--foreground-muted)]">{t('deck.recognizeMyDeckDesc')}</p>
                            </div>
                            <svg className="w-5 h-5 text-[var(--foreground-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                    {/* 卡片列表 */}
                    <div className="p-2 space-y-1 overflow-y-auto">
                        {cardGroups.map((group, groupIndex) => (
                            <button
                                key={groupIndex}
                                onClick={() => {
                                    setSelectedCardIndex(group.indices[0]);
                                    setShowCardListDrawer(false);
                                    setShowCardDetailDrawer(true);
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)] active:bg-[var(--card-border)] border border-transparent hover:border-[var(--primary)]/30 transition-all duration-150 group"
                            >
                                <div className="flex items-center gap-2">
                                    {/* 数量 */}
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                                        group.count > 1
                                            ? 'bg-[var(--primary)] text-white'
                                            : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground-muted)]'
                                    }`}>
                                        {group.count}
                                    </div>
                                    {/* 卡名 */}
                                    <span className="flex-1 text-sm text-[var(--foreground)] truncate">
                                        {group.name}
                                    </span>
                                    <svg className="w-3.5 h-3.5 text-[var(--foreground-muted)] group-hover:text-[var(--primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </BottomDrawer>

            {/* 移动端卡片详情 Drawer */}
            <BottomDrawer
                isOpen={showCardDetailDrawer && selectedGameId !== null}
                onClose={() => {
                    setShowCardDetailDrawer(false);
                    setSelectedCardIndex(-1);
                }}
                maxHeight="85vh"
            >
                {selectedGameId && (
                    <CardDetailPanel
                        gameId={selectedGameId}
                        onClose={() => {
                            setShowCardDetailDrawer(false);
                            setSelectedCardIndex(-1);
                        }}
                    />
                )}
            </BottomDrawer>

            {/* YDK 弹窗 */}
            {ydkModalContent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setYdkModalContent(null)}>
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm font-medium text-[var(--foreground)]">{t('deck.ydkCopied')}</span>
                            </div>
                            <button onClick={() => setYdkModalContent(null)} className="p-1 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <pre className="text-xs text-[var(--foreground-muted)] bg-[var(--background-secondary)] rounded-lg p-3 max-h-60 overflow-y-auto whitespace-pre font-mono">{ydkModalContent}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DeckDetailPage() {
    return (
        <Suspense fallback={
            <div className="h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
            </div>
        }>
            <DeckContent />
        </Suspense>
    );
}
