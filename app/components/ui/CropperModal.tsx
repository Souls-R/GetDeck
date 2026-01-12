import React, { useState } from 'react';
import Cropper from 'react-easy-crop';

interface CropperModalProps {
    imageSrc: string;
    onApply: (croppedAreaPixels: any) => void;
    onCancel: () => void;
}

export default function CropperModal({ imageSrc, onApply, onCancel }: CropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    return (
        <div className="absolute inset-0 z-30 bg-[var(--background)] flex flex-col animate-scale-in">
            {/* 裁剪区域 */}
            <div className="flex-1 relative">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropAreaChange={(croppedArea, pixels) => setCroppedAreaPixels(pixels)}
                    style={{
                        containerStyle: {
                            background: 'var(--background-secondary)'
                        }
                    }}
                />
            </div>

            {/* 底部操作栏 */}
            <div className="p-6 bg-[var(--card-bg)] border-t border-[var(--card-border)] flex justify-between items-center">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl bg-[var(--background-secondary)] hover:bg-[var(--card-border)] text-[var(--foreground)] font-medium transition-all duration-200 btn-interactive"
                >
                    取消
                </button>

                <div className="flex items-center gap-4">
                    {/* 缩放滑块 */}
                    <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                        </svg>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-32 accent-[var(--primary)]"
                        />
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                    </div>

                    <p className="text-sm text-[var(--foreground-muted)]">
                        调整裁剪区域
                    </p>
                </div>

                <button
                    onClick={() => croppedAreaPixels && onApply(croppedAreaPixels)}
                    disabled={!croppedAreaPixels}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 btn-interactive disabled:opacity-50 disabled:pointer-events-none"
                >
                    应用裁剪
                </button>
            </div>
        </div>
    );
}
