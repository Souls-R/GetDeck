import React, { useState, useEffect, useRef } from 'react';

interface FloatingToolbarProps {
    onCropClick: () => void;
    onUploadClick: () => void;
    onCardListClick?: () => void;
    showCardListButton?: boolean;
    cardCount?: number;
    disabled?: boolean;
}

export default function FloatingToolbar({
    onCropClick,
    onUploadClick,
    onCardListClick,
    showCardListButton = false,
    cardCount = 0,
    disabled = false
}: FloatingToolbarProps) {
    const [showAboutTip, setShowAboutTip] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 点击外部关闭固定的悬浮窗
    useEffect(() => {
        if (!isPinned) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                tooltipRef.current &&
                !tooltipRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setIsPinned(false);
                setShowAboutTip(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPinned]);

    const handleAboutClick = () => {
        if (isPinned) {
            setIsPinned(false);
            setShowAboutTip(false);
        } else {
            setIsPinned(true);
            setShowAboutTip(true);
        }
    };

    const handleMouseEnter = () => {
        if (!isPinned) {
            setShowAboutTip(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isPinned) {
            setShowAboutTip(false);
        }
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            {/* About Tooltip */}
            {showAboutTip && (
                <div
                    ref={tooltipRef}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl animate-float-in"
                >
                    <div className="text-xs text-[var(--foreground)] space-y-2">
                        <p className="font-medium text-[var(--foreground)]">使用提示</p>
                        {isMobile ? (
                            <ul className="text-[var(--foreground-muted)] space-y-1.5">
                                <li>• 点击上传按钮添加卡组截图</li>
                                <li>• 左右滑动底部卡片可快速浏览</li>
                                <li className="flex items-center gap-1">• 点击卡名右侧 <svg className="w-3.5 h-3.5 inline text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> 按钮微调识别区域</li>
                                <li>• 在卡组列表界面查看所有卡片并生成卡组码</li>
                            </ul>
                        ) : (
                            <ul className="text-[var(--foreground-muted)] space-y-1.5">
                                <li>• <kbd className="px-1 py-0.5 rounded bg-[var(--background-secondary)] text-[10px]">Ctrl+V</kbd> 粘贴截图或点击上传按钮快速识别</li>
                                <li>• 直接点击卡片或使用 <kbd className="px-1 py-0.5 rounded bg-[var(--background-secondary)] text-[10px]">↑</kbd><kbd className="px-1 py-0.5 rounded bg-[var(--background-secondary)] text-[10px]">↓</kbd><kbd className="px-1 py-0.5 rounded bg-[var(--background-secondary)] text-[10px]">←</kbd><kbd className="px-1 py-0.5 rounded bg-[var(--background-secondary)] text-[10px]">→</kbd> 键浏览卡片</li>
                                <li className="flex items-center gap-1">• 点击右上角的 <svg className="w-3.5 h-3.5 inline text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> 按钮微调识别区域</li>
                                <li>• 点击空白处查看卡组列表并生成卡组码</li>
                            </ul>
                        )}
                        <div className="pt-2 mt-2 border-t border-[var(--card-border)] flex items-center justify-between">
                            <span className="text-[10px] text-[var(--foreground-muted)]">
                                GetDeck · Master Duel 卡组识别
                            </span>
                            <a
                                href="https://github.com/Souls-R/getdeck"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                                title="GitHub"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                            </a>
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

                {/* Card List Button - 移动端和PC端都显示 */}
                {(showCardListButton || cardCount > 0) && (
                    <>
                        <div className="w-px h-6 bg-[var(--card-border)]" />
                        <button
                            onClick={onCardListClick}
                            disabled={disabled}
                            className="p-3 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all disabled:opacity-40 disabled:pointer-events-none relative"
                            title="卡组列表"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {cardCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                                    {cardCount > 99 ? '99+' : cardCount}
                                </span>
                            )}
                        </button>
                    </>
                )}

                {/* Divider */}
                <div className="w-px h-6 bg-[var(--card-border)]" />

                {/* About */}
                <button
                    ref={buttonRef}
                    onClick={handleAboutClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={`p-3 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all ${isPinned ? 'bg-[var(--background-secondary)] text-[var(--foreground)]' : ''}`}
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
