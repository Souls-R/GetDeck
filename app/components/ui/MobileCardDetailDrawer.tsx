import React, { useState } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import BottomDrawer from './BottomDrawer';

interface MobileCardDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCard: RecognizedCard | null;
    selectedCardInfo: CardInfo | null;
    isDetailLoading: boolean;
    selectedCardArtwork: string | null;
    forcePendulumMode: boolean;
    onToggleCardMode: () => void;
    onSelectAltMatch: (matchIndex: number) => void;
}

export default function MobileCardDetailDrawer({
    isOpen,
    onClose,
    selectedCard,
    selectedCardInfo,
    isDetailLoading,
    selectedCardArtwork,
    forcePendulumMode,
    onToggleCardMode,
    onSelectAltMatch
}: MobileCardDetailDrawerProps) {
    const [showSourcePanel, setShowSourcePanel] = useState(false);
    const currentMatch = selectedCard?.matches?.[selectedCard.selectedMatchIndex];

    if (!selectedCard) return null;

    return (
        <BottomDrawer isOpen={isOpen} onClose={onClose} maxHeight="80vh">
            <div className="flex flex-col">
                {/* 头部 */}
                <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-[var(--foreground)] mb-2 line-clamp-2 leading-tight">
                                {currentMatch?.name}
                            </h2>
                            {selectedCardInfo?.result?.[0]?.text?.types && (
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedCardInfo.result[0].text.types.split('/').map((type, i) => (
                                        <span key={i} className="badge text-xs">{type.trim()}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* 识别源按钮 */}
                        <button
                            onClick={() => setShowSourcePanel(!showSourcePanel)}
                            className={`p-2 rounded-lg transition-colors shrink-0 ${
                                showSourcePanel
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                            }`}
                            title="识别源图像"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>

                    {/* 识别源面板 - 展开时显示 */}
                    {showSourcePanel && (
                        <div className="mt-3 pt-3 border-t border-[var(--card-border)] animate-slide-up">
                            <div className="flex items-center gap-3">
                                {/* 预览图 */}
                                <div className="w-16 h-16 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                    {selectedCardArtwork ? (
                                        <img src={selectedCardArtwork} className="w-full h-full object-contain" alt="source crop" />
                                    ) : (
                                        <span className="text-xs text-[var(--foreground-muted)]">无</span>
                                    )}
                                </div>
                                {/* 模式切换 */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                            !forcePendulumMode
                                                ? 'bg-[var(--primary)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                        }`}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                            forcePendulumMode
                                                ? 'bg-[var(--success)] text-white shadow-md'
                                                : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)]'
                                        }`}
                                    >
                                        Pendulum
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 内容区域 */}
                <div className="p-4 space-y-4">
                    {/* 官方卡图 */}
                    {selectedCardInfo?.result?.[0] && (
                        <div className="space-y-4">
                            {/* 卡图 - 占满宽度 */}
                            <div className="w-full rounded-xl overflow-hidden shadow-lg border border-[var(--card-border)]">
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
                                            <div className="text-xs text-[var(--foreground-muted)]">ATK</div>
                                            <div className="text-xl font-bold text-[var(--warning)]">
                                                {selectedCardInfo.result[0].text.atk}
                                            </div>
                                        </div>
                                    )}
                                    {selectedCardInfo.result[0].text.def !== undefined && (
                                        <div className="flex-1 panel p-3 text-center">
                                    <div className="text-xs text-[var(--foreground-muted)]">DEF</div>
                                            <div className="text-xl font-bold text-[var(--primary)]">
                                           {selectedCardInfo.result[0].text.def}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 卡片描述 */}
                            {selectedCardInfo.result[0].text.desc && (
                                <div className="panel p-3">
                                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
                                        {selectedCardInfo.result[0].text.desc}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 加载状态 */}
                    {isDetailLoading && (
                        <div className="flex items-center justify-center py-6">
                            <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                        </div>
                    )}

                    {/* 备选匹配 */}
                    {selectedCard.matches.length > 1 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                备选匹配
                            </h3>
                            {selectedCard.matches.map((m, idx) => (
                                idx !== selectedCard.selectedMatchIndex && (
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
            </div>
        </BottomDrawer>
    );
}
