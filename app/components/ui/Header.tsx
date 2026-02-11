import React from 'react';
import { useTranslation } from '@/app/i18n';

interface HeaderProps {
    show?: boolean;
    onQuickStart?: () => void;
}

export default function Header({
    show = true,
    onQuickStart
}: HeaderProps) {
    if (!show) return null;

    const { t } = useTranslation();

    return (
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-(--card-bg) border-b border-(--card-border) shrink-0 z-10">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-(--primary) flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <span className="font-semibold text-(--foreground)">GetDeck</span>
            </a>
            <div className="flex items-center gap-4">
                {onQuickStart && (
                    <button
                        onClick={onQuickStart}
                        className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="hidden sm:inline">{t('header.quickStart')}</span>
                    </button>
                )}
                <a
                    href="/#changelog"
                    onClick={(e) => {
                        e.preventDefault();
                        window.location.href = window.location.origin + '/?_t=' + Date.now() + '#changelog';
                    }}
                    className="hidden sm:flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden sm:inline">{t('header.changelog')}</span>
                </a>
                <a
                    href="https://github.com/Souls-R/getdeck"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                    </svg>
                    <span className="hidden sm:inline">GitHub</span>
                </a>
            </div>
        </header>
    );
}
