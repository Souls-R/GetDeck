import { useState, useRef, useCallback } from 'react';
import { Box, RecognizedCard } from '../types';
import { extractArtwork, STANDARD_CARD, PENDULUM_CARD } from '../utils/recognition';

interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    initialBox: Box | null;
}

interface Magnifier {
    show: boolean;
    x: number;
    y: number;
    content: string | null;
}

interface UseCanvasInteractionProps {
    originalImage: HTMLImageElement | null;
    recognizedCards: RecognizedCard[];
    selectedCardIndex: number;
    forcePendulumMode: boolean;
    isZoomed?: boolean;
    isMobile?: boolean;
    onSelectCard: (index: number) => void;
    onUpdateCardBox: (index: number, box: Box) => void;
    onReprocessCard: (index: number) => void;
}

export interface UseCanvasInteractionReturn {
    dragState: DragState;
    magnifier: Magnifier;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    handleMouseUp: () => Promise<void>;
    handleMouseLeave: () => void;
}

export function useCanvasInteraction({
    originalImage,
    recognizedCards,
    selectedCardIndex,
    forcePendulumMode,
    isZoomed = false,
    onSelectCard,
    onUpdateCardBox,
    onReprocessCard
}: UseCanvasInteractionProps): UseCanvasInteractionReturn {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialBox: null
    });

    const [magnifier, setMagnifier] = useState<Magnifier>({
        show: false,
        x: 0,
        y: 0,
        content: null
    });

    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const getMousePos = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0, rawX: 0, rawY: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
            rawX: e.clientX,
            rawY: e.clientY
        };
    }, []);

    const updateCropMagnifier = useCallback((box: Box, screenX: number, screenY: number) => {
        if (!originalImage) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalImage.width;
        tempCanvas.height = originalImage.height;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        const cropConfig = forcePendulumMode ? PENDULUM_CARD : STANDARD_CARD;
        const artworkData = extractArtwork(ctx, box, cropConfig);

        const magCanvas = document.createElement('canvas');
        magCanvas.width = artworkData.width;
        magCanvas.height = artworkData.height;
        magCanvas.getContext('2d')!.putImageData(artworkData, 0, 0);

        setMagnifier({
            show: true,
            x: screenX,
            y: screenY,
            content: magCanvas.toDataURL()
        });
    }, [originalImage, forcePendulumMode]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!originalImage || recognizedCards.length === 0) return;
        const { x, y, rawX, rawY } = getMousePos(e);

        let clickedIndex = -1;
        for (let i = recognizedCards.length - 1; i >= 0; i--) {
            const card = recognizedCards[i];
            if (x >= card.box.x1 && x <= card.box.x2 && y >= card.box.y1 && y <= card.box.y2) {
                clickedIndex = i;
                break;
            }
        }

        if (clickedIndex !== -1) {
            if (selectedCardIndex !== clickedIndex) {
                onSelectCard(clickedIndex);
            }

            // 长按拖动微调功能已禁用（与画布拖动功能冲突）
            // 请使用小眼睛面板中的方向键微调选区位置
            // if (!isZoomed) {
            //     longPressTimerRef.current = setTimeout(() => {
            //         setDragState({
            //             isDragging: true,
            //             startX: x,
            //             startY: y,
            //             initialBox: { ...recognizedCards[clickedIndex].box }
            //         });
            //         updateCropMagnifier({ ...recognizedCards[clickedIndex].box }, rawX, rawY);
            //     }, 600);
            // }
        } else {
            onSelectCard(-1);
        }
    }, [originalImage, recognizedCards, selectedCardIndex, getMousePos, onSelectCard, updateCropMagnifier, isZoomed]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragState.isDragging) {
            const { x, y, rawX, rawY } = getMousePos(e);
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = 'none';

            if (selectedCardIndex !== -1 && dragState.initialBox) {
                const dx = x - dragState.startX;
                const dy = y - dragState.startY;

                const newBox: Box = {
                    ...dragState.initialBox,
                    x1: dragState.initialBox.x1 + dx,
                    x2: dragState.initialBox.x2 + dx,
                    y1: dragState.initialBox.y1 + dy,
                    y2: dragState.initialBox.y2 + dy
                };

                onUpdateCardBox(selectedCardIndex, newBox);
                updateCropMagnifier(newBox, rawX, rawY);
            }
        }
    }, [dragState, selectedCardIndex, getMousePos, onUpdateCardBox, updateCropMagnifier]);

    const handleMouseUp = useCallback(async () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (dragState.isDragging && selectedCardIndex !== -1) {
            setDragState(prev => ({ ...prev, isDragging: false }));
            setMagnifier(prev => ({ ...prev, show: false }));

            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = 'default';

            onReprocessCard(selectedCardIndex);
        }
    }, [dragState.isDragging, selectedCardIndex, onReprocessCard]);

    const handleMouseLeave = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (dragState.isDragging) {
            setDragState(prev => ({ ...prev, isDragging: false }));
            setMagnifier(prev => ({ ...prev, show: false }));
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = 'default';
            if (selectedCardIndex !== -1) onReprocessCard(selectedCardIndex);
        }
    }, [dragState.isDragging, selectedCardIndex, onReprocessCard]);

    return {
        dragState,
        magnifier,
        canvasRef,
        containerRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave
    };
}
