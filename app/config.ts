/**
 * 统一配置文件
 * 所有域名和外部服务地址都在这里管理
 */

const isDev = process.env.NODE_ENV === 'development';

export const config = {
  // 主站域名
  siteUrl: isDev ? 'http://localhost:3000' : 'https://get-deck.com',

  // API 域名
  apiUrl: isDev ? 'https://api.get-deck.com' : 'https://api.get-deck.com',

  // CDN 域名
  cdnUrl: 'https://api.get-deck.com',

  // ONNX 模型路径
  modelPath: 'https://api.get-deck.com/best.onnx',
} as const;

// 便捷导出
export const { siteUrl, apiUrl, cdnUrl, modelPath } = config;

// 卡图多语言 URL
type CardImageLang = 'zh' | 'ja' | 'en';
const CARD_IMAGE_LANG_FALLBACK: Record<string, CardImageLang> = { zh: 'zh', ja: 'ja', en: 'en' };

export const getCardImageUrl = (id: number, locale: string) =>
  `https://img.get-deck.com/${CARD_IMAGE_LANG_FALLBACK[locale] ?? 'zh'}/${id}`;
