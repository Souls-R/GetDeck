"use client";

import React, { useRef, useState, useEffect } from 'react';
import { RecognizedCard, CardInfo } from '../../types';
import { globalCardInfoCache, isExtraDeck, fetchCardInfoBatch, fetchCardInfoByPasswords } from '../../utils/cardApi';
import { useMobile } from '../../hooks/useMobile';
import { useTranslation } from '@/app/i18n';
import QRCode from 'qrcode';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    deckCode: string;
    recognizedCards: RecognizedCard[];
}

import { siteUrl, getCardImageUrl } from '../../config';

// 分享链接域名配置
const SHARE_DOMAIN = siteUrl;

export default function ShareModal({ isOpen, onClose, deckCode, recognizedCards }: ShareModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isMobile = useMobile();
    const { t, locale } = useTranslation();
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // 获取卡片信息（从缓存或API）— batch fetch missing
    const fetchAllCardInfo = async (cards: RecognizedCard[]) => {
        const entries: { id: number; name: string }[] = [];
        const passwordEntries: { password: string; name: string }[] = [];
        for (const card of cards) {
            const match = card.matches[card.selectedMatchIndex];
            if (match && !globalCardInfoCache[match.name]) {
                match.id ? entries.push({ id: match.id, name: match.name })
                    : passwordEntries.push({ password: match.password!.toString(), name: match.name });
            }
        }
        const [, passwordInfoMap] = await Promise.all([
            entries.length > 0 ? fetchCardInfoBatch(entries) : Promise.resolve(),
            passwordEntries.length > 0 ? fetchCardInfoByPasswords(passwordEntries.map((e) => e.password)) : Promise.resolve(new Map()),
        ]);
        passwordEntries.forEach(({ password, name }) => {
            const info = passwordInfoMap.get(password);
            if (info) {
                globalCardInfoCache[name] = {
                    ...info.cardInfo,
                    name: { ...info.cardInfo.name, zh: name },
                };
            }
        });
    };

    // 加载图片的辅助函数
    const loadImage = (baigeId: number): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = getCardImageUrl(baigeId, locale);
        });
    };

    // 加载任意图片 URL
    const loadImageUrl = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    // 生成分享图片
    useEffect(() => {
        if (!isOpen) return;

        const generateImage = async () => {
            setIsGenerating(true);
            setProgress(0);
            setStatusText(t('share.loadingCardInfo'));

            // Batch fetch all missing card info
            await fetchAllCardInfo(recognizedCards);

            // 分类卡片：主卡组和额外卡组
            const mainDeckCards: { name: string; baigeId?: number }[] = [];
            const extraDeckCards: { name: string; baigeId?: number }[] = [];

            recognizedCards.forEach((card) => {
                const match = card.matches[card.selectedMatchIndex];
                if (!match) return;

                const cardInfo = globalCardInfoCache[match.name];
                const baigeId = cardInfo?.password;

                const cardData = { name: match.name, baigeId };

                if (isExtraDeck(cardInfo)) {
                    extraDeckCards.push(cardData);
                } else {
                    mainDeckCards.push(cardData);
                }
            });

            // 收集所有需要加载的图片 ID
            const allCards = [...mainDeckCards, ...extraDeckCards];
            const baigeIds = allCards.map(c => c.baigeId).filter((id): id is number => !!id);
            const uniqueBaigeIds = [...new Set(baigeIds)];
            const loadedImages: Record<number, HTMLImageElement> = {};

            // 并行预加载所有卡片图片（20 并发）
            if (uniqueBaigeIds.length > 0) {
                setStatusText(t('share.loadingCardImages'));
                const IMAGE_CONCURRENCY = 20;
                let imageLoadedCount = 0;
                const imageQueue = [...uniqueBaigeIds];

                const imageWorkers = Array(Math.min(IMAGE_CONCURRENCY, imageQueue.length)).fill(null).map(async () => {
                    while (imageQueue.length > 0) {
                        const baigeId = imageQueue.shift();
                        if (baigeId) {
                            try {
                                loadedImages[baigeId] = await loadImage(baigeId);
                            } catch {
                                // 忽略加载失败
                            }
                            imageLoadedCount++;
                            setProgress(Math.round((imageLoadedCount / uniqueBaigeIds.length) * 50));
                            setStatusText(t('share.loadingCardImagesProgress', { loaded: imageLoadedCount, total: uniqueBaigeIds.length }));
                        }
                    }
                });
                await Promise.all(imageWorkers);
            }

            setStatusText(t('share.generatingImage'));

            console.log('ShareModal generating:', { main: mainDeckCards.length, extra: extraDeckCards.length });

            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 设置画布尺寸（约1.5倍大小，提高清晰度）
            const padding = 48;
            const cardWidth = 107;
            const cardHeight = 155;
            const mainCardsPerRow = 10;
            const extraCardsPerRow = 10;
            const gap = 6;
            const headerHeight = 90;
            const sectionHeaderHeight = 42;
            const sectionGap = 24;
            const footerHeight = 120;
            const qrSize = 90;

            const mainRows = Math.ceil(mainDeckCards.length / mainCardsPerRow);
            const extraRows = Math.ceil(extraDeckCards.length / extraCardsPerRow);

            const contentWidth = Math.max(
                mainCardsPerRow * cardWidth + (mainCardsPerRow - 1) * gap,
                extraCardsPerRow * cardWidth + (extraCardsPerRow - 1) * gap
            );

            const mainContentHeight = mainRows * cardHeight + (mainRows - 1) * gap;
            const extraContentHeight = extraDeckCards.length > 0
                ? sectionGap + sectionHeaderHeight + extraRows * cardHeight + (extraRows - 1) * gap
                : 0;

            canvas.width = contentWidth + padding * 2;
            canvas.height = headerHeight + sectionHeaderHeight + mainContentHeight + extraContentHeight + footerHeight + padding * 2;

            // 背景色 - 白色
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 标题区域
            let currentY = padding;

            // 卡组码标题
            ctx.fillStyle = '#171717';
            ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(t('share.deckCodeTitle', { code: deckCode }), padding, currentY + 36);

            // 卡片数量
            ctx.fillStyle = '#737373';
            ctx.font = '21px system-ui, -apple-system, sans-serif';
            ctx.fillText(t('share.deckSummary', { main: mainDeckCards.length, extra: extraDeckCards.length }), padding, currentY + 72);

            currentY += headerHeight;

            // 主卡组标题
            ctx.fillStyle = '#a855f7'; // 紫色
            ctx.fillRect(padding, currentY, 6, 24);
            ctx.fillStyle = '#171717';
            ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
            ctx.fillText(t('share.mainDeck'), padding + 18, currentY + 20);

            currentY += sectionHeaderHeight;

            const totalCards = mainDeckCards.length + extraDeckCards.length;
            let loadedCards = 0;

            // 绘制主卡组卡片（图片已预加载到缓存）
            for (let i = 0; i < mainDeckCards.length; i++) {
                const card = mainDeckCards[i];
                const row = Math.floor(i / mainCardsPerRow);
                const col = i % mainCardsPerRow;
                const x = padding + col * (cardWidth + gap);
                const y = currentY + row * (cardHeight + gap);

                // 绘制卡片背景
                ctx.fillStyle = '#f5f5f5';
                ctx.fillRect(x, y, cardWidth, cardHeight);

                if (card.baigeId && loadedImages[card.baigeId]) {
                    ctx.drawImage(loadedImages[card.baigeId], x, y, cardWidth, cardHeight);
                }

                loadedCards++;
                setProgress(50 + Math.round((loadedCards / totalCards) * 50));
            }

            currentY += mainContentHeight;

            // 额外卡组
            if (extraDeckCards.length > 0) {
                currentY += sectionGap;

                // 额外卡组标题
                ctx.fillStyle = '#3b82f6'; // 蓝色
                ctx.fillRect(padding, currentY, 6, 24);
                ctx.fillStyle = '#171717';
                ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
                ctx.fillText(t('share.extraDeck'), padding + 18, currentY + 20);

                currentY += sectionHeaderHeight;

                // 绘制额外卡组卡片（图片已预加载到缓存）
                for (let i = 0; i < extraDeckCards.length; i++) {
                    const card = extraDeckCards[i];
                    const row = Math.floor(i / extraCardsPerRow);
                    const col = i % extraCardsPerRow;
                    const x = padding + col * (cardWidth + gap);
                    const y = currentY + row * (cardHeight + gap);

                    // 绘制卡片背景
                    ctx.fillStyle = '#f5f5f5';
                    ctx.fillRect(x, y, cardWidth, cardHeight);

                    if (card.baigeId && loadedImages[card.baigeId]) {
                        ctx.drawImage(loadedImages[card.baigeId], x, y, cardWidth, cardHeight);
                    }

                    loadedCards++;
                    setProgress(50 + Math.round((loadedCards / totalCards) * 50));
                }

                currentY += extraRows * cardHeight + (extraRows - 1) * gap;
            }

            // 底部区域：二维码和网站信息
            currentY += 30;

            // 生成二维码
            const shareUrl = `${SHARE_DOMAIN}/deck/?code=${deckCode}`;
            try {
                const qrDataUrl = await QRCode.toDataURL(shareUrl, {
                    width: qrSize,
                    margin: 0,
                    color: {
                        dark: '#171717',
                        light: '#ffffff'
                    }
                });
                const qrImg = await loadImageUrl(qrDataUrl);
                ctx.drawImage(qrImg, padding, currentY, qrSize, qrSize);
            } catch {
                // 二维码生成失败，跳过
            }

            // 网站信息
            ctx.fillStyle = '#737373';
            ctx.font = '20px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(t('share.scanQr'), padding + qrSize + 18, currentY + 30);
            ctx.fillStyle = '#3b82f6';
            ctx.font = '22px system-ui, -apple-system, sans-serif';
            ctx.fillText(`${SHARE_DOMAIN}/deck/?code=${deckCode}`, padding + qrSize + 18, currentY + 60);

            // 生成预览 URL
            setPreviewUrl(canvas.toDataURL('image/png'));
            setIsGenerating(false);
        };

        generateImage();
    }, [isOpen, deckCode, recognizedCards]);

    // 关闭时重置
    useEffect(() => {
        if (!isOpen) {
            setPreviewUrl(null);
            setProgress(0);
        }
    }, [isOpen]);

    // ESC 键关闭
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // 下载图片
    const handleDownload = () => {
        if (!previewUrl) return;
        const link = document.createElement('a');
        link.download = `getdeck-${deckCode}.png`;
        link.href = previewUrl;
        link.click();
    };

    // 复制链接到剪贴板
    const handleCopyLink = async () => {
        const shareUrl = `${SHARE_DOMAIN}/deck/?code=${deckCode}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }
    };

    // 复制图片到剪贴板
    const handleCopy = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to create blob'));
                }, 'image/png');
            });

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // 如果复制失败，尝试下载
            handleDownload();
        }
    };

    // 移动端系统分享
    const handleShare = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to create blob'));
                }, 'image/png');
            });

            const file = new File([blob], `getdeck-${deckCode}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: t('share.shareTitle', { code: deckCode }),
                    text: t('share.shareText', { code: deckCode })
                });
            } else {
                // 不支持文件分享，降级到下载
                handleDownload();
            }
        } catch (err: any) {
            // 用户取消分享不算错误
            if (err.name !== 'AbortError') {
                handleDownload();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--card-border)] p-6 mx-4 max-w-2xl w-full max-h-[90vh] overflow-auto animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">{t('share.title')}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 预览区域 */}
                <div className="bg-[var(--background-secondary)] rounded-xl p-4 mb-4 flex items-center justify-center min-h-[200px]">
                    {isGenerating ? (
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
                            <p className="text-sm text-[var(--foreground-muted)]">{statusText || t('share.generating', { progress })}</p>
                        </div>
                    ) : previewUrl ? (
                        <img
                            src={previewUrl}
                            alt={t('share.sharePreview')}
                            className="max-w-full max-h-[400px] rounded-lg shadow-lg select-none"
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                        />
                    ) : null}
                </div>

                {/* 隐藏的 canvas */}
                <canvas ref={canvasRef} className="hidden" />

                {/* 操作按钮 */}
                <div className="flex gap-3">
                    {isMobile ? (
                        // 移动端：分享按钮
                        <button
                            onClick={handleShare}
                            disabled={isGenerating || !previewUrl}
                            className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            {t('common.share')}
                        </button>
                    ) : (
                        // PC端：复制按钮
                        <button
                            onClick={handleCopy}
                            disabled={isGenerating || !previewUrl}
                            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                copied
                                    ? 'bg-[var(--success)] text-white'
                                    : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                            }`}
                        >
                            {copied ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {t('common.copied')}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    {t('share.copyImage')}
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        disabled={isGenerating || !previewUrl}
                        className="flex-1 py-2.5 rounded-lg bg-[var(--background-secondary)] text-[var(--foreground)] font-medium hover:bg-[var(--card-border)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {isMobile ? t('share.downloadMobile') : t('share.downloadImage')}
                    </button>
                    <button
                        onClick={handleCopyLink}
                        className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            linkCopied
                                ? 'bg-[var(--success)] text-white'
                                : 'bg-[var(--background-secondary)] text-[var(--foreground)] hover:bg-[var(--card-border)]'
                        }`}
                    >
                        {linkCopied ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {t('common.copied')}
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {isMobile ? t('share.linkMobile') : t('share.copyLink')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
