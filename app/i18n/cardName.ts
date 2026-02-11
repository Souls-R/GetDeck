import { CardInfo } from '../types';
import { Locale } from './index';
import { stripRuby } from '../utils/cardApi';

export function getLocalizedCardName(info: CardInfo | null | undefined, fallback: string, locale: Locale): string {
  if (!info) return fallback;
  if (locale === 'ja') return info.name.ja ? stripRuby(info.name.ja) : fallback;
  if (locale === 'en') return info.name.en || fallback;
  return fallback; // zh uses card_data.json name
}

export function getLocalizedCardText(info: CardInfo | null | undefined, locale: Locale): string {
  if (!info) return '';
  if (locale === 'ja') return info.text.ja || info.text.zh || '';
  if (locale === 'en') return info.text.en || info.text.zh || '';
  return info.text.zh || '';
}
