import * as ort from 'onnxruntime-web';
import { Box, CardHashEntry, Match, RecognizedCard } from '../types';

export const INPUT_SIZE = 1280;
export const CONF_THRESHOLD = 0.7;
export const IOU_THRESHOLD = 0.5;

export const STANDARD_CARD = { width: 130, height: 186, left: 16, top: 34, right: 114, bottom: 131 };
export const PENDULUM_CARD = { width: 405, height: 591, left: 26, top: 106, right: 379, bottom: 367 };

// 多采样偏移量：在多个位置采样以找到最佳匹配（解决 1-2 像素检测误差问题）
export const SAMPLE_OFFSETS = [
    { dx: 0, dy: 0 },   // 原始位置
    { dx: -1, dy: 0 },  // 左移 1 像素
    { dx: 1, dy: 0 },   // 右移 1 像素
    { dx: 0, dy: -1 },  // 上移 1 像素
    { dx: 0, dy: 1 },   // 下移 1 像素
];

// 性能优化：如果匹配距离小于此阈值，则认为匹配足够好，不再进行多采样
// 设置为 50 比较保守，只有非常确信的匹配才跳过采样。
export const EARLY_EXIT_DISTANCE = 50;

export function preprocessImage(image: HTMLImageElement | HTMLCanvasElement): { tensor: ort.Tensor; scale: number; padX: number; padY: number } {
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    const scale = Math.min(INPUT_SIZE / image.width, INPUT_SIZE / image.height);
    const newW = Math.round(image.width * scale);
    const newH = Math.round(image.height * scale);
    const padX = (INPUT_SIZE - newW) / 2;
    const padY = (INPUT_SIZE - newH) / 2;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(image, padX, padY, newW, newH);

    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const data = imageData.data;
    const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        float32Data[i] = data[i * 4] / 255;                          // R
        float32Data[INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 1] / 255;     // G
        float32Data[2 * INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 2] / 255; // B
    }

    const tensor = new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    return { tensor, scale, padX, padY };
}

export function postprocessYOLO(output: ort.Tensor, scale: number, padX: number, padY: number, origW: number, origH: number): Box[] {
    const data = output.data as Float32Array;
    const dims = output.dims; // [1, features, numBoxes]
    const numBoxes = dims[2];

    const boxes: Box[] = [];

    for (let i = 0; i < numBoxes; i++) {
        const cx = data[0 * numBoxes + i];
        const cy = data[1 * numBoxes + i];
        const w = data[2 * numBoxes + i];
        const h = data[3 * numBoxes + i];
        const conf = data[4 * numBoxes + i];

        if (conf < CONF_THRESHOLD) continue;

        let x1 = (cx - w / 2 - padX) / scale;
        let y1 = (cy - h / 2 - padY) / scale;
        let x2 = (cx + w / 2 - padX) / scale;
        let y2 = (cy + h / 2 - padY) / scale;

        x1 = Math.max(0, Math.min(x1, origW));
        y1 = Math.max(0, Math.min(y1, origH));
        x2 = Math.max(0, Math.min(x2, origW));
        y2 = Math.max(0, Math.min(y2, origH));

        boxes.push({ x1, y1, x2, y2, conf });
    }

    return nms(boxes, IOU_THRESHOLD);
}

function nms(boxes: Box[], iouThreshold: number): Box[] {
    boxes.sort((a, b) => b.conf - a.conf);
    const result: Box[] = [];

    while (boxes.length > 0) {
        const best = boxes.shift()!;
        result.push(best);
        for (let i = 0; i < boxes.length; i++) {
            if (iou(best, boxes[i]) >= iouThreshold) {
                boxes.splice(i, 1);
                i--;
            }
        }
    }
    return result;
}

function iou(a: Box, b: Box): number {
    const interX1 = Math.max(a.x1, b.x1);
    const interY1 = Math.max(a.y1, b.y1);
    const interX2 = Math.min(a.x2, b.x2);
    const interY2 = Math.min(a.y2, b.y2);

    const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);

    return interArea / (areaA + areaB - interArea);
}

export function sortBoxesByRow(boxes: Box[]): Box[] {
    if (boxes.length === 0) return boxes;

    const avgHeight = boxes.reduce((sum, b) => sum + (b.y2 - b.y1), 0) / boxes.length;
    const rowThreshold = avgHeight * 0.3;

    boxes.sort((a, b) => a.y1 - b.y1);

    const rows: Box[][] = [];
    let currentRow: Box[] = [boxes[0]];

    for (let i = 1; i < boxes.length; i++) {
        if (Math.abs(boxes[i].y1 - currentRow[0].y1) < rowThreshold) {
            currentRow.push(boxes[i]);
        } else {
            currentRow.sort((a, b) => a.x1 - b.x1);
            rows.push(currentRow);
            currentRow = [boxes[i]];
        }
    }
    currentRow.sort((a, b) => a.x1 - b.x1);
    rows.push(currentRow);

    return rows.flat();
}

export function extractArtwork(ctx: CanvasRenderingContext2D, box: Box, cardType: { width: number; height: number; left: number; top: number; right: number; bottom: number }): ImageData {
    const cardW = box.x2 - box.x1;
    const cardH = box.y2 - box.y1;

    const left = box.x1 + cardW * (cardType.left / cardType.width);
    const top = box.y1 + cardH * (cardType.top / cardType.height);
    const right = box.x1 + cardW * (cardType.right / cardType.width);
    const bottom = box.y1 + cardH * (cardType.bottom / cardType.height);

    const width = Math.round(right - left);
    const height = Math.round(bottom - top);

    return ctx.getImageData(Math.round(left), Math.round(top), width, height);
}

// 将 artwork 统一缩放到固定尺寸以保证 hash 计算一致性
// 无论原图大小如何，都统一到 targetSize x targetSize
export function upscaleForHash(imageData: ImageData, targetSize: number = 128): ImageData {
    // 如果已经是目标尺寸，直接返回
    if (imageData.width === targetSize && imageData.height === targetSize) {
        return imageData;
    }

    // 创建临时 canvas 放置原始 ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // 创建目标 canvas 并缩放
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetSize;
    scaledCanvas.height = targetSize;
    const scaledCtx = scaledCanvas.getContext('2d')!;

    // 使用高质量缩放
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.drawImage(tempCanvas, 0, 0, targetSize, targetSize);

    return scaledCtx.getImageData(0, 0, targetSize, targetSize);
}

/**
 * 优化的图像处理器，用于减少 Canvas 创建和上下文切换开销
 * 复用内部 canvas 进行裁剪和缩放
 */
export class ImageProcessor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private targetSize: number;

    constructor(targetSize: number = 128) {
        this.targetSize = targetSize;
        this.canvas = document.createElement('canvas');
        this.canvas.width = targetSize;
        this.canvas.height = targetSize;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    /**
     * 直接从源 Canvas 中裁剪并缩放到目标尺寸，返回 Uint8Array 供 WASM 使用
     * 避免了中间的 ImageData 创建和额外的 Canvas 分配
     */
    public process(
        sourceCtx: CanvasRenderingContext2D,
        box: Box,
        cardType: { width: number; height: number; left: number; top: number; right: number; bottom: number }
    ): Uint8Array {
        const cardW = box.x2 - box.x1;
        const cardH = box.y2 - box.y1;

        const left = box.x1 + cardW * (cardType.left / cardType.width);
        const top = box.y1 + cardH * (cardType.top / cardType.height);
        const right = box.x1 + cardW * (cardType.right / cardType.width);
        const bottom = box.y1 + cardH * (cardType.bottom / cardType.height);

        const width = Math.max(1, right - left);
        const height = Math.max(1, bottom - top);

        // 清除画布（可选，因为直接覆盖了，但为了安全起见）
        // this.ctx.clearRect(0, 0, this.targetSize, this.targetSize);

        // 一步完成裁剪和缩放
        this.ctx.drawImage(
            sourceCtx.canvas,
            left, top, width, height, // Source crop
            0, 0, this.targetSize, this.targetSize // Destination scale
        );

        // 获取数据
        const imageData = this.ctx.getImageData(0, 0, this.targetSize, this.targetSize);
        return new Uint8Array(imageData.data.buffer);
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    public getProcessDataURL(
        sourceCtx: CanvasRenderingContext2D,
        box: Box,
        cardType: { width: number; height: number; left: number; top: number; right: number; bottom: number }
    ): string {
        this.process(sourceCtx, box, cardType);
        return this.canvas.toDataURL('image/png');
    }
}

