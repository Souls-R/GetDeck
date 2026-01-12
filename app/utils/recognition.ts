import * as ort from 'onnxruntime-web';
import { Box, CardHashEntry, Match, RecognizedCard } from '../types';
import { PHash } from './phash';

export const INPUT_SIZE = 1280;
export const CONF_THRESHOLD = 0.7;
export const IOU_THRESHOLD = 0.5;

export const STANDARD_CARD = { width: 130, height: 186, left: 15, top: 33, right: 115, bottom: 133 };
export const PENDULUM_CARD = { width: 405, height: 591, left: 26, top: 106, right: 379, bottom: 367 };

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

export function findBestMatch(hashStandard: string, hashPendulum: string, hashDatabase: CardHashEntry[]): { matches: Match[]; hashStandard: string; hashPendulum: string } {
    const matches: Match[] = [];

    for (const card of hashDatabase) {
        const hash = card.card_type === 'standard' ? hashStandard : hashPendulum;
        const dist = PHash.hammingDistance(hash, card.phash);

        matches.push({
            id: card.id,
            name: card.name,
            distance: dist,
            cardType: card.card_type,
            dbHash: card.phash
        });
    }

    matches.sort((a, b) => a.distance - b.distance);
    return {
        matches: matches.slice(0, 3),
        hashStandard,
        hashPendulum
    };
}
