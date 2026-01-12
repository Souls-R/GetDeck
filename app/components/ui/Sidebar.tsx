import React, { useState } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import { ProcessingStage, ProcessingVisual } from '../../hooks/useRecognition';

interface SidebarProps {
    processingStage: ProcessingStage;
    processingVisual: ProcessingVisual | null;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    selectedCardInfo: CardInfo | null;
    isDetailLoading: boolean;
    selectedCardArtwork: string | null;
    forcePendulumMode: boolean;
    onToggleCardMode: () => void;
    onSelectAltMatch: (matchIndex: number) => void;
    onSelectCard: (index: number) => void;
}

// 解析卡片类型字符串
// API格式: "[怪兽|效果] 鸟兽/风\n[★4] 100/600"
function parseCardTypes(typesStr: string): string[] {
    const badges: string[] = [];

    // 提取主类型 [怪兽|效果]
    const mainTypeMatch = typesStr.match(/\[([^\]]+)\]/);
    if (mainTypeMatch) {
        const mainType = mainTypeMatch[1];
        // 排除星级
        if (!mainType.startsWith('★') && !mainType.startsWith('☆')) {
            badges.push(mainType.replace(/\|/g, '/'));
        }
    }

    // 提取种族/属性（在第一个方括号后、换行前的部分）
    const firstLine = typesStr.split('\n')[0];
    const afterBracket = firstLine.replace(/\[[^\]]+\]\s*/, '').trim();
    if (afterBracket) {
        // 分割种族/属性，每个单独一个徽章
        const subTypes = afterBracket.split('/').map(s => s.trim()).filter(s => s);
        badges.push(...subTypes);
    }

    // 提取星级
    const starMatch = typesStr.match(/\[(★\d+|☆\d+)\]/);
    if (starMatch) {
        badges.push(starMatch[1]);
    }

    // 提取 ATK/DEF（第二行的数值）
    // const secondLine = typesStr.split('\n')[1];
    // if (secondLine) {
    //     const atkDefMatch = secondLine.match(/(\d+)\/(\d+)/);
    //     if (atkDefMatch) {
    //         badges.push(`${atkDefMatch[1]}/${atkDefMatch[2]}`);
    //     }
    // }

    return badges;
}

// 格式化卡片描述文字，在①②③等效果编号前添加换行
function formatCardDesc(desc: string): string {
    if (!desc) return '';
    // 在①②③④⑤⑥⑦⑧⑨⑩前面添加换行（如果前面不是换行符）
    return desc.replace(/([^\n])(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)(?=：|:)/g, '$1\n$2');
}

export default function Sidebar({
    processingStage,
    processingVisual,
    recognizedCards,
    selectedCardIndex,
    selectedCardInfo,
    isDetailLoading,
    selectedCardArtwork,
    forcePendulumMode,
    onToggleCardMode,
    onSelectAltMatch,
    onSelectCard
}: SidebarProps) {
    const [isSourcePanelExpanded, setIsSourcePanelExpanded] = useState(false);

    const selectedCard = selectedCardIndex !== -1 ? recognizedCards[selectedCardIndex] : null;
    const currentMatch = selectedCard?.matches?.[selectedCard.selectedMatchIndex];

    return (
        <div className="w-[400px] border-l border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col shrink-0 overflow-hidden">
            {/* 处理中状态 */}
            {processingStage === 'identifying' && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-float-in">
                    <div className="mb-6">
                        <span className="badge">正在识别</span>
                    </div>

                    <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-[var(--primary)]/20 bg-[var(--background-secondary)] shadow-xl mb-6">
                        {processingVisual?.artworkUrl && (
                            <img
                                src={processingVisual.artworkUrl}
                                className="w-full h-full object-contain animate-pulse-soft"
                                alt="processing"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--primary)]/20 to-transparent" />
                    </div>

                    <div className="space-y-2">
                        <div className="text-4xl font-light text-[var(--foreground)]">
                            {processingVisual?.index || 0}
                            <span className="text-xl text-[var(--foreground-muted)]"> / {recognizedCards.length}</span>
                        </div>
                        <div className="text-sm text-[var(--foreground-muted)] truncate max-w-[200px]">
                            {processingVisual?.currentMatchName}
                        </div>
                    </div>
                </div>
            )}

            {/* 卡片详情 */}
            {processingStage === 'done' && selectedCardIndex !== -1 && selectedCard && (
                <div className="flex flex-col h-full animate-scale-in">
                    {/* 头部 */}
                    <div className="p-6 border-b border-[var(--card-border)] bg-gradient-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2 line-clamp-2 leading-tight">
                                    {currentMatch?.name}
                                </h2>
                                {selectedCardInfo?.result?.[0]?.text?.types && (
                                    <div className="flex flex-wrap gap-2">
                                        {parseCardTypes(selectedCardInfo.result[0].text.types).map((badge, i) => (
                                            <span key={i} className="badge text-xs">{badge}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* 识别源按钮 */}
                            <button
                                onClick={() => setIsSourcePanelExpanded(!isSourcePanelExpanded)}
                                className={`p-2 rounded-lg transition-colors shrink-0 ${
                                    isSourcePanelExpanded
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                }`}
                                title="识别源图像"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {/* 识别源面板 - 默认折叠 */}
                        {isSourcePanelExpanded && (
                            <div className="panel p-4 space-y-4 animate-slide-up">
                                <div className="flex items-center gap-3">
                                    {/* 预览图 */}
                                    <div className="w-16 h-16 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                        {selectedCardArtwork ? (
                                            <img src={selectedCardArtwork} className="w-full h-full object-contain" alt="source crop" />
                                        ) : (
                                            <span className="text-xs text-[var(--foreground-muted)]">无</span>
                                        )}
                                    </div>
                                    {/* 模式切换按钮 */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                                !forcePendulumMode
                                                    ? 'bg-[var(--primary)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            标准卡
                                        </button>
                                        <button
                                            onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                                forcePendulumMode
                                                    ? 'bg-[var(--success)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            灵摆卡
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                    在左侧画布上长按并拖动卡片边框，可以微调识别区域
                                </p>
                            </div>
                        )}

                        {/* 官方卡图 */}
                        {selectedCardInfo?.result?.[0] && (
                            <div className="space-y-4">
                                <div className="w-full rounded-xl overflow-hidden shadow-xl border border-[var(--card-border)] card-hover">
                                    <img
                                        src={`https://cdn.233.momobako.com/ygoimg/sc/${selectedCardInfo.result[0].id}.webp`}
                                        className="w-full"
                                        alt="Official Art"
                                    />
                                </div>

                                {/* ATK/DEF */}
                                {(selectedCardInfo.result[0].text.atk !== undefined ||
                                    selectedCardInfo.result[0].text.def !== undefined) && (
                                    <div className="flex gap-3">
                                        {selectedCardInfo.result[0].text.atk !== undefined && (
                                            <div className="flex-1 panel p-3 text-center">
                                                <div className="text-xs text-[var(--foreground-muted)] mb-1">ATK</div>
                                                <div className="text-lg font-bold text-[var(--warning)]">
                                                    {selectedCardInfo.result[0].text.atk}
                                                </div>
                                            </div>
                                        )}
                                        {selectedCardInfo.result[0].text.def !== undefined && (
                                            <div className="flex-1 panel p-3 text-center">
                                                <div className="text-xs text-[var(--foreground-muted)] mb-1">DEF</div>
                                                <div className="text-lg font-bold text-[var(--primary)]">
                                                    {selectedCardInfo.result[0].text.def}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 卡片描述 */}
                                <div className="panel p-4">
                                    <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                                        {formatCardDesc(selectedCardInfo.result[0].text.desc || '')}
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
                                    备选匹配
                                </h3>
                                {selectedCard.matches.map((m, idx) => (
                                    idx !== selectedCard.selectedMatchIndex && (
                                        <button
                                            key={idx}
                                            onClick={() => onSelectAltMatch(idx)}
                                            className="w-full text-left p-4 rounded-xl bg-[var(--background-secondary)] hover:bg-[var(--card-border)] border border-transparent hover:border-[var(--primary)]/30 transition-all duration-200 group card-hover"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] truncate flex-1 font-medium">
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
                </div>
            )}

            {/* 空状态 - 显示卡片列表 */}
            {processingStage === 'done' && selectedCardIndex === -1 && (() => {
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

                return (
                    <div className="flex flex-col h-full">
                        {/* 头部统计 */}
                        <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                                        <span className="text-lg font-bold text-white">{recognizedCards.length}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-[var(--foreground)]">识别完成</h2>
                                        <p className="text-xs text-[var(--foreground-muted)]">{cardGroups.length} 种卡片</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 卡片列表 */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            <div className="space-y-1">
                                {cardGroups.map((group, groupIndex) => (
                                    <button
                                        key={groupIndex}
                                        onClick={() => onSelectCard(group.indices[0])}
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
                    <p className="text-[var(--foreground)] font-medium mb-2">等待上传</p>
                    <p className="text-sm text-[var(--foreground-muted)]">上传卡组截图开始识别</p>
                </div>
            )}
        </div>
    );
}
