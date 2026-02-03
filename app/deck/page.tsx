"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import BottomDrawer from '../components/ui/BottomDrawer';
import HoloCard from '../components/ui/HoloCard';

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

interface YgocdbResult {
    id: number;
    cn_name: string;
    text: {
        types?: string;
        desc?: string;
        atk?: number;
        def?: number;
    };
}

interface YgocdbResponse {
    result: YgocdbResult[];
}

// 加载本地卡片数据
let cardDataCache: CardData[] | null = null;
async function loadCardData(): Promise<CardData[]> {
    if (cardDataCache) return cardDataCache;
    const res = await fetch('/card_data.json');
    cardDataCache = await res.json();
    return cardDataCache!;
}

// 通过游戏ID获取卡片名称
async function getCardNameById(gameId: string): Promise<string | null> {
    const cardData = await loadCardData();
    const card = cardData.find(c => String(c.id) === gameId);
    return card?.name || null;
}

// 通过卡片名称获取百鸽CDN的ID
async function getBaigeIdByName(name: string): Promise<number | null> {
    try {
        const res = await fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`);
        const data: YgocdbResponse = await res.json();
        return data.result?.[0]?.id || null;
    } catch {
        return null;
    }
}

// 卡片图片 URL (百鸽CDN)
const getCardImageUrl = (baigeId: number) =>
    `https://cdn.233.momobako.com/ygoimg/sc/${baigeId}.webp`;

// 格式化卡片描述文字
function formatCardDesc(desc: string): string {
    if (!desc) return '';
    return desc.replace(/([^\n])(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)(?=：|:)/g, '$1\n$2');
}

// 解析卡片类型
function parseCardTypes(typesStr: string): string[] {
    const badges: string[] = [];
    const mainTypeMatch = typesStr.match(/\[([^\]]+)\]/);
    if (mainTypeMatch) {
        const mainType = mainTypeMatch[1];
        if (!mainType.startsWith('★') && !mainType.startsWith('☆')) {
            badges.push(mainType.replace(/\|/g, '/'));
        }
    }
    let badget2 = '';
    const firstLine = typesStr.split('\n')[0];
    const afterBracket = firstLine.replace(/\[[^\]]+\]\s*/, '').trim();
    if (afterBracket) {
        const subTypes = afterBracket.split('/').map(s => s.trim()).filter(s => s);
        badget2 = subTypes.join('/');
    }
    const starMatch = typesStr.match(/\[(★\d+|☆\d+)\]/);
    if (starMatch) {
        if (badget2) {
            badget2 = badget2 + ' ' + starMatch[1];
        }
    }
    if (badget2) {
        badges.push(badget2);
    }
    const secondLine = typesStr.split('\n')[1];
    if (secondLine) {
        const atkDefMatch = secondLine.match(/(\d+)\/(\d+)/);
        if (atkDefMatch) {
            badges.push(`${atkDefMatch[1]}/${atkDefMatch[2]}`);
        }
    }
    return badges;
}

// 卡片信息组件
function CardItem({
    gameId,
    onClick,
    isSelected
}: {
    gameId: string;
    onClick: () => void;
    isSelected: boolean;
}) {
    const [baigeId, setBaigeId] = useState<number | null>(null);
    const [cardName, setCardName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const name = await getCardNameById(gameId);
            if (cancelled) return;
            if (name) {
                setCardName(name);
                const id = await getBaigeIdByName(name);
                if (cancelled) return;
                setBaigeId(id);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [gameId]);

    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden cursor-pointer transition-all aspect-[59/86] ${
                isSelected ? 'ring-2 ring-[var(--primary)] scale-105 z-10' : 'hover:brightness-110'
            }`}
        >
            {loading ? (
                <div className="w-full h-full bg-[var(--background-secondary)] animate-pulse" />
            ) : baigeId ? (
                <img
                    src={getCardImageUrl(baigeId)}
                    alt={cardName}
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
    const [cardInfo, setCardInfo] = useState<YgocdbResult | null>(null);
    const [cardName, setCardName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const name = await getCardNameById(gameId);
            if (cancelled) return;
            if (name) {
                setCardName(name);
                try {
                    const res = await fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`);
                    const data: YgocdbResponse = await res.json();
                    if (cancelled) return;
                    setCardInfo(data.result?.[0] || null);
                } catch {
                    // ignore
                }
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
                无法加载卡片信息
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-scale-in">
            {/* 头部 - 复用 Sidebar 样式 */}
            <div className="p-6 border-b border-[var(--card-border)] bg-gradient-card">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <h2
                        onClick={() => window.open(`https://ygocdb.com/card/${cardInfo.id}`, '_blank')}
                        className="text-xl font-bold text-[var(--foreground)] line-clamp-2 leading-tight flex-1 min-w-0 cursor-pointer hover:text-[var(--primary)] transition-colors"
                    >
                        {cardName}
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
                {cardInfo.text?.types && (
                    <div className="flex flex-wrap gap-2">
                        {parseCardTypes(cardInfo.text.types).map((badge, i) => (
                            <span key={i} className="badge text-xs">{badge}</span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* 官方卡图 - 使用 HoloCard */}
                <div className="w-full rounded-xl overflow-visible">
                    <HoloCard
                        src={getCardImageUrl(cardInfo.id)}
                        alt={cardName}
                    />
                </div>

                {/* ATK/DEF */}
                {(cardInfo.text?.atk !== undefined || cardInfo.text?.def !== undefined) && (
                    <div className="flex gap-3">
                        {cardInfo.text.atk !== undefined && (
                            <div className="flex-1 panel p-3 text-center">
                                <div className="text-xs text-[var(--foreground-muted)] mb-1">ATK</div>
                                <div className="text-lg font-bold text-[var(--warning)]">
                                    {cardInfo.text.atk}
                                </div>
                            </div>
                        )}
                        {cardInfo.text.def !== undefined && (
                            <div className="flex-1 panel p-3 text-center">
                                <div className="text-xs text-[var(--foreground-muted)] mb-1">DEF</div>
                                <div className="text-lg font-bold text-[var(--primary)]">
                                    {cardInfo.text.def}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 卡片描述 */}
                {cardInfo.text?.desc && (
                    <div className="panel p-4">
                        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                            {formatCardDesc(cardInfo.text.desc)}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function DeckContent() {
    const searchParams = useSearchParams();
    const deckCode = searchParams.get('code');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deckData, setDeckData] = useState<DeckResponse | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedCardIndex, setSelectedCardIndex] = useState(-1);

    // 移动端状态
    const [showCardListDrawer, setShowCardListDrawer] = useState(false);
    const [showCardDetailDrawer, setShowCardDetailDrawer] = useState(false);
    const [cardNameMap, setCardNameMap] = useState<Map<string, string>>(new Map());

    // PC端卡片高度状态（用于自适应布局）
    const [cardHeight, setCardHeight] = useState<number | null>(null);
    const [baseCardHeight, setBaseCardHeight] = useState<number | null>(null); // 基准高度，用于计算百分比
    const [autoSizeCalculated, setAutoSizeCalculated] = useState(false);
    const cardGridRef = useRef<HTMLDivElement>(null);

    // 计算卡片高度，使所有卡片在一屏内显示
    useEffect(() => {
        if (!deckData || autoSizeCalculated) return;

        const calculateCardHeight = () => {
            const container = cardGridRef.current;
            if (!container) return false;

            // 获取容器可用高度（减去 padding）
            const containerHeight = container.clientHeight - 32; // p-4 = 16px * 2

            // 容器尺寸还没准备好，返回 false 表示需要重试
            if (containerHeight <= 0) return false;

            // 计算卡片数量
            const mainCount = (deckData.deck.monsters?.length || 0) +
                             (deckData.deck.spells?.length || 0) +
                             (deckData.deck.traps?.length || 0);
            const extraCount = deckData.deck.extra?.length || 0;

            const mainCardsPerRow = mainCount <= 50 ? 10 : mainCount >= 60 ? 12 : 11;
            const mainRows = Math.ceil(mainCount / mainCardsPerRow);
            const extraRows = Math.ceil(extraCount / 10);

            const gap = 4;
            const headerHeight = 28;
            const sectionGap = 16;

            // 计算可用于卡片的总高度
            const totalRows = mainRows + extraRows;
            const fixedHeight = headerHeight + (extraCount > 0 ? sectionGap + headerHeight : 0);
            const totalGaps = Math.max(0, mainRows - 1) * gap + (extraCount > 0 ? Math.max(0, extraRows - 1) * gap : 0);
            const availableHeight = containerHeight - fixedHeight - totalGaps;

            // 计算每张卡片的高度
            const calculatedCardHeight = availableHeight / totalRows * 0.95; // 留一点边距
            const finalHeight = Math.max(60, calculatedCardHeight);
            setCardHeight(finalHeight); // 最小高度 60px
            setBaseCardHeight(finalHeight); // 保存基准高度

            return true; // 计算成功
        };

        // 使用 requestAnimationFrame 确保 DOM 已渲染，并重试直到成功
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

        // 首次延迟一帧后开始尝试
        const frameId = requestAnimationFrame(tryCalculate);
        return () => cancelAnimationFrame(frameId);
    }, [deckData, autoSizeCalculated]);

    // 缩放按钮处理（调整卡片高度）
    const handleZoomIn = useCallback(() => {
        setCardHeight(prev => prev ? Math.min(200, prev + 10) : 100);
    }, []);

    const handleZoomOut = useCallback(() => {
        setCardHeight(prev => prev ? Math.max(40, prev - 10) : 80);
    }, []);

    // 滚轮缩放处理 - 使用原生事件监听以支持 preventDefault
    useEffect(() => {
        const container = cardGridRef.current;
        if (!container || !deckData) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                // 向上滚动 = 放大
                setCardHeight(prev => prev ? Math.min(200, prev + 5) : 100);
            } else {
                // 向下滚动 = 缩小
                setCardHeight(prev => prev ? Math.max(40, prev - 5) : 80);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [deckData]);

    // 拖动滚动状态
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        const container = cardGridRef.current;
        if (container) {
            setScrollStart({ x: container.scrollLeft, y: container.scrollTop });
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const container = cardGridRef.current;
        if (container) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            container.scrollLeft = scrollStart.x - dx;
            container.scrollTop = scrollStart.y - dy;
        }
    }, [isDragging, dragStart, scrollStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 加载卡组数据
    useEffect(() => {
        if (!deckCode) {
            setLoading(false);
            setError('缺少卡组码参数');
            return;
        }

        setLoading(true);
        setError(null);

        fetch(`https://api.get-deck.tech/deck/${deckCode}`, {
            headers: {
                'Origin': 'https://get-deck.tech',
                'Referer': 'https://get-deck.tech/',
            }
        })
            .then(res => {
                if (!res.ok) throw new Error('卡组不存在或者不是从GetDeck创建的');
                return res.json();
            })
            .then((data: DeckResponse) => {
                setDeckData(data);
            })
            .catch(err => {
                setError(err.message || '加载失败');
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

    // 计算主卡组每行数量
    const mainCardsPerRow = mainDeck.length <= 50 ? 10 : mainDeck.length >= 60 ? 12 : 11;

    // 加载卡片名称
    useEffect(() => {
        if (allCards.length === 0) return;
        const uniqueIds = [...new Set(allCards)];
        (async () => {
            const newMap = new Map<string, string>();
            for (const gameId of uniqueIds) {
                const name = await getCardNameById(gameId);
                if (name) {
                    newMap.set(gameId, name);
                }
            }
            setCardNameMap(newMap);
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
                    <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <span className="font-semibold text-[var(--foreground)]">GetDeck</span>
                    </a>

                    {deckData && (
                        <>
                            <div className="hidden sm:block h-6 w-px bg-[var(--card-border)]" />
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <span className="text-sm font-bold text-white">{deckData.card_count}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold font-mono text-[var(--primary)]">{deckData.deck_code}</p>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        主卡组 {mainDeck.length} · 额外卡组 {extraDeck.length}
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
                                title="缩小"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <span className="text-xs text-[var(--foreground-muted)] bg-[var(--background-secondary)] px-2 py-1 rounded min-w-[48px] text-center">
                                {cardHeight && baseCardHeight ? `${Math.round(cardHeight / baseCardHeight * 100)}%` : 'auto'}
                            </span>
                            <button
                                onClick={handleZoomIn}
                                className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                                title="放大"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={handleCopy}
                            className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                            {copied ? (
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
                            )}
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin mb-4" />
                        <p className="text-[var(--foreground-muted)]">加载卡组数据...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-[var(--foreground-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-[var(--foreground)] font-medium mb-2">{error}</p>
                        <a href="/" className="text-sm text-[var(--primary)] hover:underline">
                            返回首页
                        </a>
                    </div>
                ) : deckData ? (
                    <>
                        {/* 左侧：卡组展示区 */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background-secondary)]">
                            {/* 卡片网格 */}
                            <div
                                ref={cardGridRef}
                                className={`flex-1 overflow-auto p-4 flex flex-col items-center scrollbar-hide ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <div className="space-y-4 select-none">
                                    {/* 主卡组 */}
                                    {mainDeck.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-4 rounded-full bg-purple-500" />
                                                <span className="text-xs font-medium text-[var(--foreground-muted)]">主卡组</span>
                                                <span className="text-xs text-[var(--foreground-muted)]">{mainDeck.length}</span>
                                            </div>
                                            <div
                                                className="grid gap-0.5"
                                                style={{
                                                    gridTemplateColumns: cardHeight
                                                        ? `repeat(${mainCardsPerRow}, ${Math.round(cardHeight * 59 / 86)}px)`
                                                        : `repeat(${mainCardsPerRow}, minmax(0, 1fr))`
                                                }}
                                            >
                                                {mainDeck.map((cid, i) => (
                                                    <CardItem
                                                        key={`main-${cid}-${i}`}
                                                        gameId={cid}
                                                        onClick={() => setSelectedCardIndex(i)}
                                                        isSelected={selectedCardIndex === i}
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
                                                <span className="text-xs font-medium text-[var(--foreground-muted)]">额外卡组</span>
                                                <span className="text-xs text-[var(--foreground-muted)]">{extraDeck.length}</span>
                                            </div>
                                            <div
                                                className="grid gap-0.5"
                                                style={{
                                                    gridTemplateColumns: cardHeight
                                                        ? `repeat(10, ${Math.round(cardHeight * 59 / 86)}px)`
                                                        : 'repeat(10, minmax(0, 1fr))'
                                                }}
                                            >
                                                {extraDeck.map((cid, i) => (
                                                    <CardItem
                                                        key={`extra-${cid}-${i}`}
                                                        gameId={cid}
                                                        onClick={() => setSelectedCardIndex(extraStart + i)}
                                                        isSelected={selectedCardIndex === extraStart + i}
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
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                    <svg className="w-16 h-16 text-[var(--foreground-muted)] mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                    </svg>
                                    <p className="text-sm text-[var(--foreground-muted)]">点击卡片查看详情</p>
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
                            <span>卡组列表</span>
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
                                    <span className="text-sm font-medium text-[var(--success)]">已复制</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-sm font-medium">卡组码</span>
                                </>
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
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                                    <span className="text-lg font-bold text-white">{deckData?.card_count || 0}</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[var(--foreground)]">卡组详情</h2>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        主卡组 {mainDeck.length} · 额外 {extraDeck.length}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[var(--foreground-muted)]">卡组码</p>
                                <p className="text-sm font-bold text-[var(--foreground)] font-mono">{deckData?.deck_code}</p>
                            </div>
                        </div>
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
