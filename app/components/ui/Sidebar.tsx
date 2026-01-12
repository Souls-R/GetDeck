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
    onSelectAltMatch
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
                        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2 line-clamp-2 leading-tight">
                            {currentMatch?.name}
                        </h2>
                        {selectedCardInfo?.result?.[0]?.text?.types && (
                            <div className="flex flex-wrap gap-2">
                                {selectedCardInfo.result[0].text.types.split('/').map((type, i) => (
                                    <span key={i} className="badge text-xs">{type.trim()}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        {/* 源图像面板 */}
                        <div className="panel overflow-hidden">
                            <button
                                onClick={() => setIsSourcePanelExpanded(!isSourcePanelExpanded)}
                                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    识别源图像
                                </span>
                                <svg
                                    className={`w-5 h-5 transition-transform duration-300 ${isSourcePanelExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isSourcePanelExpanded && (
                                <div className="p-4 pt-0 space-y-4 animate-slide-up">
                                    {/* 模式切换 */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { if (forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                                !forcePendulumMode
                                                    ? 'bg-[var(--primary)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            Standard
                                        </button>
                                        <button
                                            onClick={() => { if (!forcePendulumMode) onToggleCardMode(); }}
                                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                                                forcePendulumMode
                                                    ? 'bg-[var(--success)] text-white shadow-md'
                                                    : 'bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            Pendulum
                                        </button>
                                    </div>

                                    {/* 预览图 */}
                                    <div className="flex gap-4 items-center">
                                        <div className="w-24 h-24 rounded-xl bg-[var(--background-secondary)] border border-[var(--card-border)] flex items-center justify-center overflow-hidden shrink-0">
                                            {selectedCardArtwork ? (
                                                <img src={selectedCardArtwork} className="w-full h-full object-contain" alt="source crop" />
                                            ) : (
                                                <span className="text-xs text-[var(--foreground-muted)]">无图像</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                                            在左侧画布上长按并拖动卡片边框可以微调识别区域
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 官方卡图 */}
                        {selectedCardInfo?.result?.[0] && (
                            <div className="space-y-4">
                                <div className="w-44 mx-auto rounded-xl overflow-hidden shadow-xl border border-[var(--card-border)] card-hover">
                                    <img
                                        src={`https://cdn.233.momobako.com/ygoimg/sc/${selectedCardInfo.result[0].id}.webp`}
                                        className="w-full"
                                        alt="Official Art"
                                    />
                                </div>

                                {/* 卡片描述 */}
                                <div className="panel p-4">
                                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
                                        {selectedCardInfo.result[0].text.desc}
                                    </p>
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

            {/* 空状态 */}
            {processingStage === 'done' && selectedCardIndex === -1 && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div className="text-5xl font-light text-[var(--primary)] mb-4">
                        {recognizedCards.length}
                    </div>
                    <p className="text-[var(--foreground)] font-medium mb-2">张卡片已识别</p>
                    <p className="text-sm text-[var(--foreground-muted)]">点击左侧卡片查看详情</p>
                </div>
            )}

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
