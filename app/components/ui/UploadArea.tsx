import React, { useRef, useState, useEffect } from 'react';
import Changelog from './Changelog';
import { apiUrl } from '@/app/config';
import { useTranslation } from '@/app/i18n';
import LanguageSwitcher from './LanguageSwitcher';

interface UploadAreaProps {
    isInitializing: boolean;
    modelDownloadProgress: number | null;
    onFileSelect: (file: File) => void;
    onYdkImport?: (ydkText: string) => void;
    onHistoryClick?: () => void;
    onQuickStart?: () => void;
    historyCount?: number;
}

export default function UploadArea({ isInitializing, modelDownloadProgress, onFileSelect, onYdkImport, onHistoryClick, onQuickStart, historyCount = 0 }: UploadAreaProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [deckCount, setDeckCount] = useState<number | null>(null);
    const [showYdkModal, setShowYdkModal] = useState(false);
    const [ydkText, setYdkText] = useState('');

    useEffect(() => {
        fetch(`${apiUrl}/stats`)
            .then(res => res.json())
            .then(data => {
                if (typeof data.deckCount === 'number') {
                    setDeckCount(data.deckCount);
                }
            })
            .catch(() => {});
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (!file) return;

        // 检查是否为 YDK 文件
        if (file.name.endsWith('.ydk') && onYdkImport) {
            file.text().then(text => onYdkImport(text));
            return;
        }

        if (file.type.startsWith('image/')) {
            onFileSelect(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect(file);
        }
    };

    return (
        <div className="absolute inset-0 z-20 overflow-auto bg-(--background)">
            {/* 顶部导航 */}
            <nav className="sticky top-0 z-50 bg-(--background)/80 backdrop-blur-sm border-b border-(--card-border)">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-(--primary) flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <span className="font-semibold text-(--foreground)">GetDeck</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onQuickStart}
                            className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>{t('header.quickStart')}</span>
                        </button>
                        <a
                            href="#changelog"
                            className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">{t('header.changelog')}</span>
                        </a>
                        <LanguageSwitcher />
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
                </div>
            </nav>

            {/* Hero 区域 */}
            <section className="relative py-8 sm:py-16 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    {/* 标签 */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--background-secondary) border border-(--card-border) mb-6 sm:mb-8">
                        <span className="w-2 h-2 rounded-full bg-(--accent) animate-pulse"></span>
                        <span className="text-xs sm:text-sm text-(--foreground-muted)">
                            {deckCount !== null ? t('upload.heroDeckCount', { count: deckCount.toLocaleString() }) : t('upload.heroTag')}
                        </span>
                    </div>

                    {/* 主标题 */}
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-6 whitespace-nowrap">
                        <span className="text-neutral-700 dark:text-neutral-200">{t('upload.title')}</span><br className="sm:hidden" />
                        <span className="text-(--primary)">{t('upload.titleHighlight')}</span>
                    </h1>

                    {/* 副标题 */}
                    <p className="text-lg sm:text-xl text-(--foreground-muted) max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed">
                        {t('upload.subtitle').split('\n').map((line, i) => (
                            <React.Fragment key={i}>{i > 0 && <br className="hidden sm:block" />}{line}</React.Fragment>
                        ))}
                    </p>

                    {/* 上传区域 - 即使模型在下载也允许上传 */}
                    <div
                        className={`max-w-xl mx-auto p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${isDragOver
                            ? 'border-(--primary) bg-(--primary-light) scale-[1.02]'
                            : 'border-(--card-border) hover:border-(--primary) hover:bg-(--background-secondary)'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-(--primary) text-white' : 'bg-(--background-tertiary) text-(--foreground-muted)'
                                }`}>
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-medium text-(--foreground) mb-1">
                                    {isDragOver ? t('upload.dropRelease') : t('upload.dropHint')}
                                </p>
                                <p className="text-sm text-(--foreground-muted)">
                                    {t('upload.supportFormat')}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                    className="flex-1 sm:flex-none px-8 py-2.5 bg-(--primary) text-white rounded-lg font-medium hover:bg-(--primary-hover) transition-colors flex items-center justify-center gap-2 shadow-lg shadow-(--primary)/20"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    {t('upload.selectFile')}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowYdkModal(true);
                                    }}
                                    className="sm:hidden flex-1 px-6 py-2.5 bg-(--background-secondary) text-(--foreground) border border-(--card-border) rounded-lg font-medium hover:bg-(--background-tertiary) transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    {t('upload.pasteYdk')}
                                </button>
                            </div>
                            <p className="text-xs text-(--foreground-subtle) hidden sm:block">
                                {t('upload.pasteHint', { shortcut: 'Ctrl+V' })}
                            </p>
                        </div>
                    </div>

                    {/* 历史记录入口 */}
                    {onHistoryClick && historyCount > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onHistoryClick();
                            }}
                            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--background-secondary) border border-(--card-border) text-sm text-(--foreground-muted) hover:text-(--foreground) hover:border-(--foreground-muted) transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('upload.history')}
                            <span className="px-1.5 py-0.5 rounded bg-(--card-border) text-xs">
                                {historyCount}
                            </span>
                        </button>
                    )}
                </div>
            </section>

            {/* 更新日志 */}
            <section className="py-16 sm:py-20 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <Changelog />
                </div>
            </section>

            {/* 使用步骤 */}
            <section className="py-16 sm:py-20 px-4 sm:px-6 bg-(--background-secondary)">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-bold text-(--foreground) text-center mb-4">
                        {t('upload.stepsTitle')}
                    </h2>
                    <p className="text-(--foreground-muted) text-center mb-12 sm:mb-16 max-w-xl mx-auto">
                        {t('upload.stepsSubtitle')}
                    </p>

                    <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
                        {[
                            {
                                step: '01',
                                title: t('upload.step1Title'),
                                desc: t('upload.step1Desc')
                            },
                            {
                                step: '02',
                                title: t('upload.step2Title'),
                                desc: t('upload.step2Desc')
                            },
                            {
                                step: '03',
                                title: t('upload.step3Title'),
                                desc: t('upload.step3Desc')
                            }
                        ].map((item, i) => (
                            <div key={i} className="relative">
                                <div className="text-5xl sm:text-6xl font-bold text-(--card-border) mb-4">
                                    {item.step}
                                </div>
                                <h3 className="text-lg font-semibold text-(--foreground) mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-(--foreground-muted) leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 特性展示 */}
            <section className="py-16 sm:py-20 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    {/* <h2 className="text-2xl sm:text-3xl font-bold text-(--foreground) text-center mb-12 sm:mb-16">
                        为什么选择 GetDeck
                    </h2> */}

                    <div className="grid sm:grid-cols-2 gap-6">
                        {[
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                ),
                                title: t('upload.featurePrivacyTitle'),
                                desc: t('upload.featurePrivacyDesc')
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                ),
                                title: t('upload.featureSpeedTitle'),
                                desc: t('upload.featureSpeedDesc')
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                ),
                                title: t('upload.featureAccuracyTitle'),
                                desc: t('upload.featureAccuracyDesc')
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                    </svg>
                                ),
                                title: t('upload.featureManualTitle'),
                                desc: t('upload.featureManualDesc')
                            }
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="p-6 rounded-xl border border-(--card-border) hover:border-(--foreground-muted) transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-(--primary) flex items-center justify-center text-white mb-4">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-(--foreground) mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-(--foreground-muted) leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 技术栈 */}
            <section className="py-12 sm:py-16 px-4 sm:px-6 border-t border-(--card-border)">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-sm text-(--foreground-muted) mb-6">
                        {t('upload.techStackLabel')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm text-(--foreground-subtle)">
                        {['Next.js', 'ONNX Runtime', 'WebAssembly', 'YOLOv11', 'TypeScript'].map((tech) => (
                            <span key={tech} className="px-3 py-1.5 rounded-full bg-(--background-secondary)">
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* 底部 CTA
            <section className="py-16 sm:py-20 px-4 sm:px-6 bg-(--background-secondary)">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-(--foreground) mb-4">
                        准备好了吗？
                    </h2>
                    <p className="text-(--foreground-muted) mb-8">
                        上传你的第一张卡组截图，体验秒级识别
                    </p>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-8 py-3 bg-(--foreground) text-(--background) rounded-lg font-medium hover:opacity-90 transition-opacity text-lg"
                    >
                        开始使用
                    </button>
                </div>
            </section> */}

            {/* 页脚 */}
            <footer className="py-8 px-4 sm:px-6 border-t border-(--card-border)">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-(--foreground-muted)">
                    <p>{t('upload.footerCopyright')}</p>
                    <div className="flex items-center gap-6">
                        <a href="/about" className="hover:text-(--primary) transition-colors">{t('common.about')}</a>
                        <a href="https://github.com/Souls-R/GetDeck" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">GitHub</a>
                        <a href="https://github.com/Souls-R/GetDeck/issues" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">{t('common.feedback')}</a>
                        <a href="https://github.com/Souls-R/GetDeck/wiki/GetDeck-API-%E6%96%87%E6%A1%A3" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">API</a>
                        <a href="https://qm.qq.com/q/BMOI04uaNG" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">{t('common.joinGroup')}</a>
                    </div>
                </div>
            </footer>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,.ydk"
                onChange={handleFileChange}
            />

            {/* YDK 粘贴弹窗 */}
            {showYdkModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div 
                        className="bg-(--card-bg) rounded-2xl shadow-2xl border border-(--card-border) p-6 max-w-lg w-full animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-(--primary)/10 flex items-center justify-center shrink-0">
                                <svg className="w-6 h-6 text-(--primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{t('upload.ydkModalTitle')}</h3>
                                <p className="text-xs text-(--foreground-muted)">{t('upload.ydkModalHint')}</p>
                            </div>
                        </div>

                        <textarea
                            autoFocus
                            className="w-full h-48 p-4 rounded-xl bg-(--background-secondary) border border-(--card-border) text-sm font-mono focus:border-(--primary) focus:ring-1 focus:ring-(--primary) outline-none transition-all resize-none mb-6 custom-scrollbar"
                            placeholder="#main..."
                            value={ydkText}
                            onChange={(e) => setYdkText(e.target.value)}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowYdkModal(false);
                                    setYdkText('');
                                }}
                                className="flex-1 py-3 rounded-xl bg-(--background-secondary) text-(--foreground) font-medium hover:bg-(--card-border) transition-all active:scale-[0.98]"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    if (ydkText.trim() && onYdkImport) {
                                        onYdkImport(ydkText);
                                        setShowYdkModal(false);
                                        setYdkText('');
                                    }
                                }}
                                disabled={!ydkText.trim()}
                                className="flex-1 py-3 rounded-xl bg-(--primary) text-white font-bold hover:bg-(--primary-hover) transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-(--primary)/20"
                            >
                                {t('upload.ydkImport')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
