"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/app/i18n';

const STORAGE_KEY = 'getdeck-welcome-shown-v3';

interface WelcomeModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
    const { t, locale } = useTranslation();
    const [autoShow, setAutoShow] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            setAutoShow(true);
        }
    }, []);

    const show = isOpen ?? autoShow;

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setAutoShow(false);
        onClose?.();
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

            {/* 弹窗内容 */}
            <div className="relative w-full max-w-md bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--card-border)] overflow-hidden animate-scale-in">
                {/* 头部 */}
                <div className="px-5 pt-5 pb-4 border-b border-[var(--card-border)]">
                    <h2 className="text-lg font-bold text-[var(--foreground)]">{t('welcome.title')}</h2>
                    <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{t('welcome.subtitle')}</p>
                </div>

                {/* 内容 */}
                <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto text-sm text-[var(--foreground-muted)]">
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">{t('welcome.scopeTitle')}</p>
                        <p className="text-xs pl-3">
                            {t('welcome.scopeDesc')}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">{t('welcome.tipsTitle')}</p>
                        <p className="text-xs pl-3 leading-relaxed">
                            {t('welcome.tipsDesc')}
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>{t('welcome.tipCrop')}
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>{t('welcome.tipUpload')}
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>{t('welcome.tipDeckList')}
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{t('welcome.tipHelp')}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">{t('welcome.disclaimerTitle')}</p>
                        <p className="text-xs pl-3">
                            {t('welcome.disclaimerDesc')}
                        </p>
                    </div>
                    <p className="text-[10px] text-[var(--foreground-muted)]">{t('welcome.reopenHint')}</p>
                </div>

                {/* 社交链接 */}
                <div className="px-5 py-3 border-t border-[var(--card-border)]">
                    <div className="flex gap-3">
                        <a
                            href="https://space.bilibili.com/501465442"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--card-border)] hover:border-[var(--primary)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                            <svg className="w-4 h-4 text-[#fb7299]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.659.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z" />
                            </svg>
                            <span className="text-xs whitespace-nowrap">{t('welcome.followBilibili')}</span>
                        </a>
                        {locale === 'zh' ? (
                        <a
                            href="https://qm.qq.com/q/BMOI04uaNG"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--card-border)] hover:border-[var(--primary)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                            <svg className="w-4 h-4 text-[#12b7f5]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.212 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z" />
                            </svg>
                            <span className="text-xs">{t('welcome.joinGroup')}</span>
                        </a>
                        ) : (
                        <a
                            href="https://github.com/Souls-R/getdeck"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--card-border)] hover:border-[var(--primary)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                            <svg className="w-4 h-4 text-[var(--foreground)]" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                            </svg>
                            <span className="text-xs">GitHub</span>
                        </a>
                        )}
                        <a
                            href="https://discord.gg/gcPUgPBGw3"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--card-border)] hover:border-[var(--primary)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                            <svg className="w-4 h-4 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                            <span className="text-xs">Discord</span>
                        </a>
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="px-5 py-4">
                    <button
                        onClick={handleClose}
                        className="w-full py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium transition-colors"
                    >
                        {t('common.gotIt')}
                    </button>
                </div>
            </div>
        </div>
    );
}
