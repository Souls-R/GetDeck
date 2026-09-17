export interface ModelManifest {
    version: string;
    url: string;
    sha256: string;
}

export type ModelProgress = { stage: 'cache' | 'download' | 'initialize'; percent: number | null };
const CACHE_NAME = 'getdeck-models-v1';
const MANIFEST_PATH = '/model-manifest.json';

function validManifest(value: unknown): value is ModelManifest {
    if (!value || typeof value !== 'object') return false;
    const item = value as ModelManifest;
    return typeof item.version === 'string' && item.version.length > 0
        && typeof item.url === 'string' && /^https:\/\//.test(item.url)
        && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256);
}

async function verified(buffer: ArrayBuffer, manifest: ModelManifest) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return hash === manifest.sha256;
}

// Cache storage is best effort: private browsing or quota failures must not block recognition.
async function bestEffort<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try { return await operation(); } catch { return undefined; }
}

export async function loadModel(fallback: ModelManifest, report: (progress: ModelProgress) => void): Promise<ArrayBuffer> {
    report({ stage: 'cache', percent: null });
    const cache = await bestEffort(() => caches.open(CACHE_NAME));
    let manifest = fallback;
    try {
        const response = await fetch(MANIFEST_PATH, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Model manifest unavailable');
        const value: unknown = await response.json();
        if (!validManifest(value)) throw new Error('Invalid model manifest');
        manifest = value;
    } catch {
        // Only remember manifests whose model was successfully saved.
        const saved = await bestEffort(async () => (await cache?.match(MANIFEST_PATH))?.json());
        if (validManifest(saved)) manifest = saved;
    }

    const key = new URL(`/__model_cache__/${encodeURIComponent(manifest.version)}/${manifest.sha256}`, location.origin).href;
    const cached = await bestEffort(async () => (await cache?.match(key))?.arrayBuffer());
    if (cached && await verified(cached, manifest)) {
        await bestEffort(async () => cache?.put(MANIFEST_PATH, Response.json(manifest)));
        report({ stage: 'initialize', percent: null });
        return cached;
    }
    if (cached) await bestEffort(async () => cache?.delete(key));

    report({ stage: 'download', percent: 0 });
    // Cache API controls persistence; bypass potentially stale HTTP copies on a cache miss.
    const response = await fetch(manifest.url, { mode: 'cors', cache: 'no-store', signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
    const total = Number(response.headers.get('content-length'));
    let buffer: ArrayBuffer;
    if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                report({ stage: 'download', percent: total > 0 ? Math.min(100, Math.round(received / total * 100)) : null });
            }
        } finally {
            reader.releaseLock();
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
    } else {
        buffer = await response.arrayBuffer();
    }
    if (!await verified(buffer, manifest)) throw new Error('Model checksum mismatch; please retry');

    if (cache) await bestEffort(async () => {
        await cache.put(key, new Response(buffer));
        await cache.put(MANIFEST_PATH, Response.json(manifest));
        // Never remove unrelated site caches, including recognition history.
        for (const request of await cache.keys()) {
            if (new URL(request.url).pathname.startsWith('/__model_cache__/') && request.url !== key) {
                await cache.delete(request);
            }
        }
    });
    report({ stage: 'initialize', percent: null });
    return buffer;
}
