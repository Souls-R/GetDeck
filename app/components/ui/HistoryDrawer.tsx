"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DeckHistory, getAllHistory, deleteHistory, clearAllHistory, blobToImage } from '../../utils/historyDb';

interface HistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadHistory: (image: HTMLImageElement, history: DeckHistory) => void;
    onHistoryCountChange?: (count: number) => void;
}

export default function HistoryDrawer({ isOpen, onClose, onLoadHistory, onHistoryCountChange }: HistoryDrawerProps) {
    const [histories, setHistories] = useState<DeckHistory[]>([]);
    const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [clearConfirm, setClearConfirm] = useState(false);

    // 用 ref 保存 URL 以便正确清理
    const urlsRef = useRef<Map<string, string>>(new Map());

    // 加载历史记录
    const loadHistories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAllHistory();
            setHistories(data);

            // 先清理旧的 URL
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));

            // 生成缩略图 URL
            const urls = new Map<string, string>();
            data.forEach((h) => {
                urls.set(h.id, URL.createObjectURL(h.thumbnail));
            });
            urlsRef.current = urls;
            setThumbnailUrls(urls);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadHistories();
        }
    }, [isOpen, loadHistories]);

    // 组件卸载时清理 URL
    useEffect(() => {
        return () => {
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    // 点击加载历史
    const handleLoad = async (history: DeckHistory) => {
        try {
            const image = await blobToImage(history.originalImage);
            onLoadHistory(image, history);
            onClose();
        } catch (error) {
            console.error('Failed to load history image:', error);
        }
    };

    // 删除单条
    const handleDelete = async (id: string) => {
        try {
            await deleteHistory(id);
            const url = urlsRef.current.get(id);
            if (url) URL.revokeObjectURL(url);
            urlsRef.current.delete(id);
            setHistories((prev) => {
                const next = prev.filter((h) => h.id !== id);
                onHistoryCountChange?.(next.length);
                return next;
            });
            setThumbnailUrls((prev) => {
                const next = new Map(prev);
                next.delete(id);
                return next;
            });
        } catch (error) {
            console.error('Failed to delete history:', error);
        }
        setDeleteConfirm(null);
    };

    // 清空所有
    const handleClearAll = async () => {
        try {
            await clearAllHistory();
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            urlsRef.current = new Map();
            setHistories([]);
            setThumbnailUrls(new Map());
            onHistoryCountChange?.(0);
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
        setClearConfirm(false);
    };

    // 格式化时间
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        if (isToday) return `今天 ${time}`;
        if (isYesterday) return `昨天 ${time}`;
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* 抽屉内容 */}
            <div className="relative w-full sm:w-[720px] lg:w-[900px] sm:max-w-[90vw] max-h-[85vh] sm:max-h-[85vh] bg-(--card-bg) sm:rounded-2xl rounded-t-2xl shadow-2xl border border-(--card-border) flex flex-col animate-slide-up sm:animate-scale-in">
                {/* 头部 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-(--card-border) shrink-0">
                    <h2 className="text-base font-bold text-(--foreground)">历史记录</h2>
                    <div className="flex items-center gap-2">
                        {histories.length > 0 && (
                            <button
                                onClick={() => setClearConfirm(true)}
                                className="text-xs text-(--foreground-muted) hover:text-red-500 transition-colors px-2 py-1"
                            >
                                清空
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-(--background-secondary) transition-colors"
                        >
                            <svg className="w-5 h-5 text-(--foreground-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 列表 */}
                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 rounded-full border-2 border-(--card-border) border-t-(--primary) animate-spin" />
                        </div>
                    ) : histories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-(--foreground-muted)">
                            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm">暂无历史记录</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {histories.map((history) => (
                                <div
                                    key={history.id}
                                    className="group relative bg-(--background-secondary) rounded-xl overflow-hidden border border-(--card-border) hover:border-(--primary)/50 transition-all cursor-pointer"
                                    onClick={() => handleLoad(history)}
                                >
                                    {/* 缩略图 */}
                                    <div className="aspect-[4/3] bg-(--background) overflow-hidden">
                                        {thumbnailUrls.get(history.id) && (
                                            <img
                                                src={thumbnailUrls.get(history.id)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>

                                    {/* 信息 */}
                                    <div className="p-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-(--foreground)">
                                                {history.cardCount} 张卡片
                                            </span>
                                            {history.deckCode && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--primary)/20 text-(--primary)">
                                                    已生成码
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-(--foreground-muted)">
                                            {formatTime(history.createdAt)}
                                        </p>
                                    </div>

                                    {/* 删除按钮 */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirm(history.id);
                                        }}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 删除确认弹窗 */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteConfirm(null)} />
                    <div className="relative bg-(--card-bg) rounded-xl p-4 mx-4 max-w-xs w-full shadow-2xl border border-(--card-border)">
                        <p className="text-sm text-(--foreground) mb-4">确定删除这条记录吗？</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2 rounded-lg bg-(--background-secondary) text-sm text-(--foreground) hover:bg-(--card-border) transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-2 rounded-lg bg-red-500 text-sm text-white hover:bg-red-600 transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 清空确认弹窗 */}
            {clearConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setClearConfirm(false)} />
                    <div className="relative bg-(--card-bg) rounded-xl p-4 mx-4 max-w-xs w-full shadow-2xl border border-(--card-border)">
                        <p className="text-sm text-(--foreground) mb-4">确定清空所有历史记录吗？此操作不可恢复。</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setClearConfirm(false)}
                                className="flex-1 py-2 rounded-lg bg-(--background-secondary) text-sm text-(--foreground) hover:bg-(--card-border) transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="flex-1 py-2 rounded-lg bg-red-500 text-sm text-white hover:bg-red-600 transition-colors"
                            >
                                清空
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
