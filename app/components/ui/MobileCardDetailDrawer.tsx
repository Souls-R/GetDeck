import React, { useCallback, useState, useEffect } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import BottomDrawer from './BottomDrawer';
import MobileCardCarousel from './MobileCardCarousel';

interface MobileCardDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    onSelectCard: (index: number) => void;
    getCardInfo: (cardName: string) => CardInfo | null;
    isDetailLoading: boolean;
    getCardArtwork: (index: number) => string | null;
    forcePendulumMode: boolean;
    onToggleCardMode: () => void;
    onSelectAltMatch: (matchIndex: number) => void;
    onMoveCardBox: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

// 解析卡片类型字符串
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
            badget2 = badget2 + '/' + starMatch[1];
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

export default function MobileCardDetailDrawer({
    isOpen,
    onClose,
    recognizedCards,
    selectedCardIndex,
    onSelectCard,
    getCardInfo,
    isDetailLoading,
    getCardArtwork,
    forcePendulumMode,
    onToggleCardMode,
    onSelectAltMatch,
    onMoveCardBox
}: MobileCardDetailDrawerProps) {
    // 识别源面板状态
    const [showSourcePanel, setShowSourcePanel] = useState(false);

    // 当前卡片信息（用于固定头部显示）
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

    useEffect(() => {
        const newName = currentMatch?.name || '';
        if (newName !== displayName && newName) {
            setIsNameFading(true);
            const timer = setTimeout(() => {
                setDisplayName(newName);
                setIsNameFading(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [currentMatch?.name, displayName]);

    useEffect(() => {
        const types = cardInfo?.result?.[0]?.text?.types;
        const newBadges = types ? parseCardTypes(types) : [];
        const badgesKey = newBadges.join('|');
        const displayKey = displayBadges.join('|');

        if (badgesKey !== displayKey) {
            setIsBadgesFading(true);
            const timer = setTimeout(() => {
                setDisplayBadges(newBadges);
                setIsBadgesFading(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [cardInfo?.result?.[0]?.text?.types, displayBadges]);

    // 处理轮播索引变化
    const handleIndexChange = useCallback((newIndex: number) => {
        onSelectCard(newIndex);
    }, [onSelectCard]);

    // 切换识别源面板
    const handleToggleSourcePanel = useCallback(() => {
        setShowSourcePanel(prev => !prev);
    }, []);

    // 提取卡片的唯一键
    const keyExtractor = useCallback((_card: RecognizedCard, index: number) => {
        return index;
    }, []);

    // 渲染单个卡片的滑动内容（只有卡图、ATK/DEF、描述、备选匹配）
    const renderCardContent = useCallback((card: RecognizedCard, index: number, isActive: boolean) => {
        const match = card.matches[card.selectedMatchIndex];
        const info = match ? getCardInfo(match.name) : null;
        const cardResult = info?.result?.[0];

        return (
            <div className="p-4 space-y-4">
                {/* 官方卡图 */}
                {cardResult && (
                    <div className="space-y-4">
                        <div className="w-full rounded-xl overflow-hidden shadow-lg border border-[var(--card-border)]">
                            <FadeImage
                                src={`https://cdn.233.momobako.com/ygoimg/sc/${cardResult.id}.webp`}
                                alt="Official Art"
                                className="w-full"
                            />
                        </div>

                        {/* ATK/DEF */}
                        {(cardResult.text.atk !== undefined || cardResult.text.def !== undefined) && (
                            <div className="flex gap-3">
                                {cardResult.text.atk !== undefined && (
                                    <div className="flex-1 panel p-3 text-center">
                                        <div className="text-xs text-[var(--foreground-muted)]">ATK</div>
                                        <div className="text-xl font-bold text-[var(--warning)]">
                                            {cardResult.text.atk}
                                        </div>
                                    </div>
                                )}
                                {cardResult.text.def !== undefined && (
                                    <div className="flex-1 panel p-3 text-center">
                                        <div className="text-xs text-[var(--foreground-muted)]">DEF</div>
                                        <div className="text-xl font-bold text-[var(--primary)]">
                                            {cardResult.text.def}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 卡片描述 */}
                        {cardResult.text.desc && (
                            <div className="panel p-3">
                                <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                                    {formatCardDesc(cardResult.text.desc)}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 加载状态 */}
                {isActive && isDetailLoading && (
                    <div className="flex items-center justify-center py-6">
                        <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                    </div>
                )}

                {/* 备选匹配 */}
                {card.matches.length > 1 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                            备选匹配
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
    }, [getCardInfo, isDetailLoading, onSelectAltMatch]);

    if (recognizedCards.length === 0) return null;

    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={onClose}
            maxHeight="80vh"
            enableHorizontalSwipe={true}
        >
            <div className="flex flex-col h-full">
                {/* 固定头部 */}
                <div className="flex-shrink-0 p-4 border-b border-[var(--card-border)] bg-gradient-card">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <h2 className={`text-lg font-bold text-[var(--foreground)] line-clamp-2 leading-tight flex-1 min-w-0 transition-opacity duration-150 ${isNameFading ? 'opacity-0' : 'opacity-100'}`}>
                            {displayName}
                        </h2>
                        {/* 位置指示器 + 识别源按钮 */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-[var(--foreground-muted)] font-mono">
                                {selectedCardIndex + 1}/{recognizedCards.length}
                            </span>
                            <button
                                onClick={handleToggleSourcePanel}
                                className={`p-1 rounded-lg transition-colors ${
                                    showSourcePanel
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                }`}
                                title="识别源图像"
                            >
                                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* 徽章 */}
                    <div className={`flex flex-wrap gap-1.5 transition-opacity duration-150 ${isBadgesFading ? 'opacity-0' : 'opacity-100'}`}>
                        {displayBadges.map((badge, i) => (
                            <span key={i} className="badge text-xs">{badge}</span>
                        ))}
                    </div>

                    {/* 识别源面板 */}
                    {showSourcePanel && (
                        <div className="mt-3 pt-3 border-t border-[var(--card-border)] animate-slide-up">
                            <div className="flex items-center gap-3">
                                {/* 预览图 - 只有这个会随卡片变化 */}
                                <div className="w-14 h-14 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                    {artwork ? (
                                        <FadeImage src={artwork} alt="source crop" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-[var(--foreground-muted)]">无</span>
                                    )}
                                </div>
                                {/* 模式切换 */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                                !forcePendulumMode
                                                    ? 'bg-[var(--primary)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                            }`}
                                        >
                                            标准
                                        </button>
                                        <button
                                            onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                                forcePendulumMode
                                                    ? 'bg-[var(--success)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                            }`}
                                        >
                                            灵摆
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-[var(--foreground-muted)]">点击方向键微调选区</span>
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
                <div className="flex-1 min-h-0">
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
        </BottomDrawer>
    );
}
