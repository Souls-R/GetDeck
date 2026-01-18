"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function AboutPage() {
    // 解除全局滚动限制
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        
        // 保存原始样式
        const originalHtmlOverflow = html.style.overflow;
        const originalBodyOverflow = body.style.overflow;
        const originalBodyPosition = body.style.position;
        const originalBodyHeight = body.style.height;
        const originalBodyWidth = body.style.width;
        
        // 解除 html 和 body 的限制
        html.style.overflow = 'auto';
        body.style.overflow = 'auto';
        body.style.position = 'static';
        body.style.height = 'auto';
        body.style.width = 'auto';
        
        // 清理函数：恢复原始样式
        return () => {
            html.style.overflow = originalHtmlOverflow;
            body.style.overflow = originalBodyOverflow;
            body.style.position = originalBodyPosition;
            body.style.height = originalBodyHeight;
            body.style.width = originalBodyWidth;
        };
    }, []);

    return (
        <div className="min-h-screen bg-(--background)">
            {/* 顶部导航 */}
            <nav className="sticky top-0 z-50 bg-(--background)/80 backdrop-blur-sm border-b border-(--card-border)">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-(--primary) flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <span className="font-semibold text-(--foreground)">GetDeck</span>
                    </Link>
                    <Link 
                        href="/"
                        className="text-sm text-(--foreground-muted) hover:text-(--primary) transition-colors"
                    >
                        ← 返回首页
                    </Link>
                </div>
            </nav>

            {/* 主内容区 */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                {/* 页面标题 */}
                <div className="mb-12 sm:mb-16">
                    <h1 className="text-3xl sm:text-4xl font-bold text-neutral-700 dark:text-neutral-200 mb-4">
                        关于 <span className="text-(--primary)">GetDeck</span>
                    </h1>
                    <p className="text-lg text-(--foreground-muted) leading-relaxed">
                        GetDeck 是一个完全在浏览器端运行的卡组识别工具，基于现代 Web 技术构建，
                        无需服务器即可实现高精度的卡片识别。
                    </p>
                </div>

                {/* 技术架构 */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-(--foreground)">技术架构</h2>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                        {[
                            {
                                title: '前端框架',
                                tech: 'Next.js & React',
                                desc: '基于 App Router 构建，支持服务端渲染和静态导出'
                            },
                            {
                                title: '样式方案',
                                tech: 'Tailwind CSS 4',
                                desc: '原子化 CSS 框架，实现响应式设计和深色模式'
                            },
                            {
                                title: 'AI 推理',
                                tech: 'ONNX Runtime Web',
                                desc: '在浏览器中运行神经网络模型，支持 WebGL/WebGPU 加速'
                            },
                            {
                                title: '图像处理',
                                tech: 'WebAssembly (Rust)',
                                desc: '使用 Rust 编写的高性能图像处理模块，编译为 WASM'
                            }
                        ].map((item, i) => (
                            <div key={i} className="p-5 rounded-xl border border-(--card-border) bg-(--card-bg) hover:border-(--primary)/30 hover:shadow-lg transition-all duration-300">
                                <div className="inline-flex px-2.5 py-1 rounded-md bg-(--primary) text-white text-xs font-medium mb-3">
                                    {item.title}
                                </div>
                                <h3 className="font-semibold text-(--foreground) mb-1">{item.tech}</h3>
                                <p className="text-sm text-(--foreground-muted)">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 核心流程 */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-(--foreground)">识别流程</h2>
                    </div>

                    <div className="relative">
                        {/* 连接线 */}
                        <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-(--primary)/30 hidden sm:block"></div>
                        
                        <div className="space-y-6">
                            {[
                                {
                                    step: '01',
                                    title: '图像预处理',
                                    desc: '将上传的截图进行标准化处理，为模型推理做准备。',
                                    detail: '图像调整至 1280 像素，边缘填充灰色并归一化'
                                },
                                {
                                    step: '02',
                                    title: 'YOLO 目标检测',
                                    desc: '使用自训练的 YOLOv8 模型检测图像中所有卡片的位置边界框（Bounding Box）。',
                                    detail: '模型在真实 Master Duel 截图上训练，mAP@0.5 达到 99%+'
                                },
                                {
                                    step: '03',
                                    title: '卡图特征提取',
                                    desc: '根据检测到的边界框裁剪出每张卡片的卡图区域，使用感知哈希（pHash）算法提取图像特征。',
                                    detail: '支持标准卡和灵摆卡的不同裁剪比例'
                                },
                                {
                                    step: '04',
                                    title: '数据库匹配',
                                    desc: '将提取的特征与本地卡片数据库进行汉明距离匹配，找出最相似的卡片候选。',
                                    detail: '数据库包含 13000+ 张 Master Duel 卡片的预计算哈希值'
                                },
                                {
                                    step: '05',
                                    title: '结果输出',
                                    desc: '返回每张卡片的识别结果和置信度，支持手动调整和卡组码生成。',
                                    detail: '卡组码格式兼容 Master Duel 官方导入功能，可以直接在游戏里导入'
                                }
                            ].map((item, i) => (
                                <div key={i} className="relative flex gap-4 sm:gap-6">
                                    <div className="shrink-0 w-12 h-12 rounded-xl bg-(--primary) text-white flex items-center justify-center font-bold text-sm z-10">
                                        {item.step}
                                    </div>
                                    <div className="flex-1 pb-6">
                                        <h3 className="font-semibold text-(--foreground) mb-1">{item.title}</h3>
                                        <p className="text-sm text-(--foreground-muted) mb-2">{item.desc}</p>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-(--background-secondary) text-xs text-(--foreground-subtle)">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {item.detail}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 性能指标 */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-(--foreground)">性能指标</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { value: '< 500ms', label: '识别耗时', sub: '40张卡片' },
                            { value: '99%+', label: '识别准确率', sub: '标准场景' },
                            { value: '~15MB', label: '模型大小', sub: '首次加载' },
                            { value: '13000+', label: '卡片数据库', sub: 'CI/CD持续更新' }
                        ].map((stat, i) => (
                            <div key={i} className="p-4 rounded-xl bg-(--background-secondary) border border-(--card-border) text-center">
                                <div className="text-2xl sm:text-3xl font-bold text-(--primary) mb-1">{stat.value}</div>
                                <div className="text-sm font-medium text-(--foreground)">{stat.label}</div>
                                <div className="text-xs text-(--foreground-subtle)">{stat.sub}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 技术栈详情 */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-(--foreground)">技术栈</h2>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-(--card-border)">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-(--background-secondary)">
                                    <th className="px-4 py-3 text-left font-semibold text-(--foreground)">类别</th>
                                    <th className="px-4 py-3 text-left font-semibold text-(--foreground)">技术</th>
                                    <th className="px-4 py-3 text-left font-semibold text-(--foreground) hidden sm:table-cell">说明</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-(--card-border)">
                                {[
                                    { cat: '框架', tech: 'Next.js', desc: 'React 全栈框架，Turbopack 构建' },
                                    { cat: 'UI', tech: 'Tailwind CSS 4', desc: '原子化 CSS，JIT 编译' },
                                    { cat: 'AI', tech: 'ONNX Runtime Web', desc: 'WebGL/WebGPU 加速推理' },
                                    { cat: '模型', tech: 'YOLOv8n', desc: '轻量级目标检测模型' },
                                    { cat: 'WASM', tech: 'Rust + wasm-pack', desc: '高性能图像处理' },
                                    { cat: '哈希', tech: 'pHash (感知哈希)', desc: '图像相似度匹配' },
                                    { cat: '语言', tech: 'TypeScript', desc: '类型安全的 JavaScript' }
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-(--background-secondary)/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="inline-flex px-2 py-0.5 rounded bg-(--primary-light) text-(--primary) text-xs font-medium">
                                                {row.cat}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-(--foreground)">{row.tech}</td>
                                        <td className="px-4 py-3 text-(--foreground-muted) hidden sm:table-cell">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 隐私说明 */}
                <section className="mb-12">
                    <div className="p-6 rounded-xl bg-(--primary-light) border border-(--primary)/20">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-(--primary) mb-2">隐私保护声明</h3>
                                <p className="text-sm text-(--foreground-muted) leading-relaxed">
                                    GetDeck 的所有处理均在您的浏览器本地完成。您上传的图片不会发送到任何服务器，
                                    也不会被收集或存储。模型和数据库文件仅在首次访问时下载并缓存在本地。
                                    本项目开源在Github(游戏资源解包及其CI/CD部分，以及卡组码生成部分暂不开源)。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 致谢 */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-(--primary) flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-(--foreground)">致谢</h2>
                    </div>

                    <div className="p-5 rounded-xl border border-(--card-border) bg-(--card-bg)">
                        <p className="text-sm text-(--foreground-muted) leading-relaxed mb-4">
                            GetDeck 的开发离不开以下开源项目和服务的支持：
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="shrink-0 w-6 h-6 rounded-full bg-(--primary-light) flex items-center justify-center text-(--primary) text-xs font-bold">1</span>
                                <div>
                                    <a href="https://ygocdb.com" target="_blank" rel="noopener noreferrer" className="font-medium text-(--foreground) hover:text-(--primary) transition-colors">
                                        百鸽 (ygocdb.com)
                                    </a>
                                    <p className="text-sm text-(--foreground-muted)">提供卡片详细信息查询 API</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="shrink-0 w-6 h-6 rounded-full bg-(--primary-light) flex items-center justify-center text-(--primary) text-xs font-bold">2</span>
                                <div>
                                    <a href="https://onnxruntime.ai" target="_blank" rel="noopener noreferrer" className="font-medium text-(--foreground) hover:text-(--primary) transition-colors">
                                        ONNX Runtime
                                    </a>
                                    <p className="text-sm text-(--foreground-muted)">提供高性能的浏览器端 AI 推理能力</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="shrink-0 w-6 h-6 rounded-full bg-(--primary-light) flex items-center justify-center text-(--primary) text-xs font-bold">3</span>
                                <div>
                                    <a href="https://github.com/ultralytics/ultralytics" target="_blank" rel="noopener noreferrer" className="font-medium text-(--foreground) hover:text-(--primary) transition-colors">
                                        Ultralytics YOLO
                                    </a>
                                    <p className="text-sm text-(--foreground-muted)">提供目标检测模型架构</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* 底部 CTA */}
                <section className="text-center py-8 border-t border-(--card-border)">
                    <h3 className="text-lg font-semibold text-(--foreground) mb-3">准备好试试了吗？</h3>
                    <Link 
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-(--primary) text-white rounded-lg font-medium hover:bg-(--primary-hover) transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        开始识别
                    </Link>
                </section>
            </main>

            {/* 页脚 */}
            <footer className="py-8 px-4 sm:px-6 border-t border-(--card-border) bg-(--background-secondary)">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-(--foreground-muted)">
                    <p>© 2026 GetDeck. 开源项目，使用 MIT 协议。</p>
                    <div className="flex gap-6">
                        <Link href="/" className="hover:text-(--primary) transition-colors">首页</Link>
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-(--primary) transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
