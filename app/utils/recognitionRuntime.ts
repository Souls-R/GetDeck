import * as ort from 'onnxruntime-web';
import init, { Database } from 'core-wasm';
import manifest from '../../public/model-manifest.json';
import { CardHashEntry } from '../types';
import { loadModel, ModelProgress } from './modelLoader';

type Runtime = { session: ort.InferenceSession; database: Database; hashes: CardHashEntry[] };
let pending: Promise<Runtime> | null = null;
let coreInit: Promise<unknown> | null = null;
let progress: ModelProgress = { stage: 'cache', percent: null };
const listeners = new Set<(value: ModelProgress) => void>();

export function subscribeRuntime(listener: (value: ModelProgress) => void) {
    listeners.add(listener);
    listener(progress);
    return () => { listeners.delete(listener); };
}

function report(value: ModelProgress) {
    progress = value;
    listeners.forEach(listener => listener(value));
}

export function getRecognitionRuntime(): Promise<Runtime> {
    if (pending) return pending;
    pending = (async () => {
        const china = navigator.language.toLowerCase().startsWith('zh') || new Date().getTimezoneOffset() === -480;
        ort.env.wasm.wasmPaths = china
            ? 'https://registry.npmmirror.com/onnxruntime-web/1.23.2/files/dist/'
            : 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
        ort.env.wasm.numThreads = 1;
        coreInit ??= init().catch(error => { coreInit = null; throw error; });
        const tasks = [
            coreInit,
            loadModel(manifest, report),
            fetch('/card_data.json').then(async response => {
                if (!response.ok) throw new Error(`Database load failed: ${response.status}`);
                return await response.json() as CardHashEntry[];
            }),
        ] as const;
        const [, buffer, hashes] = await Promise.all(tasks).catch(async error => {
            // Let ongoing downloads settle before a retry can start another initialization.
            await Promise.allSettled(tasks);
            throw error;
        });
        report({ stage: 'initialize', percent: null });
        const session = await ort.InferenceSession.create(buffer, {
            executionProviders: ['wasm'], graphOptimizationLevel: 'all',
        });
        const database = new Database();
        try { database.load_database(JSON.stringify(hashes)); }
        catch (error) { database.free(); await session.release(); throw error; }
        return { session, database, hashes };
    })().catch(error => { pending = null; throw error; });
    return pending;
}
