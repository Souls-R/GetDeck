import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface CropperModalProps {
    imageSrc: string;
    onApply: (croppedAreaPixels: { x: number; y: number; width: number; height: number }) => void;
    onCancel: () => void;
}

export default function CropperModal({ imageSrc, onApply, onCancel }: CropperModalProps) {
    const [crop, setCrop] = useState<Crop>();
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
    const [scale, setScale] = useState(1);
    const [minScale, setMinScale] = useState(0.1);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 双指缩放状态
    const lastPinchDistance = useRef<number | null>(null);

    // 禁用页面滚动
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // 计算适应窗口的缩放比例（显示全图）
    const calculateFitScale = useCallback((
        imgNaturalWidth: number,
        imgNaturalHeight: number,
        containerWidth: number,
        containerHeight: number
    ) => {
        const scaleX = containerWidth / imgNaturalWidth;
        const scaleY = containerHeight / imgNaturalHeight;
        return Math.min(scaleX, scaleY) * 0.95;
    }, []);

    // 计算显示尺寸
    const calculateDisplaySize = useCallback((
        imgNaturalWidth: number,
        imgNaturalHeight: number,
        currentScale: number
    ) => {
        return {
            width: imgNaturalWidth * currentScale,
            height: imgNaturalHeight * currentScale
        };
    }, []);

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const imgNaturalWidth = img.naturalWidth;
        const imgNaturalHeight = img.naturalHeight;
        setNaturalSize({ width: imgNaturalWidth, height: imgNaturalHeight });

        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // 计算适应窗口的缩放（显示全图）
        const fitScale = calculateFitScale(imgNaturalWidth, imgNaturalHeight, containerWidth, containerHeight);
        setMinScale(fitScale * 0.5);
        setScale(fitScale);
        // 计算显示尺寸
        const display = calculateDisplaySize(imgNaturalWidth, imgNaturalHeight, fitScale);
        setDisplaySize(display);

        // 设置默认裁剪区域：12:14宽高比，居中
        const targetAspect = 12 / 14;
        const imgAspect = imgNaturalWidth / imgNaturalHeight;

        let cropWidth: number, cropHeight: number, cropX: number, cropY: number;

        if (imgAspect > targetAspect) {
            cropHeight = 100;
            cropWidth = (targetAspect / imgAspect) * 100;
            cropX = (100 - cropWidth) / 2;
            cropY = 0;
        } else {
            cropWidth = 100;
            cropHeight = (imgAspect / targetAspect) * 100;
            cropX = 0;
            cropY = (100 - cropHeight) / 2;
        }

        setCrop({
            unit: '%',
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight
        });
    }, [calculateFitScale, calculateDisplaySize]);

    // 更新显示尺寸当scale变化
    useEffect(() => {
        if (naturalSize.width) {
            const display = calculateDisplaySize(naturalSize.width, naturalSize.height, scale);
            setDisplaySize(display);
        }
    }, [scale, naturalSize, calculateDisplaySize]);

    // 鼠标滚轮缩放
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.min(3, Math.max(minScale, prev + delta)));
    }, [minScale]);

    // 双指缩放处理
    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2 && lastPinchDistance.current !== null) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const delta = (distance - lastPinchDistance.current) * 0.005;
            setScale(prev => Math.min(3, Math.max(minScale, prev + delta)));

            lastPinchDistance.current = distance;
        }
    }, [minScale]);

    const handleTouchEnd = useCallback(() => {
        lastPinchDistance.current = null;
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

    const handleApply = () => {
        if (!crop || !imgRef.current) return;

        let pixelCrop: { x: number; y: number; width: number; height: number };

        if (crop.unit === '%') {
            pixelCrop = {
                x: (crop.x / 100) * naturalSize.width,
                y: (crop.y / 100) * naturalSize.height,
                width: (crop.width / 100) * naturalSize.width,
                height: (crop.height / 100) * naturalSize.height
            };
        } else {
            const scaleX = naturalSize.width / displaySize.width;
            const scaleY = naturalSize.height / displaySize.height;
            pixelCrop = {
                x: crop.x * scaleX,
                y: crop.y * scaleY,
                width: crop.width * scaleX,
                height: crop.height * scaleY
            };
        }

        pixelCrop.x = Math.max(0, Math.min(pixelCrop.x, naturalSize.width));
        pixelCrop.y = Math.max(0, Math.min(pixelCrop.y, naturalSize.height));
        pixelCrop.width = Math.min(pixelCrop.width, naturalSize.width - pixelCrop.x);
        pixelCrop.height = Math.min(pixelCrop.height, naturalSize.height - pixelCrop.y);

        onApply(pixelCrop);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
        else if (e.key === 'Enter') handleApply();
    };

    const getCropPixels = () => {
        if (!crop || !naturalSize.width) return null;
        if (crop.unit === '%') {
            return {
                width: Math.round((crop.width / 100) * naturalSize.width),
                height: Math.round((crop.height / 100) * naturalSize.height)
            };
        }
        const scaleX = naturalSize.width / displaySize.width;
        const scaleY = naturalSize.height / displaySize.height;
        return {
            width: Math.round(crop.width * scaleX),
            height: Math.round(crop.height * scaleY)
        };
    };

    const cropPixels = getCropPixels();

    return (
        <div
            className="fixed inset-0 z-30 flex flex-col animate-scale-in bg-black/90"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {/* 顶部栏 */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/50">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 text-white/70 hover:text-white active:text-white transition-colors py-2 px-3 -ml-3"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm">取消</span>
                </button>
                <div className="text-xs text-white/50">
                    {cropPixels && <span>{cropPixels.width} × {cropPixels.height}</span>}
                    <span className="mx-2">·</span>
                    <span>{Math.round(scale * 100)}%</span>
                </div>
            </div>

            {/* 裁剪区域 */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center overflow-auto touch-none"
            >
                <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        onLoad={onImageLoad}
                        style={{
                            width: displaySize.width || 'auto',
                            height: displaySize.height || 'auto',
                            maxWidth: 'none',
                            maxHeight: 'none'
                        }}
                        alt="Crop"
                        draggable={false}
                    />
                </ReactCrop>
            </div>

            {/* 底部确认按钮 */}
            <div className="p-4 pb-6 bg-gradient-to-t from-black/80 to-transparent">
                <button
                    onClick={handleApply}
                    disabled={!crop}
                    className="w-full py-4 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.98] text-white text-base font-semibold transition-all disabled:opacity-50 shadow-lg"
                >
                    确认裁剪
                </button>
            </div>
        </div>
    );
}
