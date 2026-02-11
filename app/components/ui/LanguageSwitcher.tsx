import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, type Locale } from '@/app/i18n';

const locales: Locale[] = ['zh', 'ja', 'en'];

export default function LanguageSwitcher() {
    const { locale, setLocale, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors cursor-pointer"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="hidden sm:inline">{t(`language.${locale}`)}</span>
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-2 py-1 bg-(--card-bg) border border-(--card-border) rounded-lg shadow-lg min-w-[100px] z-50">
                    {locales.map((l) => (
                        <button
                            key={l}
                            onClick={() => { setLocale(l); setOpen(false); }}
                            className={`w-full px-4 py-1.5 text-sm text-left transition-colors ${locale === l ? 'text-(--primary) font-medium' : 'text-(--foreground-muted) hover:text-(--foreground) hover:bg-(--background-secondary)'}`}
                        >
                            {t(`language.${l}`)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
