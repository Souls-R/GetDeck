"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as ort from 'onnxruntime-web';
import { Box, CardHashEntry, Match, RecognizedCard, CardInfo } from '../types';
import { PHash } from '../utils/phash';
import { 
    preprocessImage, 
    postprocessYOLO, 
    sortBoxesByRow, 
    extractArtwork, 
    findBestMatch,
    STANDARD_CARD,
    PENDULUM_CARD
} from '../utils/recognition';

const MODEL_PATH = '/best.onnx';
const HASH_DB_PATH = '/card_hash.json';

interface ProcessingVisual {
    index: number;
    artworkUrl: string;
    currentMatchName: string;
}

export default function DeckRecognizer() {
    // ---------------- State ----------------
    // Global & Session
    const [session, setSession] = useState<ort.InferenceSession | null>(null);
    const [hashDatabase, setHashDatabase] = useState<CardHashEntry[] | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [statusText, setStatusText] = useState<string>('正在初始化模型...');

    // Image & Processing
    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
    const [processingStage, setProcessingStage] = useState<'idle' | 'detecting' | 'identifying' | 'done'>('idle');
    const [progress, setProgress] = useState<number>(0);
    const [processingVisual, setProcessingVisual] = useState<ProcessingVisual | null>(null);

    // Results
    const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
    const [selectedCardIndex, setSelectedCardIndex] = useState<number>(-1);
    
    // Card Details & Correction
    const [cardInfoCache, setCardInfoCache] = useState<Record<string, CardInfo>>({});
    const [selectedCardInfo, setSelectedCardInfo] = useState<CardInfo | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [selectedCardArtwork, setSelectedCardArtwork] = useState<string | null>(null);
    const [forcePendulumMode, setForcePendulumMode] = useState(false); 
    const [isSourcePanelExpanded, setIsSourcePanelExpanded] = useState(false); // Collapsed by default

    // Dragging State & Magnifier
    const [dragState, setDragState] = useState<{ isDragging: boolean; startX: number; startY: number; initialBox: Box | null }>({
        isDragging: false, startX: 0, startY: 0, initialBox: null
    });
    const [magnifier, setMagnifier] = useState<{ show: boolean; x: number; y: number; content: string | null }>({
        show: false, x: 0, y: 0, content: null
    });
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ---------------- Initialization ----------------
    useEffect(() => {
        async function init() {
            try {
                ort.env.wasm.wasmPaths = "/"; 
                ort.env.wasm.numThreads = 1;
                
                const [sessionResult, dbResult] = await Promise.all([
                    ort.InferenceSession.create(MODEL_PATH, {
                        executionProviders: ['wasm'],
                        graphOptimizationLevel: 'all'
                    }),
                    fetch(HASH_DB_PATH).then(r => {
                        if (!r.ok) throw new Error(`数据库加载失败: ${r.statusText}`);
                        return r.json();
                    })
                ]);

                setSession(sessionResult);
                setHashDatabase(dbResult);
                setIsInitializing(false);
                setStatusText("就绪");
            } catch (error: any) {
                setStatusText(`初始化失败: ${error.message}`);
                console.error(error);
            }
        }
        init();
    }, []);

    // ---------------- Event Handlers ----------------

    const handleFile = useCallback(async (file: File) => {
        if (!session || !hashDatabase) return;
        setRecognizedCards([]);
        setSelectedCardIndex(-1);
        setSelectedCardInfo(null);
        setSelectedCardArtwork(null);
        setProcessingStage('idle');
        setProgress(0);
        setProcessingVisual(null);
        setForcePendulumMode(false);
        setIsSourcePanelExpanded(false);

        try {
            const img = await loadImage(file);
            setOriginalImage(img);
            processImagePipeline(img);
        } catch (error: any) {
            setStatusText(`图片加载失败: ${error.message}`);
        }
    }, [session, hashDatabase]);

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) handleFile(file);
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleFile]);


    // ---------------- Processing Pipeline ----------------

    const processImagePipeline = async (img: HTMLImageElement) => {
        if (!session || !hashDatabase) return;

        try {
            setProcessingStage('detecting');
            setStatusText('正在检测卡片位置...');
            await new Promise(resolve => requestAnimationFrame(resolve));

            const { tensor, scale, padX, padY } = preprocessImage(img);
            const feeds = { images: tensor };
            const results = await session.run(feeds);
            const output = results[Object.keys(results)[0]];
            const boxes = postprocessYOLO(output, scale, padX, padY, img.width, img.height);

            if (boxes.length === 0) {
                setStatusText('未检测到卡片');
                setProcessingStage('done');
                return;
            }

            const sortedBoxes = sortBoxesByRow(boxes);
            const initialCards: RecognizedCard[] = sortedBoxes.map((box, i) => ({
                box,
                index: i,
                matches: [],
                selectedMatchIndex: 0,
                hashStandard: '',
                hashPendulum: ''
            }));
            setRecognizedCards(initialCards);

            setProcessingStage('identifying');
            setStatusText('正在识别卡片...');
            
            const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
            ctx.canvas.width = img.width;
            ctx.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const phash = new PHash(16);
            const CHUNK_SIZE = 3; 
            for (let i = 0; i < sortedBoxes.length; i++) {
                const box = sortedBoxes[i];
                const artworkStandard = extractArtwork(ctx, box, STANDARD_CARD);
                const artworkPendulum = extractArtwork(ctx, box, PENDULUM_CARD);
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = artworkStandard.width;
                tempCanvas.height = artworkStandard.height;
                tempCanvas.getContext('2d')!.putImageData(artworkStandard, 0, 0);
                const artworkUrl = tempCanvas.toDataURL();

                const hashStandard = phash.compute(artworkStandard);
                const hashPendulum = phash.compute(artworkPendulum);
                const matchResult = findBestMatch(hashStandard, hashPendulum, hashDatabase);

                setProcessingVisual({
                    index: i + 1,
                    artworkUrl,
                    currentMatchName: matchResult.matches[0]?.name || '...'
                });

                setRecognizedCards(prev => {
                    const next = [...prev];
                    next[i] = {
                        ...next[i],
                        matches: matchResult.matches,
                        hashStandard,
                        hashPendulum
                    };
                    return next;
                });

                setProgress(Math.round(((i + 1) / sortedBoxes.length) * 100));

                if (i % CHUNK_SIZE === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            setProcessingStage('done');
            setStatusText('识别完成');
            setProcessingVisual(null);

        } catch (error: any) {
            console.error(error);
            setStatusText(`处理出错: ${error.message}`);
            setProcessingStage('done');
        }
    };

    const loadImage = (file: File): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    };


    // ---------------- Canvas Rendering ----------------

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !originalImage || !container) return;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        const imgAspect = originalImage.width / originalImage.height;
        const containerAspect = containerW / containerH;

        let renderW, renderH;
        if (containerAspect > imgAspect) {
            renderH = containerH;
            renderW = renderH * imgAspect;
        } else {
            renderW = containerW;
            renderH = renderW / imgAspect;
        }

        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        canvas.style.width = `${renderW}px`;
        canvas.style.height = `${renderH}px`;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        recognizedCards.forEach((card, i) => {
            const { box } = card;
            const isSelected = i === selectedCardIndex;
            const isIdentified = card.matches.length > 0;

            if (isSelected) {
                ctx.strokeStyle = '#fbbf24'; 
                ctx.lineWidth = dragState.isDragging ? 6 : 4; // Bolder when dragging
                ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
            } else if (isIdentified) {
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'rgba(52, 211, 153, 0.1)';
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.fillStyle = 'transparent';
            }

            ctx.beginPath();
            ctx.rect(box.x1, box.y1, box.x2 - box.x1, box.y2 - box.y1);
            ctx.stroke();
            if (isSelected || isIdentified) ctx.fill();
        });
    }, [originalImage, recognizedCards, selectedCardIndex, dragState.isDragging]);

    useEffect(() => {
        drawCanvas();
        const resizeObserver = new ResizeObserver(() => drawCanvas());
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [drawCanvas]);


    // ---------------- Canvas Interaction (Long Press Drag + Magnifier) ----------------

    const getMousePos = (e: React.MouseEvent) => {
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
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
                selectCard(clickedIndex);
            }

            longPressTimerRef.current = setTimeout(() => {
                // Enter Micro-Adjustment Mode
                setDragState({
                    isDragging: true,
                    startX: x,
                    startY: y,
                    initialBox: { ...recognizedCards[clickedIndex].box }
                });
                
                updateCropMagnifier({ ...recognizedCards[clickedIndex].box }, rawX, rawY);
            }, 600); // Changed to 600ms as requested
        } else {
            setSelectedCardIndex(-1);
        }
    };

    const updateCropMagnifier = (box: Box, screenX: number, screenY: number) => {
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
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragState.isDragging) {
            const { x, y, rawX, rawY } = getMousePos(e);
            const canvas = canvasRef.current;
            if(canvas) canvas.style.cursor = 'none';

            if (selectedCardIndex !== -1 && dragState.initialBox) {
                const dx = x - dragState.startX;
                const dy = y - dragState.startY;
                
                const newBox = {
                    ...dragState.initialBox,
                    x1: dragState.initialBox.x1 + dx,
                    x2: dragState.initialBox.x2 + dx,
                    y1: dragState.initialBox.y1 + dy,
                    y2: dragState.initialBox.y2 + dy
                };

                setRecognizedCards(prev => {
                    const next = [...prev];
                    next[selectedCardIndex] = { ...next[selectedCardIndex], box: newBox };
                    return next;
                });

                updateCropMagnifier(newBox, rawX, rawY);
            }
        }
    };

    const handleMouseUp = async () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (dragState.isDragging && selectedCardIndex !== -1) {
            setDragState(prev => ({ ...prev, isDragging: false }));
            setMagnifier(prev => ({ ...prev, show: false }));
            
            const canvas = canvasRef.current;
            if(canvas) canvas.style.cursor = 'default';

            await reprocessCard(selectedCardIndex);
        }
    };

    const handleMouseLeave = () => {
         if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (dragState.isDragging) {
            setDragState(prev => ({ ...prev, isDragging: false }));
            setMagnifier(prev => ({ ...prev, show: false }));
            const canvas = canvasRef.current;
            if(canvas) canvas.style.cursor = 'default';
            if (selectedCardIndex !== -1) reprocessCard(selectedCardIndex);
        }
    };


    // ---------------- Selection & Logic ----------------

    const selectCard = async (index: number) => {
        if (index === -1) return;
        const card = recognizedCards[index];
        setSelectedCardIndex(index);
        
        const currentMatch = card.matches[card.selectedMatchIndex];
        const isPendulumMatch = currentMatch?.cardType === 'pendulum';
        setForcePendulumMode(isPendulumMatch);
        
        updateArtworkPreview(index, isPendulumMatch);

        if (card.matches.length > 0) {
            await fetchCardInfo(currentMatch.name);
        }
    };

    const updateArtworkPreview = (index: number, isPendulum: boolean) => {
        if (!originalImage || index === -1) return;
        const card = recognizedCards[index];
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);
        
        const cropConfig = isPendulum ? PENDULUM_CARD : STANDARD_CARD;
        const artworkData = extractArtwork(ctx, card.box, cropConfig);
        
        const artworkCanvas = document.createElement('canvas');
        artworkCanvas.width = artworkData.width;
        artworkCanvas.height = artworkData.height;
        artworkCanvas.getContext('2d')!.putImageData(artworkData, 0, 0);
        setSelectedCardArtwork(artworkCanvas.toDataURL());
    };

    const toggleCardMode = () => {
        if (selectedCardIndex === -1) return;
        const newMode = !forcePendulumMode;
        setForcePendulumMode(newMode);
        updateArtworkPreview(selectedCardIndex, newMode);
    };

    const reprocessCard = async (index: number) => {
        if (!originalImage || !hashDatabase) return;
        const card = recognizedCards[index];
        
        const canvas = document.createElement('canvas');
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(originalImage, 0, 0);

        const phash = new PHash(16);
        const artworkStandard = extractArtwork(ctx, card.box, STANDARD_CARD);
        const artworkPendulum = extractArtwork(ctx, card.box, PENDULUM_CARD);
        const hashStandard = phash.compute(artworkStandard);
        const hashPendulum = phash.compute(artworkPendulum);

        const matchResult = findBestMatch(hashStandard, hashPendulum, hashDatabase);

        setRecognizedCards(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                matches: matchResult.matches,
                selectedMatchIndex: 0,
                hashStandard,
                hashPendulum
            };
            return next;
        });
        
        updateArtworkPreview(index, forcePendulumMode);
        
        if (matchResult.matches.length > 0) {
            await fetchCardInfo(matchResult.matches[0].name);
        }
    };

    const fetchCardInfo = async (name: string) => {
        if (cardInfoCache[name]) {
            setSelectedCardInfo(cardInfoCache[name]);
            return;
        }
        setIsDetailLoading(true);
        try {
            const response = await fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(name)}`);
            const data = await response.json();
            setCardInfoCache(prev => ({ ...prev, [name]: data }));
            setSelectedCardInfo(data);
        } catch (error) {
            console.error('获取卡片信息失败:', error);
            setSelectedCardInfo(null);
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleSelectAltMatch = (matchIndex: number) => {
        if (selectedCardIndex === -1) return;
        const newRecognizedCards = [...recognizedCards];
        newRecognizedCards[selectedCardIndex].selectedMatchIndex = matchIndex;
        setRecognizedCards(newRecognizedCards);
        
        const newMatch = newRecognizedCards[selectedCardIndex].matches[matchIndex];
        fetchCardInfo(newMatch.name);
        
        const isPendulum = newMatch.cardType === 'pendulum';
        setForcePendulumMode(isPendulum);
        updateArtworkPreview(selectedCardIndex, isPendulum);
    };


    // ---------------- UI Components ----------------

    return (
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden select-none">
            {/* Magnifier Portal */}
            {magnifier.show && magnifier.content && (
                <div 
                    className="fixed z-50 pointer-events-none border-2 border-white rounded-lg overflow-hidden shadow-2xl bg-black animate-in zoom-in-110 fade-in duration-200"
                    style={{
                        left: magnifier.x + 30, 
                        top: magnifier.y - 75,
                        width: '180px',
                        height: '180px',
                        transform: 'translateY(-20px)'
                    }}
                >
                    <img 
                        src={magnifier.content} 
                        className="w-full h-full object-contain bg-gray-900 animate-pulse duration-1000" 
                        alt="Real-time Crop Preview" 
                    />
                    <div className="absolute inset-0 opacity-40">
                        <div className="absolute top-1/2 left-0 w-full h-px bg-blue-400"></div>
                        <div className="absolute left-1/2 top-0 h-full w-px bg-blue-400"></div>
                    </div>
                    {/* Visual cue: Active status */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                </div>
            )}

            {/* Header */}
            <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold tracking-tight bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                        Master Duel 卡组识别
                    </h1>
                </div>
                
                <div className="flex items-center gap-4">
                    {processingStage !== 'idle' && processingStage !== 'done' && (
                        <div className="flex items-center gap-3">
                             <div className="text-xs text-blue-300 font-mono animate-pulse">{statusText}</div>
                             <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-blue-500 transition-all duration-200" style={{width: `${progress}%`}}></div>
                             </div>
                        </div>
                    )}

                    {originalImage && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isInitializing || processingStage === 'detecting' || processingStage === 'identifying'}
                            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                            title="打开新文件"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
                </div>
            </header>

            {/* Main Body */}
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* Empty State */}
                {!originalImage && (
                    <div 
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
                    >
                        <div className="p-12 border border-gray-800 bg-gray-900/50 rounded-2xl flex flex-col items-center gap-6 text-gray-400 shadow-2xl">
                             {isInitializing ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-sm font-medium text-gray-500">正在加载模型资源...</p>
                                </div>
                             ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-xl font-medium text-gray-200">选择卡组截图</p>
                                        <p className="text-sm">拖拽图片到此处，或按 <kbd className="px-2 py-0.5 rounded bg-gray-800 font-sans border border-gray-700">Ctrl + V</kbd></p>
                                    </div>
                                    <button onClick={() => fileInputRef.current?.click()} className="mt-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium">
                                        浏览文件
                                    </button>
                                </>
                             )}
                        </div>
                    </div>
                )}

                {/* Left: Canvas */}
                <div ref={containerRef} className="flex-1 bg-gray-950 relative overflow-hidden flex items-center justify-center p-8 select-none">
                    <canvas 
                        ref={canvasRef} 
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        className={`shadow-2xl shadow-black/50 transition-transform duration-300 ${dragState.isDragging ? 'scale-[1.01]' : 'scale-100'}`} 
                        style={{opacity: originalImage ? 1 : 0}} 
                    />
                    
                    {originalImage && processingStage === 'done' && !dragState.isDragging && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white/70 text-xs px-4 py-2 rounded-full pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-700">
                            长按黄色方框以进行精确微调
                        </div>
                    )}
                </div>

                {/* Right: Sidebar */}
                <div className="w-96 border-l border-gray-800 bg-gray-900 flex flex-col shrink-0">
                    
                    {/* A. Processing State */}
                    {processingStage === 'identifying' && (
                         <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in duration-300">
                            <div className="text-sm text-blue-400 font-medium tracking-wider uppercase">正在识别</div>
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-blue-500/30 bg-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                {processingVisual?.artworkUrl && (
                                    <img src={processingVisual.artworkUrl} className="w-full h-full object-contain" alt="processing" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent"></div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-light text-white">
                                    {processingVisual?.index || 0} <span className="text-gray-600 text-lg">/ {recognizedCards.length}</span>
                                </div>
                                <div className="text-xs text-gray-500 truncate max-w-[200px] mx-auto min-h-[1rem]">
                                    {processingVisual?.currentMatchName}
                                </div>
                            </div>
                         </div>
                    )}

                    {/* B. Detail State */}
                    {processingStage === 'done' && selectedCardIndex !== -1 && (
                        <div className="flex flex-col h-full animate-in slide-in-from-right-10 duration-200">
                             {/* Header */}
                             <div className="p-5 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
                                <h2 className="text-lg font-bold leading-tight text-white mb-1 line-clamp-2">
                                    {recognizedCards[selectedCardIndex]?.matches?.[recognizedCards[selectedCardIndex].selectedMatchIndex]?.name}
                                </h2>
                                <p className="text-xs text-blue-400 font-mono">
                                    {selectedCardInfo?.result?.[0]?.text?.types || 'Loading...'}
                                </p>
                             </div>

                             <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                                
                                {/* Source Crop Panel (Collapsible) */}
                                <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden transition-all duration-300">
                                    <button 
                                        onClick={() => setIsSourcePanelExpanded(!isSourcePanelExpanded)}
                                        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase hover:bg-gray-800/50 transition-colors"
                                    >
                                        <span>识别源图像</span>
                                        <svg className={`w-4 h-4 transition-transform duration-300 ${isSourcePanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    
                                    {isSourcePanelExpanded && (
                                        <div className="p-3 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center bg-gray-800 rounded p-0.5 border border-gray-700 self-start w-fit">
                                                <button 
                                                    onClick={() => { if(forcePendulumMode) toggleCardMode(); }}
                                                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${!forcePendulumMode ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    Standard
                                                </button>
                                                <button 
                                                    onClick={() => { if(!forcePendulumMode) toggleCardMode(); }}
                                                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${forcePendulumMode ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    Pendulum
                                                </button>
                                            </div>
                                            
                                            <div className="flex gap-4 items-center">
                                                <div className="w-24 h-24 bg-black rounded border border-gray-700 flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner">
                                                    {selectedCardArtwork ? (
                                                        <img src={selectedCardArtwork} className="w-full h-full object-contain" alt="source crop" />
                                                    ) : (
                                                        <div className="text-xs text-gray-600">No Img</div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-500 leading-relaxed italic">
                                                    可在左侧图片上<br/>长按并拖动方框微调
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Official Info */}
                                {selectedCardInfo?.result?.[0] && (
                                    <>
                                        <div className="w-40 mx-auto rounded overflow-hidden shadow-lg border border-white/10 opacity-95 hover:opacity-100 transition-opacity">
                                            <img src={`https://cdn.233.momobako.com/ygoimg/sc/${selectedCardInfo.result[0].id}.webp`} className="w-full" alt="Official Art" />
                                        </div>
                                        
                                        <div className="text-sm text-gray-300 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                                            {selectedCardInfo.result[0].text.desc}
                                        </div>
                                    </>
                                )}

                                {/* Alternates */}
                                {recognizedCards[selectedCardIndex]?.matches?.length > 1 && (
                                    <div className="space-y-2 pt-2">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">备选匹配</div>
                                        {recognizedCards[selectedCardIndex].matches.map((m, idx) => (
                                            idx !== recognizedCards[selectedCardIndex].selectedMatchIndex && (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSelectAltMatch(idx)}
                                                    className="w-full text-left p-2.5 rounded bg-gray-800/50 hover:bg-gray-700 border border-transparent hover:border-gray-600 transition-all flex justify-between group items-center"
                                                >
                                                    <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1">{m.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2 font-mono">{m.distance}</span>
                                                </button>
                                            )
                                        ))}
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {/* C. Idle/Done Empty State */}
                    {processingStage === 'done' && selectedCardIndex === -1 && (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-600 space-y-4">
                            <div className="text-4xl font-light text-gray-700">{recognizedCards.length}</div>
                            <p className="text-sm">检测到卡片<br/>点击图片中的卡片查看详情</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
