import React from 'react';
import { useTranslation } from '@/app/i18n';

interface MagnifierProps {
    show: boolean;
    x: number;
    y: number;
    content: string | null;
}

export default function Magnifier({ show, x, y, content }: MagnifierProps) {
    const { t } = useTranslation();

    if (!show || !content) return null;

    return (
        <div
            className="fixed z-50 pointer-events-none animate-scale-in"
            style={{
                left: x + 30,
                top: y - 90
            }}
        >
            <div className="relative">
                {/* 主预览框 */}
                <div className="w-[200px] h-[200px] rounded-2xl overflow-hidden border-2 border-[var(--primary)] shadow-2xl bg-[var(--card-bg)]">
                    <img
                        src={content}
                        className="w-full h-full object-contain bg-[var(--background-secondary)]"
                        alt="Crop Preview"
                    />
                    {/* 十字准线 */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-0 w-full h-px bg-[var(--primary)]/50" />
                        <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--primary)]/50" />
                    </div>
                </div>

                {/* 活动指示器 */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--primary)] rounded-full animate-pulse shadow-lg">
                    <div className="absolute inset-0 bg-[var(--primary)] rounded-full animate-ping opacity-75" />
                </div>

                {/* 提示文字 */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-[var(--foreground-muted)] bg-[var(--card-bg)] px-2 py-1 rounded shadow">
                    {t('magnifier.dragHint')}
                </div>
            </div>
        </div>
    );
}
