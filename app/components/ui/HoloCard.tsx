
import React, { useRef, useState, useCallback } from 'react';

interface HoloCardProps {
    src: string;
    alt: string;
    className?: string;
}

export default function HoloCard({ src, alt, className = '' }: HoloCardProps) {
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

    return (
        <div
            className={`holo-card-container ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={cardRef}
                className={`holo-card ${isInteracting ? 'interacting' : ''}`}
            >
                <div className="holo-card-content">
                    <div className="holo-card__holo"></div>
                    <div className="holo-card__glare"></div>
                    <img src={src} alt={alt} draggable={false} className="pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
