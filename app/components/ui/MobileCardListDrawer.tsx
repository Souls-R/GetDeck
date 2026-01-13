import React from 'react';
import { RecognizedCard } from '../../types';
import { ProcessingStage } from '../../hooks/useRecognition';
import BottomDrawer from './BottomDrawer';

interface MobileCardListDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    processingStage: ProcessingStage;
    recognizedCards: RecognizedCard[];
    onSelectCard: (index: number) => void;
}

export default function MobileCardListDrawer({
    isOpen,
    onClose,
    processingStage,
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
        <BottomDrawer isOpen={isOpen} onClose={onClose} maxHeight="92vh">
            {/* 处理中状态 - 简化显示 */}
            {processingStage === 'identifying' && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-(--card-border) border-t-(--primary) animate-spin mb-4" />
                    <p className="text-foreground font-medium">正在识别...</p>
                </div>
            )}

            {/* 卡片列表 */}
            {processingStage === 'done' && (
                <div className="flex flex-col">
                    {/* 头部统计 */}
                    <div className="p-4 border-b border-(--card-border) bg-gradient-card">
                        <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                                <span className="text-lg font-bold text-white">{recognizedCards.length}</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-foreground">识别完成</h2>
                                <p className="text-xs text-(--foreground-muted)">{cardGroups.length} 种卡片</p>
                            </div>
                        </div>
                    </div>

                    {/* 卡片列表 */}
                    <div className="p-2 space-y-1">
                        {cardGroups.map((group, groupIndex) => (
                            <button
                                key={groupIndex}
                                onClick={() => handleCardClick(group.indices[0])}
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
                        {processingStage === 'detecting' ? '正在检测卡片...' : '等待上传'}
                    </p>
                    <p className="text-sm text-(--foreground-muted)">
                        {processingStage === 'detecting' ? '请稍候' : '上传卡组截图开始识别'}
                    </p>
                </div>
            )}
        </BottomDrawer>
    );
}
