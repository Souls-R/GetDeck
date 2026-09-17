import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/utils/modelLoader.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { loadModel } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const bytes = new Uint8Array([1, 2, 3, 4]);
const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const manifest = { version: 'v1', url: 'https://models.test/model.onnx?v=1', sha256 };
let entries, calls, current, offline, failWrite, badDownload;
const key = value => new URL(typeof value === 'string' ? value : value.url, 'https://get-deck.com').href;

beforeEach(() => {
    entries = new Map(); calls = []; current = manifest; offline = false; failWrite = false; badDownload = false;
    globalThis.location = { origin: 'https://get-deck.com' };
    globalThis.caches = { open: async () => ({
        match: async value => entries.get(key(value))?.clone(),
        put: async (value, response) => { if (failWrite) throw Error('Quota exceeded'); entries.set(key(value), response.clone()); },
        delete: async value => entries.delete(key(value)),
        keys: async () => [...entries.keys()].map(url => new Request(url)),
    }) };
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (offline) throw Error('Offline');
        if (url === '/model-manifest.json') return Response.json(current);
        return new Response(badDownload ? new Uint8Array([9]) : bytes, { headers: { 'content-length': '4' } });
    };
});

test('first download is verified; subsequent visits never fetch model bytes', async () => {
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
    const stages = [];
    await loadModel(manifest, progress => stages.push(progress.stage));
    assert.equal(calls.filter(call => call.url === manifest.url).length, 1);
    assert.deepEqual(stages, ['cache', 'initialize']);
    assert.equal(calls[0].options.cache, 'no-store');
});

test('new version downloads once and replaces the old cached model', async () => {
    await loadModel(manifest, () => {});
    current = { ...manifest, version: 'v2', url: 'https://models.test/model.onnx?v=2' };
    await loadModel(manifest, () => {});
    await loadModel(manifest, () => {});
    assert.equal(calls.filter(call => call.url === current.url).length, 1);
    const models = [...entries.keys()].filter(url => url.includes('__model_cache__'));
    assert.equal(models.length, 1);
    assert.match(models[0], /v2/);
});

test('offline manifest check reuses the last cached version', async () => {
    await loadModel(manifest, () => {});
    offline = true;
    assert.deepEqual(new Uint8Array(await loadModel({ ...manifest, version: 'v3' }, () => {})), bytes);
    assert.equal(calls.length, 3);
});

test('corrupt cache is discarded and downloaded again', async () => {
    await loadModel(manifest, () => {});
    const modelKey = [...entries.keys()].find(url => url.includes('__model_cache__'));
    entries.set(modelKey, new Response(new Uint8Array([9])));
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
    assert.equal(calls.filter(call => call.url === manifest.url).length, 2);
});

test('bad update is rejected and leaves the old version available offline', async () => {
    await loadModel(manifest, () => {});
    current = { ...manifest, version: 'v2' }; badDownload = true;
    await assert.rejects(loadModel(manifest, () => {}), /checksum/);
    offline = true;
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
});

test('storage disabled or full does not prevent recognition', async () => {
    failWrite = true;
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
    assert.equal(entries.size, 0);
    delete globalThis.caches;
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
});

test('invalid manifest falls back to bundled metadata', async () => {
    current = { version: 'broken' };
    assert.deepEqual(new Uint8Array(await loadModel(manifest, () => {})), bytes);
});
