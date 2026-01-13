import React from 'react';

interface HeaderProps {
    show?: boolean;
}

export default function Header({
    show = true
}: HeaderProps) {
    if (!show) return null;

    return (
        <header className="h-14 flex items-center justify-between px-6 bg-[var(--card-bg)] border-b border-[var(--card-border)] shrink-0 z-10">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                </div>
                <div>
                    <h1 className="text-sm font-bold text-[var(--foreground)]">GetDeck</h1>
                    <p className="text-[10px] text-[var(--foreground-muted)] -mt-0.5">Master Duel 卡组识别</p>
                </div>
            </div>
        </header>
    );
}
