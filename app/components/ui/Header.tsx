import React from 'react';
import { ProcessingStage } from '../../hooks/useRecognition';

interface HeaderProps {
    statusText: string;
    progress: number;
    processingStage: ProcessingStage;
    isInitializing: boolean;
    hasImage: boolean;
    onCropClick: () => void;
    onFileClick: () => void;
}

export default function Header({
    statusText,
    progress,
    processingStage,
    isInitializing,
    hasImage,
    onCropClick,
    onFileClick
}: HeaderProps) {
    const isProcessing = processingStage === 'detecting' || processingStage === 'identifying';

    return (
        <header className="h-16 flex items-center justify-between px-8 bg-[var(--card-bg)] border-b border-[var(--card-border)] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-[var(--foreground)]">
                            GetDeck
                        </h1>
                        <p className="text-xs text-[var(--foreground-muted)]">Master Duel 卡组识别</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {isProcessing && (
                    <div className="flex items-center gap-4 animate-float-in">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-sm text-[var(--foreground-muted)]">{statusText}</span>
                        </div>
                        <div className="w-40 h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden">
                            <div
                                className="h-full progress-gradient transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-sm font-mono text-[var(--primary)]">{progress}%</span>
                    </div>
                )}

                {hasImage && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCropClick}
                            disabled={isInitializing || isProcessing}
                            className="p-2.5 rounded-xl bg-[var(--background-secondary)] hover:bg-[var(--card-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-200 btn-interactive disabled:opacity-50 disabled:pointer-events-none"
                            title="裁剪图片"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                        </button>
                        <button
                            onClick={onFileClick}
                            disabled={isInitializing || isProcessing}
                            className="p-2.5 rounded-xl bg-[var(--background-secondary)] hover:bg-[var(--card-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-200 btn-interactive disabled:opacity-50 disabled:pointer-events-none"
                            title="打开新文件"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
