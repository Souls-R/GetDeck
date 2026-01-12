import React from 'react';
import { RecognizedCard } from '../../types';
import { ProcessingStage, ProcessingVisual } from '../../hooks/useRecognition';
import BottomDrawer from './BottomDrawer';

interface MobileCardListDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    processingStage: ProcessingStage;
    processingVisual: ProcessingVisual | null;
    recognizedCards: RecognizedCard[];
    onSelectCard: (index: number) => void;
}

export default function MobileCardListDrawer({
    isOpen,
    onClose,
    processingStage,
    processingVisual,
    recognizedCards,
    onSelectCard
}: MobileCardListDrawerProps) {
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

    const handleCardClick = (index: number) => {
        onSelectCard(index);
        onClose();
    };

    return (
        <BottomDrawer isOpen={isOpen} onClose={onClose} maxHeight="70vh">
            {/* 处理中状态 */}
            {processingStage === 'identifying' && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="mb-4">
                        <span className="badge">正在识别</span>
                    </div>

                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-[var(--primary)]/20 bg-[var(--background-secondary)] shadow-xl mb-4">
                        {processingVisual?.artworkUrl && (
                            <img
                                src={processingVisual.artworkUrl}
                                className="w-full h-full object-contain animate-pulse-soft"
                                alt="processing"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--primary)]/20 to-transparent" />
                    </div>

                    <div className="space-y-1">
                        <div className="text-3xl font-light text-[var(--foreground)]">
                            {processingVisual?.index || 0}
                            <span className="text-lg text-[var(--foreground-muted)]"> / {recognizedCards.length}</span>
                        </div>
                        <div className="text-sm text-[var(--foreground-muted)] truncate max-w-[200px]">
                            {processingVisual?.currentMatchName}
                        </div>
                    </div>
                </div>
            )}

            {/* 卡片列表 */}
            {processingStage === 'done' && (
                <div className="flex flex-col">
                    {/* 头部统计 */}
                    <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card">
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

                    {/* 卡片列表 */}
                    <div className="p-2 space-y-1">
                        {cardGroups.map((group, groupIndex) => (
                            <button
                                key={groupIndex}
                                onClick={() => handleCardClick(group.indices[0])}
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
                                    {/* 类型标记 */}
                                    {group.cardType === 'pendulum' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)] font-medium">P</span>
                                    )}
                                    <svg className="w-3.5 h-3.5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <div className="w-16 h-16 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4">
                        {processingStage === 'detecting' ? (
                            <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                        ) : (
                            <svg className="w-8 h-8 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        )}
                    </div>
                    <p className="text-[var(--foreground)] font-medium mb-1">
                        {processingStage === 'detecting' ? '正在检测卡片...' : '等待上传'}
                    </p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {processingStage === 'detecting' ? '请稍候' : '上传卡组截图开始识别'}
                    </p>
                </div>
            )}
        </BottomDrawer>
    );
}
