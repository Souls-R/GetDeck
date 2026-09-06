/* tslint:disable */
/* eslint-disable */

export class Database {
  free(): void;
  [Symbol.dispose](): void;
  load_database(json: string): void;
  find_best_match(hash_str: string, card_type: number): Array<any>;
  load_database_from_buffer(bytes: Uint8Array): void;
  constructor();
}

export function compare_hashes(hash1: string, hash2: string): number;

export function get_phash(data: Uint8Array): string;

export function get_phash_raw(rgba: Uint8Array, width: number, height: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_database_free: (a: number, b: number) => void;
  readonly compare_hashes: (a: number, b: number, c: number, d: number) => number;
  readonly database_find_best_match: (a: number, b: number, c: number, d: number) => any;
  readonly database_load_database: (a: number, b: number, c: number) => void;
  readonly database_load_database_from_buffer: (a: number, b: number, c: number) => void;
  readonly database_new: () => number;
  readonly get_phash: (a: number, b: number) => [number, number];
  readonly get_phash_raw: (a: number, b: number, c: number, d: number) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
