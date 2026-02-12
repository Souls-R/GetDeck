import React, { useState, useRef, useEffect } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import { ProcessingStage } from '../../hooks/useRecognition';
import HoloCard from './HoloCard';
import { useTranslation } from '@/app/i18n';
import { getCardBadges, globalCardInfoCache } from '../../utils/cardApi';
import { getLocalizedCardName, getLocalizedCardText } from '../../i18n/cardName';
import { getCardImageUrl } from '../../config';

interface SidebarProps {
    processingStage: ProcessingStage;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    selectedCardInfo: CardInfo | null;
    isDetailLoading: boolean;
    selectedCardArtwork: string | null;
    forcePendulumMode: boolean;
    onToggleCardMode: () => void;
    onSelectAltMatch: (matchIndex: number) => void;
    onSelectCard: (index: number) => void;
    onMoveCardBox: (direction: 'up' | 'down' | 'left' | 'right') => void;
    scrollPosition: number;
    onScrollPositionChange: (position: number) => void;
    onGenerateDeckCode: () => void;
    isGeneratingDeckCode: boolean;
    onShare: () => void;
    onExportYdk: () => void;
    isExportingYdk: boolean;
    ydkExported: boolean;
    sourceType?: 'image' | 'ydk';
}

// 格式化卡片描述文字，在①②③等效果编号前添加换行
function formatCardDesc(desc: string): string {
    if (!desc) return '';
    // 在①②③④⑤⑥⑦⑧⑨⑩前面添加换行（如果前面不是换行符）
    return desc.replace(/([^\n])(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)(?=：|:)/g, '$1\n$2');
}

export default function Sidebar({
    processingStage,
    recognizedCards,
    selectedCardIndex,
    selectedCardInfo,
    isDetailLoading,
    selectedCardArtwork,
    forcePendulumMode,
    onToggleCardMode,
    onSelectAltMatch,
    onSelectCard,
    onMoveCardBox,
    scrollPosition,
    onScrollPositionChange,
    onGenerateDeckCode,
    isGeneratingDeckCode,
    onShare,
    onExportYdk,
    isExportingYdk,
    ydkExported,
    sourceType = 'image'
}: SidebarProps) {
    const { t, locale } = useTranslation();
    const [isSourcePanelExpanded, setIsSourcePanelExpanded] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // ydkExported 变为 false 时关闭菜单
    useEffect(() => {
        if (!ydkExported && !isExportingYdk) {
            setShowExportMenu(false);
        }
    }, [ydkExported, isExportingYdk]);

    // 卡片列表滚动容器 ref
    const cardListScrollRef = useRef<HTMLDivElement>(null);

    // 滚动时实时保存位置
    const handleScroll = () => {
        if (cardListScrollRef.current) {
            onScrollPositionChange(cardListScrollRef.current.scrollTop);
        }
    };

    // 当从详情视图切换回列表视图时，恢复滚动位置
    const prevSelectedCardIndexRef = useRef<number>(selectedCardIndex);
    useEffect(() => {
        // 从详情视图切换回列表视图时，恢复滚动位置
        if (prevSelectedCardIndexRef.current !== -1 && selectedCardIndex === -1) {
            setTimeout(() => {
                if (cardListScrollRef.current) {
                    cardListScrollRef.current.scrollTop = scrollPosition;
                }
            }, 0);
        }
        prevSelectedCardIndexRef.current = selectedCardIndex;
    }, [selectedCardIndex, scrollPosition]);

    const selectedCard = selectedCardIndex !== -1 ? recognizedCards[selectedCardIndex] : null;
    const currentMatch = selectedCard?.matches?.[selectedCard.selectedMatchIndex];

    return (
        <div className="w-[400px] h-full border-l border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col shrink-0 overflow-hidden">
            {/* 处理中状态 - 简化显示 */}
            {(processingStage === 'detecting' || processingStage === 'identifying') && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-12 h-12 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin mb-4" />
                    <p className="text-[var(--foreground)] font-medium">{t('sidebar.recognizing')}</p>
                </div>
            )}

            {/* 卡片详情 */}
            {processingStage === 'done' && selectedCardIndex !== -1 && selectedCard && (
                <div className="flex flex-col h-full animate-scale-in">
                    {/* 头部 */}
                    <div className="p-6 border-b border-[var(--card-border)] bg-gradient-card">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h2
                                onClick={() => {
                                    if (selectedCardInfo?.password) {
                                        window.open(`https://ygocdb.com/card/${selectedCardInfo.password}`, '_blank');
                                    }
                                }}
                                className="text-xl font-bold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline line-clamp-2 leading-tight flex-1 min-w-0 cursor-pointer transition-colors"
                            >
                                {currentMatch ? getLocalizedCardName(selectedCardInfo, currentMatch.name, locale) : ''}
                            </h2>
                            {/* 识别源按钮(图片模式) / 关闭按钮(YDK模式) */}
                            {sourceType === 'ydk' ? (
                                <button
                                    onClick={() => onSelectCard(-1)}
                                    className="p-1.5 rounded-lg transition-colors shrink-0 bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                                    title={t('sidebar.backToList')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsSourcePanelExpanded(!isSourcePanelExpanded)}
                                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${isSourcePanelExpanded
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                        }`}
                                    title={t('sidebar.sourceImage')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {selectedCardInfo && (
                            <div className="flex flex-wrap gap-2">
                                {getCardBadges(selectedCardInfo, locale).map((badge, i) => (
                                    <span key={i} className="badge text-xs">{badge}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {/* 识别源面板 - 默认折叠 */}
                        {isSourcePanelExpanded && (
                            <div className="panel p-4 space-y-4 animate-slide-up">
                                <div className="flex items-center gap-3">
                                    {/* 预览图 */}
                                    <div className="w-16 h-16 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                        {selectedCardArtwork ? (
                                            <img src={selectedCardArtwork} className="w-full h-full object-contain" alt="source crop" draggable={false} />
                                        ) : (
                                            <span className="text-xs text-[var(--foreground-muted)]">{t('sidebar.noSource')}</span>
                                        )}
                                    </div>
                                    {/* 模式切换按钮 */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${!forcePendulumMode
                                                ? 'bg-[var(--primary)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                                }`}
                                        >
                                            {t('sidebar.standardCard')}
                                        </button>
                                        <button
                                            onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${forcePendulumMode
                                                ? 'bg-[var(--success)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                                }`}
                                        >
                                            {t('sidebar.pendulumCard')}
                                        </button>
                                    </div>
                                    {/* 四向微调按钮 */}
                                    <div className="relative w-16 h-16 shrink-0">
                                        <button
                                            onClick={() => onMoveCardBox('up')}
                                            className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-md bg-[var(--background-secondary)] hover:bg-[var(--primary)] hover:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                            title={t('sidebar.moveUp')}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onMoveCardBox('down')}
                                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-md bg-[var(--background-secondary)] hover:bg-[var(--primary)] hover:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                            title={t('sidebar.moveDown')}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onMoveCardBox('left')}
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-[var(--background-secondary)] hover:bg-[var(--primary)] hover:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                            title={t('sidebar.moveLeft')}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onMoveCardBox('right')}
                                            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-[var(--background-secondary)] hover:bg-[var(--primary)] hover:text-white text-[var(--foreground-muted)] transition-colors flex items-center justify-center"
                                            title={t('sidebar.moveRight')}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        {/* 中心点 */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--foreground-muted)]/30" />
                                    </div>
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                    {t('sidebar.adjustHint')}
                                </p>
                            </div>
                        )}

                        {/* 官方卡图 */}
                        {selectedCardInfo && (
                            <div className="space-y-4">
                                <div className="w-full rounded-xl overflow-visible">
                                    <HoloCard
                                        src={getCardImageUrl(selectedCardInfo.password, locale)}
                                        alt="Official Art"
                                    />
                                </div>

                                {/* 卡片描述 */}
                                <div className="panel p-4">
                                    <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                                        {formatCardDesc(getLocalizedCardText(selectedCardInfo, locale))}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 加载状态 */}
                        {isDetailLoading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                            </div>
                        )}

                        {/* 备选匹配 */}
                        {selectedCard.matches.length > 1 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                    {t('sidebar.altMatches')}
                                </h3>
                                {selectedCard.matches.map((m, idx) => (
                                    idx !== selectedCard.selectedMatchIndex && (
                                        <button
                                            key={idx}
                                            onClick={() => onSelectAltMatch(idx)}
                                            className="w-full text-left p-4 rounded-[8px] bg-[var(--background-secondary)] border border-transparent hover:border-[var(--primary)]/30 transition-all duration-200 group card-hover"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] truncate flex-1 font-medium">
                                                    {getLocalizedCardName(globalCardInfoCache[m.name], m.name, locale)}
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
                </div>
            )}

            {/* 空状态 - 显示卡片列表 */}
            {processingStage === 'done' && selectedCardIndex === -1 && (() => {
                // 合并相同卡片
                const cardGroups: { name: string; count: number; indices: number[]; cardType: string }[] = [];
                recognizedCards.forEach((card, index) => {
                    const match = card.matches[card.selectedMatchIndex];
                    if (!match) return;
                    const displayName = getLocalizedCardName(globalCardInfoCache[match.name], match.name, locale);

                    const existing = cardGroups.find(g => g.name === displayName);
                    if (existing) {
                        existing.count++;
                        existing.indices.push(index);
                    } else {
                        cardGroups.push({
                            name: displayName,
                            count: 1,
                            indices: [index],
                            cardType: match.cardType
                        });
                    }
                });

                return (
                    <div className="flex flex-col h-full">
                        {/* 头部统计 */}
                        <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow">
                                        <span className="text-lg font-bold text-white">{recognizedCards.length}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-[var(--foreground)]">{t('sidebar.recognitionDone')}</h2>
                                        <p className="text-xs text-[var(--foreground-muted)]">{t('sidebar.cardTypes', { count: cardGroups.length })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* 分享按钮 */}
                                    <button
                                        onClick={onShare}
                                        className="p-1.5 rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)] transition-colors"
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
                                            className={`px-3 py-1.5 text-sm rounded-l-lg font-medium transition-colors flex items-center gap-1.5 ${isGeneratingDeckCode
                                                ? 'bg-(--primary)/70 text-white cursor-not-allowed'
                                                : 'bg-(--primary) text-white hover:bg-(--primary)/90'
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
                                                        onClick={() => { onExportYdk(); }}
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
                            {/* 识别数量较少时的提示 */}
                            {recognizedCards.length < 20 && (
                                <div className="mt-3 px-3 py-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5 text-[var(--warning)] animate-fade-in">
                                    <div className="flex gap-2.5 items-center">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-xs font-medium leading-normal opacity-90">
                                            {t('sidebar.lowCountWarning')}<br />{t('sidebar.lowCountCropHint').split('{icon}')[0]}<svg className="w-3.5 h-3.5 inline-block align-text-bottom" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>{t('sidebar.lowCountCropHint').split('{icon}')[1]}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 卡片列表 */}
                        <div ref={cardListScrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            <div className="space-y-1">
                                {cardGroups.map((group, groupIndex) => (
                                    <button
                                        key={groupIndex}
                                        onClick={() => onSelectCard(group.indices[0])}
                                        className="w-full text-left px-3 py-2 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)] border border-transparent hover:border-[var(--primary)]/30 transition-all duration-150 group"
                                    >
                                        <div className="flex items-center gap-2">
                                            {/* 数量 */}
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${group.count > 1
                                                ? 'bg-[var(--primary)] text-white'
                                                : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground-muted)]'
                                                }`}>
                                                {group.count}
                                            </div>
                                            {/* 卡名 */}
                                            <span className="flex-1 text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] truncate transition-colors">
                                                {group.name}
                                            </span>
                                            {/* 类型标记 */}
                                            {group.cardType === 'pendulum' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)] font-medium">P</span>
                                            )}
                                            <svg className="w-3.5 h-3.5 text-[var(--foreground-muted)] group-hover:text-[var(--primary)] transition-colors opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* 空闲状态 */}
            {processingStage === 'idle' && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <p className="text-[var(--foreground)] font-medium mb-2">{t('sidebar.waitingUpload')}</p>
                    <p className="text-sm text-[var(--foreground-muted)]">{t('sidebar.uploadHint')}</p>
                </div>
            )}
        </div>
    );
}
