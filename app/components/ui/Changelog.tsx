import React, { useEffect, useState } from 'react';
import HoloCard from './HoloCard';

interface CardInfo {
    id: number;
    name: string;
}

interface UpdateEntry {
    version: string;
    sync_date: string;
    added_cards: CardInfo[];
    updated_cards: CardInfo[];
    total_cards: number;
    added_count: number;
    updated_count: number;
}

interface ChangelogData {
    updates: UpdateEntry[];
}

// 卡片图片 CDN（使用百鸽 ID）
const CARD_IMAGE_CDN = 'https://cdn.233.momobako.com/ygoimg/sc';

// 缓存百鸽 ID
const baigeIdCache: Record<string, number | null> = {};

// 获取百鸽 ID
async function getBaigeId(name: string): Promise<number | null> {
    if (name in baigeIdCache) {
        return baigeIdCache[name];
    }
    try {
        const response = await fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`);
        const data = await response.json();
        const id = data.result?.[0]?.id || null;
        baigeIdCache[name] = id;
        return id;
    } catch {
        baigeIdCache[name] = null;
        return null;
    }
}

// 卡片名称链接组件
function CardNameLink({ card }: { card: CardInfo }) {
    const [baigeId, setBaigeId] = useState<number | null>(null);

    useEffect(() => {
        getBaigeId(card.name).then(id => setBaigeId(id));
    }, [card.name]);

    if (!baigeId) {
        return <span>{card.name}</span>;
    }

    return (
        <a
            href={`https://ygocdb.com/card/${baigeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--foreground) hover:text-(--primary) hover:underline transition-colors"
        >
            {card.name}
        </a>
    );
}

// 卡片组件（使用 HoloCard）
function ChangelogCard({ card }: { card: CardInfo }) {
    const [baigeId, setBaigeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getBaigeId(card.name).then(id => {
            setBaigeId(id);
            setLoading(false);
        });
    }, [card.name]);

    if (loading) {
        return (
            <div className="aspect-[59/86] rounded-lg bg-(--background-tertiary) animate-pulse" />
        );
    }

    if (!baigeId) {
        return (
            <div className="aspect-[59/86] rounded-lg bg-(--background-tertiary) flex items-center justify-center">
                <span className="text-[10px] text-(--foreground-muted) text-center px-1">{card.name}</span>
            </div>
        );
    }

    return (
        <a
            href={`https://ygocdb.com/card/${baigeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-visible p-1"
        >
            <HoloCard
                src={`${CARD_IMAGE_CDN}/${baigeId}.webp`}
                alt={card.name}
                className="!p-0"
            />
        </a>
    );
}

export default function Changelog() {
    const [changelog, setChangelog] = useState<ChangelogData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    useEffect(() => {
        fetch('/changelog.json')
            .then(res => res.json())
            .then((data: ChangelogData) => {
                setChangelog(data);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    // 加载完成后检测 hash 并滚动到锚点
    useEffect(() => {
        if (!loading && changelog) {
            const hash = window.location.hash;
            if (hash === '#changelog') {
                // 展开第一条
                setExpandedIndex(0);
                setTimeout(() => {
                    const element = document.getElementById('changelog');
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            }
        }
    }, [loading, changelog]);

    if (loading) {
        return (
            <div className="animate-pulse">
                <div className="h-6 bg-(--background-tertiary) rounded w-32 mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-(--background-tertiary) rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!changelog || changelog.updates.length === 0) {
        return null;
    }

    // 只显示最近 5 条更新
    const recentUpdates = changelog.updates.slice(0, 5);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric'
        });
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div>
            {/* 锚点，向上偏移以补偿导航栏高度 */}
            <div id="changelog" className="relative -top-20" />
            <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-(--foreground)">卡片数据更新</h3>
            </div>

            <div className="space-y-3">
                {recentUpdates.map((update, index) => (
                    <div
                        key={update.version}
                        className="rounded-xl border border-(--card-border) overflow-hidden transition-all hover:border-(--foreground-muted)"
                    >
                        {/* 更新头部 */}
                        <button
                            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-(--card-bg) hover:bg-(--background-secondary) transition-colors"
                        >
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="px-2 py-0.5 text-xs font-mono rounded bg-(--primary)/10 text-(--primary)" title="Master Duel CDN 版本号">
                                    版本号 {update.version}
                                </span>
                                <span className="text-xs text-(--foreground-muted) pl-2" title={formatDateTime(update.sync_date)}>
                                    网站自动更新于 {formatDate(update.sync_date)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {update.added_count > 0 && (
                                    <span className="text-xs text-(--success) whitespace-nowrap">
                                        +{update.added_count} 新卡
                                    </span>
                                )}
                                {update.updated_count > 0 && (
                                    <span className="text-xs text-(--warning) whitespace-nowrap">
                                        {update.updated_count} 更新
                                    </span>
                                )}
                                <svg
                                    className={`w-4 h-4 text-(--foreground-muted) transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {/* 展开的卡片列表 */}
                        {expandedIndex === index && (
                            <div className="px-4 py-4 border-t border-(--card-border) bg-(--background-secondary)">
                                {/* 新增卡片文字说明 */}
                                {update.added_cards.length > 0 && (
                                    <p className="text-sm text-(--foreground-muted) mb-3">
                                        <span className="text-(--success)">新增 {update.added_count} 张卡片</span>
                                        ：{update.added_cards.map((c, i) => (
                                            <span key={c.id}>
                                                <CardNameLink card={c} />
                                                {i < update.added_cards.length - 1 && '、'}
                                            </span>
                                        ))}
                                    </p>
                                )}
                                {/* 更新卡片文字说明 */}
                                {update.updated_cards.length > 0 && (
                                    <p className="text-sm text-(--foreground-muted) mb-3">
                                        <span className="text-(--warning)">更新 {update.updated_count} 张卡片</span>
                                        ：{update.updated_cards.map((c, i) => (
                                            <span key={c.id}>
                                                <CardNameLink card={c} />
                                                {i < update.updated_cards.length - 1 && '、'}
                                            </span>
                                        ))}
                                    </p>
                                )}
                                {/* 卡图展示 */}
                                {update.added_cards.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 overflow-visible mt-4">
                                        {update.added_cards.slice(0, 10).map(card => (
                                            <ChangelogCard key={card.id} card={card} />
                                        ))}
                                        {update.added_cards.length > 10 && (
                                            <div className="aspect-[59/86] rounded-lg bg-(--background-tertiary) border border-(--card-border) flex items-center justify-center">
                                                <span className="text-xs text-(--foreground-muted)">
                                                    +{update.added_cards.length - 10} 更多
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 数据库统计 */}
            {recentUpdates[0] && (
                <div className="mt-4 text-center">
                    <span className="text-xs text-(--foreground-subtle)">
                        当前数据库共 {recentUpdates[0].total_cards.toLocaleString()} 张卡片
                    </span>
                </div>
            )}
        </div>
    );
}
