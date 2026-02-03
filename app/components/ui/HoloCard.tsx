
import React, { useRef, useState, useCallback, useId } from 'react';

interface HoloCardProps {
    src: string;
    alt: string;
    className?: string;
}

const SQUIRCLE_PATH = "M 0.5 0 L 0.965 0 L 0.97632 0.00007 L 0.98096 0.00027 L 0.98446 0.00060 L 0.98732 0.00107 L 0.98975 0.00168 L 0.99183 0.00243 L 0.99363 0.00333 L 0.99517 0.00439 L 0.99648 0.00563 L 0.99757 0.00707 L 0.99845 0.00874 L 0.99913 0.01072 L 0.99962 0.01313 L 0.99990 0.01633 L 1.00000 0.02414 L 1 0.9758620689655172 L 0.99990 0.98367 L 0.99962 0.98687 L 0.99913 0.98928 L 0.99845 0.99126 L 0.99757 0.99293 L 0.99648 0.99437 L 0.99517 0.99561 L 0.99363 0.99667 L 0.99183 0.99757 L 0.98975 0.99832 L 0.98732 0.99893 L 0.98446 0.99940 L 0.98096 0.99973 L 0.97632 0.99993 L 0.96500 1.00000 L 0.035 1 L 0.02368 0.99993 L 0.01904 0.99973 L 0.01554 0.99940 L 0.01268 0.99893 L 0.01025 0.99832 L 0.00817 0.99757 L 0.00637 0.99667 L 0.00483 0.99561 L 0.00352 0.99437 L 0.00243 0.99293 L 0.00155 0.99126 L 0.00087 0.98928 L 0.00038 0.98687 L 0.00010 0.98367 L 0.00000 0.97586 L 0 0.024137931034482762 L 0.00010 0.01633 L 0.00038 0.01313 L 0.00087 0.01072 L 0.00155 0.00874 L 0.00243 0.00707 L 0.00352 0.00563 L 0.00483 0.00439 L 0.00637 0.00333 L 0.00817 0.00243 L 0.01025 0.00168 L 0.01268 0.00107 L 0.01554 0.00060 L 0.01904 0.00027 L 0.02368 0.00007 L 0.03500 0.00000 Z";

export default function HoloCard({ src, alt, className = '' }: HoloCardProps) {
    const uniqueId = useId();
    const clipPathId = `holo-card-squircle-${uniqueId.replace(/:/g, '')}`;
    const cardRef = useRef<HTMLDivElement>(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        setIsInteracting(true);

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate ratios (0 to 1)
        const xRatio = x / rect.width;
        const yRatio = y / rect.height;

        // Calculate rotation (e.g. -15deg to 15deg)
        // xRatio 0 -> ry -15deg
        // xRatio 1 -> ry 15deg
        // yRatio 0 -> rx 15deg (tilted up)
        // yRatio 1 -> rx -15deg (tilted down)
        const rx = (0.5 - yRatio) * 30; // -15 to 15
        const ry = (xRatio - 0.5) * 30; // -15 to 15

        // Update CSS variables
        cardRef.current.style.setProperty('--rx', `${rx}deg`);
        cardRef.current.style.setProperty('--ry', `${ry}deg`);
        cardRef.current.style.setProperty('--mx', `${xRatio * 100}%`);
        cardRef.current.style.setProperty('--my', `${yRatio * 100}%`);

        // Shadow movement - simple depth simulation
        // When card tilts, shadow should move to suggest distance
        cardRef.current.style.setProperty('--sx', `${(xRatio - 0.5) * -20}px`);
        cardRef.current.style.setProperty('--sy', `${(yRatio - 0.5) * -20}px`);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsInteracting(false);
        if (cardRef.current) {
            // Reset gradually
            cardRef.current.style.setProperty('--rx', '0deg');
            cardRef.current.style.setProperty('--ry', '0deg');
            cardRef.current.style.setProperty('--mx', '50%');
            cardRef.current.style.setProperty('--my', '50%');
            cardRef.current.style.setProperty('--sx', '0px');
            cardRef.current.style.setProperty('--sy', '0px');
        }
    }, []);

    const clipPathStyle = { clipPath: `url(#${clipPathId})` };

    return (
        <div
            className={`holo-card-container ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <svg width="0" height="0" className="absolute pointer-events-none" style={{ position: 'absolute', opacity: 0 }}>
                <defs>
                    <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
                        <path d={SQUIRCLE_PATH} />
                    </clipPath>
                </defs>
            </svg>
            <div
                ref={cardRef}
                className={`holo-card ${isInteracting ? 'interacting' : ''}`}
                style={clipPathStyle}
            >
                <div className="holo-card-content" style={clipPathStyle}>
                    <div className="holo-card__holo"></div>
                    <div className="holo-card__glare"></div>
                    <img src={src} alt={alt} draggable={false} className="pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
