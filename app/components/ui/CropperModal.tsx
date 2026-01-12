import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
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
    const [minScale, setMinScale] = useState(1);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 禁用页面滚动
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // 计算显示尺寸和默认裁剪区域
    const calculateLayout = useCallback((
        imgNaturalWidth: number,
        imgNaturalHeight: number,
        containerWidth: number,
        containerHeight: number,
        currentScale: number
    ) => {
        // 基础显示尺寸：让图片高度适配容器
        const baseHeight = containerHeight;
        const baseWidth = (imgNaturalWidth / imgNaturalHeight) * baseHeight;

        // 应用缩放
        const displayWidth = baseWidth * currentScale;
        const displayHeight = baseHeight * currentScale;

        return { width: displayWidth, height: displayHeight };
    }, []);

    // 计算最小缩放（确保至少一个方向填满容器）
    const calculateMinScale = useCallback((
        imgNaturalWidth: number,
        imgNaturalHeight: number,
        containerWidth: number,
        containerHeight: number
    ) => {
        // 基础显示尺寸（scale=1时）
        const baseHeight = containerHeight;
        const baseWidth = (imgNaturalWidth / imgNaturalHeight) * baseHeight;

        // 最小缩放要保证至少一个方向填满容器
        // 如果baseWidth < containerWidth，则宽度方向需要缩放才能填满
        // minScale = max(containerWidth/baseWidth, containerHeight/baseHeight) 但这会让图变大
        // 实际上我们要限制缩小的程度，即至少保持一个方向填满
        // 当scale=1时，高度已经填满，所以只需要考虑宽度
        // 如果缩小到宽度正好填满容器，则 displayWidth = containerWidth
        // baseWidth * minScale = containerWidth => minScale = containerWidth / baseWidth

        if (baseWidth >= containerWidth) {
            // 宽度本来就大于等于容器，缩小到宽度=容器宽度
            return containerWidth / baseWidth;
        } else {
            // 宽度本来就小于容器，不能再缩小了，minScale = 1
            // 但这样scale=1时高度填满，宽度有黑边
            // 用户说只能一个方向有黑边，所以这种情况OK
            return 1;
        }
    }, []);

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const imgNaturalWidth = img.naturalWidth;
        const imgNaturalHeight = img.naturalHeight;
        setNaturalSize({ width: imgNaturalWidth, height: imgNaturalHeight });

        // 获取容器尺寸
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        setContainerSize({ width: containerWidth, height: containerHeight });

        // 计算最小缩放
        const minS = calculateMinScale(imgNaturalWidth, imgNaturalHeight, containerWidth, containerHeight);
        setMinScale(minS);
        setScale(1); // 初始scale=1

        // 计算显示尺寸
        const display = calculateLayout(imgNaturalWidth, imgNaturalHeight, containerWidth, containerHeight, 1);
        setDisplaySize(display);

        // 设置默认裁剪区域：12:14宽高比，顶部居中
        const targetAspect = 12 / 14;
        const imgAspect = imgNaturalWidth / imgNaturalHeight;

        let cropWidth: number, cropHeight: number, cropX: number, cropY: number;

        if (imgAspect > targetAspect) {
            // 图片更宽，以高度为基准
            cropHeight = 100; // 100%高度
            cropWidth = (targetAspect / imgAspect) * 100;
            cropX = (100 - cropWidth) / 2; // 水平居中
            cropY = 0; // 顶部对齐
        } else {
            // 图片更高或正好，以宽度为基准
            cropWidth = 100; // 100%宽度
            cropHeight = (imgAspect / targetAspect) * 100;
            cropX = 0;
            cropY = 0; // 顶部对齐
        }

        setCrop({
            unit: '%',
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight
        });
    }, [calculateLayout, calculateMinScale]);

    // 更新显示尺寸当scale变化
    useEffect(() => {
        if (naturalSize.width && containerSize.width) {
            const display = calculateLayout(
                naturalSize.width,
                naturalSize.height,
                containerSize.width,
                containerSize.height,
                scale
            );
            setDisplaySize(display);
        }
    }, [scale, naturalSize, containerSize, calculateLayout]);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.min(3, Math.max(minScale, prev + delta)));
    }, [minScale]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);

    const handleApply = () => {
        if (!crop || !imgRef.current) return;

        const img = imgRef.current;

        // 计算实际像素坐标
        // crop坐标是相对于显示尺寸的百分比或像素
        let pixelCrop: { x: number; y: number; width: number; height: number };

        if (crop.unit === '%') {
            // 百分比直接转换为自然像素
            pixelCrop = {
                x: (crop.x / 100) * naturalSize.width,
                y: (crop.y / 100) * naturalSize.height,
                width: (crop.width / 100) * naturalSize.width,
                height: (crop.height / 100) * naturalSize.height
            };
        } else {
            // 像素坐标：相对于当前显示尺寸，转换到自然尺寸
            const scaleX = naturalSize.width / displaySize.width;
            const scaleY = naturalSize.height / displaySize.height;
            pixelCrop = {
                x: crop.x * scaleX,
                y: crop.y * scaleY,
                width: crop.width * scaleX,
                height: crop.height * scaleY
            };
        }

        // 确保坐标在有效范围内
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
            className="absolute inset-0 z-30 flex items-center justify-center animate-scale-in"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            <div className="absolute inset-0 bg-black/70" onClick={onCancel} />

            <div className="relative w-[90%] max-w-4xl h-[85%] max-h-[750px] panel panel-elevated flex flex-col overflow-hidden">
                {/* 顶部信息栏 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
                    <h3 className="text-sm font-medium text-[var(--foreground)]">裁剪图片</h3>
                    <div className="text-xs text-[var(--foreground-muted)]">
                        {cropPixels && <span>{cropPixels.width} × {cropPixels.height}</span>}
                        <span className="mx-2">·</span>
                        <span>缩放 {Math.round(scale * 100)}%</span>
                    </div>
                </div>

                {/* 裁剪区域 */}
                <div
                    ref={containerRef}
                    className="flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden"
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

                {/* 底部操作栏 */}
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--card-border)] text-[var(--foreground)] text-sm font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!crop}
                        className="px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        应用裁剪
                    </button>
                </div>
            </div>
        </div>
    );
}
