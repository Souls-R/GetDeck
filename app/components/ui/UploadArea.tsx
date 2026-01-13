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
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-main p-4 sm:p-8 overflow-auto">
            <div className="w-full max-w-2xl animate-float-in my-auto">
                {/* Hero Title */}
                <div className="text-center mb-6 sm:mb-10">
                    <div className="inline-flex items-center gap-3 mb-4 sm:mb-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
                            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-3">
                        GetDeck
                    </h1>
                    <p className="text-sm sm:text-lg text-(--foreground-muted)">
                        上传 Master Duel 卡组截图，智能识别卡组内容
                    </p>
                </div>

                {/* Upload Area */}
                {isInitializing ? (
                    <div className="panel panel-elevated p-8 sm:p-12 flex flex-col items-center gap-4 sm:gap-6">
                        <div className="relative">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-(--card-border) border-t-(--primary) animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-foreground font-medium mb-1">
                                {modelDownloadProgress !== null ? '正在下载模型...' : '正在加载模型资源'}
                            </p>
                            <p className="text-xs sm:text-sm text-(--foreground-muted)">
                                {modelDownloadProgress !== null
                                    ? `下载进度: ${modelDownloadProgress}%`
                                    : '首次加载可能需要几秒钟...'}
                            </p>
                        </div>
                        {/* 下载进度条 */}
                        {modelDownloadProgress !== null && (
                            <div className="w-full max-w-xs">
                                <div className="h-2 bg-(--card-border) rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
                                        style={{ width: `${modelDownloadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className={`panel panel-elevated p-6 sm:p-12 transition-all duration-300 cursor-pointer ${
                            isDragOver
                                ? 'border-(--primary) bg-(--primary-light) scale-[1.02]'
                                : 'hover:border-(--primary) hover:shadow-xl'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex flex-col items-center gap-4 sm:gap-6">
                            {/* Upload Icon */}
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                isDragOver
                                    ? 'bg-(--primary) text-white scale-110'
                                    : 'bg-(--background-secondary) text-(--foreground-muted)'
                            }`}>
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>

                            {/* Text */}
                            <div className="text-center">
                                <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2">
                                    {isDragOver ? '释放以上传' : '拖拽图片到此处'}
                                </p>
                                <p className="text-sm text-(--foreground-muted)">
                                    或点击选择文件
                                </p>
                            </div>

                            {/* Divider - 移动端隐藏 */}
                            <div className="hidden sm:flex items-center gap-4 w-full max-w-xs">
                                <div className="flex-1 h-px bg-(--card-border)"></div>
                                <span className="text-xs text-(--foreground-muted) uppercase">或者</span>
                                <div className="flex-1 h-px bg-(--card-border)"></div>
                            </div>

                            {/* Paste Hint - 移动端隐藏 */}
                            <div className="hidden sm:flex items-center gap-2 text-sm text-(--foreground-muted)">
                                <span>按</span>
                                <kbd className="px-2 py-1 rounded-lg bg-(--background-secondary) border border-(--card-border) font-mono text-xs">
                                    Ctrl + V
                                </kbd>
                                <span>粘贴截图</span>
                            </div>

                            {/* Action Button */}
                            <button className="mt-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 btn-interactive text-sm sm:text-base">
                                选择文件
                            </button>
                        </div>
                    </div>
                )}

                {/* Features - 移动端隐藏 */}
                <div className="hidden sm:grid mt-10 grid-cols-3 gap-6">
                    {[
                        { icon: '🚀', title: '快速识别', desc: '瞬间完成卡片识别' },
                        { icon: '🎯', title: '卡组码生成', desc: '一键获取MasterDuel可用的卡组码' },
                        { icon: '✨', title: '本地处理', desc: '无需上传到服务器' }
                    ].map((feature, i) => (
                        <div key={i} className="text-center animate-float-in" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className="text-2xl mb-2">{feature.icon}</div>
                            <p className="font-medium text-foreground text-sm">{feature.title}</p>
                            <p className="text-xs text-(--foreground-muted)">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
}
