import React, { useState } from 'react';

interface FloatingToolbarProps {
    onCropClick: () => void;
    onUploadClick: () => void;
    disabled?: boolean;
}

export default function FloatingToolbar({
    onCropClick,
    onUploadClick,
    disabled = false
}: FloatingToolbarProps) {
    const [showAboutTip, setShowAboutTip] = useState(false);

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            {/* About Tooltip */}
            {showAboutTip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl animate-float-in">
                    <div className="text-xs text-[var(--foreground)] space-y-2">
                        <p className="font-medium text-[var(--foreground)]">使用提示</p>
                        <ul className="text-[var(--foreground-muted)] space-y-1">
                            <li>• 长按卡片边框可微调位置并重新识别</li>
                            <li>• 点击右侧列表查看卡片详情</li>
                            <li>• 支持 Ctrl+V 粘贴截图</li>
                        </ul>
                        <div className="pt-2 mt-2 border-t border-[var(--card-border)] text-[10px] text-[var(--foreground-muted)]">
                            GetDeck · Master Duel 卡组识别工具
                        </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[var(--card-bg)] border-r border-b border-[var(--card-border)]" />
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-2 py-2 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl">
                {/* Crop */}
                <button
                    onClick={onCropClick}
                    disabled={disabled}
                    className="p-3 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="裁剪图片"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <line x1="20" y1="4" x2="8.12" y2="15.88" />
                        <line x1="14.47" y1="14.48" x2="20" y2="20" />
                        <line x1="8.12" y1="8.12" x2="12" y2="12" />
                    </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--card-border)]" />

                {/* Upload */}
                <button
                    onClick={onUploadClick}
                    disabled={disabled}
                    className="p-3 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="上传新截图"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--card-border)]" />

                {/* About */}
                <button
                    onMouseEnter={() => setShowAboutTip(true)}
                    onMouseLeave={() => setShowAboutTip(false)}
                    className="p-3 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all"
                    title="关于"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
