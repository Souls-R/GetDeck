"use client";

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'getdeck-welcome-shown';

interface WelcomeModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
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
                    <h2 className="text-lg font-bold text-[var(--foreground)]">快速开始</h2>
                    <p className="text-xs text-[var(--foreground-muted)] mt-0.5">记得向分享构筑的人表示感谢，不要拿了卡组就跑哦~</p>
                </div>

                {/* 内容 */}
                <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto text-sm text-[var(--foreground-muted)]">
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">适用范围</p>
                        <p className="text-xs pl-3">
                            本工具适用于 Master Duel（游戏王：大师决斗）的卡组截图识别，对其他类型的截图可能效果不佳。
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">使用提示</p>
                        <p className="text-xs pl-3 leading-relaxed">
                            上传卡组截图后自动识别卡片，支持手动微调识别区域。识别完成后可生成卡组码，方便导入游戏。屏幕底部工具栏中：
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg> 裁剪图片、
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> 上传新截图、
                            <svg className="w-3.5 h-3.5 inline-block align-text-bottom mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 查看更多帮助。
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[var(--foreground)] mb-1">免责声明</p>
                        <p className="text-xs pl-3">
                            本工具仅供学习交流使用，与 KONAMI 官方无关。卡片数据来源于公开资料，如有侵权请联系删除。
                        </p>
                    </div>
                    <p className="text-[10px] text-[var(--foreground-muted)]">可随时点击顶部「快速开始」再次查看本页</p>
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
                            <span className="text-xs">关注 B 站</span>
                        </a>
                        <a
                            href="https://qm.qq.com/q/BMOI04uaNG"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--card-border)] hover:border-[var(--primary)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        >
                            <svg className="w-4 h-4 text-[#12b7f5]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.212 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z" />
                            </svg>
                            <span className="text-xs">加入群聊</span>
                        </a>
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
                    </div>
                </div>

                {/* 底部按钮 */}
                <div className="px-5 py-4">
                    <button
                        onClick={handleClose}
                        className="w-full py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium transition-colors"
                    >
                        我知道了
                    </button>
                </div>
            </div>
        </div>
    );
}
