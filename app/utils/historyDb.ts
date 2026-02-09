import { RecognizedCard } from '../types';

export interface DeckHistory {
  id: string;
  createdAt: number;
  thumbnail: Blob;
  originalImage: Blob;
  recognizedCards: RecognizedCard[];
  deckCode?: string;
  cardCount: number;
  sourceType?: 'image' | 'ydk';
  ydkText?: string;
}

const DB_NAME = 'getdeck-history';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  // 检查现有连接是否有效
  if (dbInstance) {
    try {
      // 尝试访问 objectStoreNames 来验证连接是否有效
      dbInstance.objectStoreNames;
      return Promise.resolve(dbInstance);
    } catch {
      // 连接已失效，重置
      dbInstance = null;
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      // 监听连接关闭事件
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// 生成缩略图
async function generateThumbnail(image: HTMLImageElement, maxSize: number = 400): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const ratio = Math.min(maxSize / image.width, maxSize / image.height);
  canvas.width = image.width * ratio;
  canvas.height = image.height * ratio;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate thumbnail'));
      }
    }, 'image/jpeg', 0.7);
  });
}

// 将 HTMLImageElement 转为 Blob
async function imageToBlob(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert image to blob'));
      }
    }, 'image/jpeg', 0.9);
  });
}

// 将 Blob 转为 HTMLImageElement
// 注意：不要在 onload 中撤销 URL，因为后续裁剪功能需要使用 img.src
export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// 保存历史记录
export async function saveHistory(
  image: HTMLImageElement,
  recognizedCards: RecognizedCard[],
  deckCode?: string
): Promise<DeckHistory> {
  const db = await openDB();

  const [thumbnail, originalImage] = await Promise.all([
    generateThumbnail(image),
    imageToBlob(image)
  ]);

  const history: DeckHistory = {
    id: Date.now().toString(),
    createdAt: Date.now(),
    thumbnail,
    originalImage,
    recognizedCards,
    deckCode,
    cardCount: recognizedCards.length,
    sourceType: 'image'
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(history);

    request.onsuccess = () => resolve(history);
    request.onerror = () => reject(request.error);
  });
}

// 保存 YDK 历史记录（无图片，使用极小占位图）
export async function saveYdkHistory(
  ydkText: string,
  recognizedCards: RecognizedCard[]
): Promise<DeckHistory> {
  const db = await openDB();

  // 使用极小的透明图片作为占位，节省空间
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const placeholder = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(), 'image/png');
  });

  const history: DeckHistory = {
    id: Date.now().toString(),
    createdAt: Date.now(),
    thumbnail: placeholder,
    originalImage: placeholder,
    recognizedCards,
    cardCount: recognizedCards.length,
    sourceType: 'ydk',
    ydkText
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(history);

    request.onsuccess = () => resolve(history);
    request.onerror = () => reject(request.error);
  });
}

// 更新历史记录（如更新卡组码）
export async function updateHistory(
  id: string,
  updates: Partial<Pick<DeckHistory, 'deckCode' | 'recognizedCards'>>
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const history = getRequest.result;
      if (history) {
        const updated = { ...history, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// 获取所有历史记录（按时间倒序）
export async function getAllHistory(): Promise<DeckHistory[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');

    const results: DeckHistory[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// 获取单条历史记录
export async function getHistory(id: string): Promise<DeckHistory | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// 删除历史记录
export async function deleteHistory(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 清空所有历史记录
export async function clearAllHistory(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 获取历史记录数量
export async function getHistoryCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
