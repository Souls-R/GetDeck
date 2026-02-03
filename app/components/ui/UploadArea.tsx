import React, { useRef, useState } from 'react';

interface UploadAreaProps {
    isInitializing: boolean;
    modelDownloadProgress: number | null;
    onFileSelect: (file: File) => void;
}

export default function UploadArea({ isInitializing, modelDownloadProgress, onFileSelect }: UploadAreaProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

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
        if (file && file.type.startsWith('image/')) {
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
                    <a
                        href="https://github.com/Souls-R/getdeck"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-(--foreground-muted) hover:text-(--foreground) transition-colors"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                        </svg>
                        GitHub
                    </a>
                </div>
            </nav>

            {/* Hero 区域 */}
            <section className="relative py-16 sm:py-24 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    {/* 标签 */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--background-secondary) border border-(--card-border) mb-6 sm:mb-8">
                        <span className="w-2 h-2 rounded-full bg-(--accent) animate-pulse"></span>
                        <span className="text-xs sm:text-sm text-(--foreground-muted)">开源免费 · 离线识别</span>
                    </div>

                    {/* 主标题 */}
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-6">
                        <span className="text-neutral-700 dark:text-neutral-200">Master Duel</span><br className="sm:hidden" />
                        <span className="text-(--primary)"> 卡组识别</span>
                    </h1>

                    {/* 副标题 */}
                    <p className="text-lg sm:text-xl text-(--foreground-muted) max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed">
                        上传游戏卡组截图，瞬间识别所有卡片，<br className="hidden sm:block" />
                        一键生成可直接导入游戏的卡组码
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
                                    {isDragOver ? '释放以上传图片' : '拖拽截图到这里'}
                                </p>
                                <p className="text-sm text-(--foreground-muted)">
                                    支持 PNG、JPG 格式
                                </p>
                            </div>
                            <button className="px-6 py-2.5 bg-(--primary) text-white rounded-lg font-medium hover:bg-(--primary-hover) transition-colors">
                                选择文件
                            </button>
                            <p className="text-xs text-(--foreground-subtle) hidden sm:block">
                                或按 <kbd className="px-1.5 py-0.5 rounded bg-(--background-tertiary) border border-(--card-border) font-mono">Ctrl+V</kbd> 粘贴截图
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 使用步骤 */}
            <section className="py-16 sm:py-20 px-4 sm:px-6 bg-(--background-secondary)">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-bold text-(--foreground) text-center mb-4">
                        三步完成卡组导出
                    </h2>
                    <p className="text-(--foreground-muted) text-center mb-12 sm:mb-16 max-w-xl mx-auto">
                        无需注册、无需安装，打开网页即可使用
                    </p>

                    <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
                        {[
                            {
                                step: '01',
                                title: '截图上传',
                                desc: '上传 Master Duel 中截取卡组编辑界面或其他人分享的卡组截图'
                            },
                            {
                                step: '02',
                                title: 'AI 识别',
                                desc: '基于 YOLO 模型的本地 AI 自动识别，精准定位每张卡片'
                            },
                            {
                                step: '03',
                                title: '导出卡组',
                                desc: '一键复制卡组码，直接粘贴到游戏中即可导入'
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
                                title: '完全隐私',
                                desc: '所有处理在本地浏览器完成，图片不会上传到任何服务器'
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                ),
                                title: '极速识别',
                                desc: '基于 WebAssembly 加速，识别速度快至毫秒级，无需等待'
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                ),
                                title: '高精度',
                                desc: '覆盖 Master Duel 全部卡片数据库，支持日文、繁中、简中等多语言卡图'
                            },
                            {
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                    </svg>
                                ),
                                title: '手动微调',
                                desc: '识别结果可手动调整，支持框选修正和候选卡片切换，确保结果准确'
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
                        基于现代 Web 技术构建
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
                    <p>© 2026 GetDeck. 开源项目，使用 MIT 协议。</p>
                    <div className="flex gap-6">
                        <a href="/about" className="hover:text-(--primary) transition-colors">关于</a>
                        <a href="https://github.com/Souls-R/GetDeck" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">GitHub</a>
                        <a href="https://github.com/Souls-R/GetDeck/issues" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">反馈</a>
                    </div>
                </div>
            </footer>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
