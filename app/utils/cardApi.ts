import { CardInfo } from '../types';
import { Locale } from '../i18n/index';

export const globalCardInfoCache: Record<string, CardInfo> = {};
const pendingRequests: Record<string, Promise<void> | undefined> = {};

const API_BASE = 'https://api.get-deck.com/cards/query';

export function stripRuby(text: string): string {
  return text.replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1')
    .replace(/<\/?ruby>/g, '').replace(/<rt>.*?<\/rt>/g, '');
}

// i18n term mapping for badges
const termMap: Record<string, Record<string, string>> = {
  // card_type
  Monster: { zh: '怪兽', ja: 'モンスター' },
  Spell: { zh: '魔法', ja: '魔法' },
  Trap: { zh: '陷阱', ja: '罠' },
  // monster subtypes (from monster_type_line)
  Normal: { zh: '通常', ja: '通常' },
  Effect: { zh: '效果', ja: '効果' },
  Fusion: { zh: '融合', ja: '融合' },
  Synchro: { zh: '同调', ja: 'シンクロ' },
  Xyz: { zh: '超量', ja: 'エクシーズ' },
  Link: { zh: '链接', ja: 'リンク' },
  Ritual: { zh: '仪式', ja: '儀式' },
  Pendulum: { zh: '灵摆', ja: 'ペンデュラム' },
  Tuner: { zh: '调整', ja: 'チューナー' },
  Flip: { zh: '反转', ja: 'リバース' },
  Toon: { zh: '卡通', ja: 'トゥーン' },
  Spirit: { zh: '灵魂', ja: 'スピリット' },
  Union: { zh: '同盟', ja: 'ユニオン' },
  Gemini: { zh: '二重', ja: 'デュアル' },
  // races
  Dragon: { zh: '龙', ja: 'ドラゴン' },
  Spellcaster: { zh: '魔法使', ja: '魔法使い' },
  Zombie: { zh: '不死', ja: 'アンデット' },
  Warrior: { zh: '战士', ja: '戦士' },
  'Beast-Warrior': { zh: '兽战士', ja: '獣戦士' },
  Beast: { zh: '兽', ja: '獣' },
  'Winged Beast': { zh: '鸟兽', ja: '鳥獣' },
  Fiend: { zh: '恶魔', ja: '悪魔' },
  Fairy: { zh: '天使', ja: '天使' },
  Insect: { zh: '昆虫', ja: '昆虫' },
  Dinosaur: { zh: '恐龙', ja: '恐竜' },
  Reptile: { zh: '爬虫', ja: '爬虫類' },
  Fish: { zh: '鱼', ja: '魚' },
  'Sea Serpent': { zh: '海龙', ja: '海竜' },
  Machine: { zh: '机械', ja: '機械' },
  Thunder: { zh: '雷', ja: '雷' },
  Aqua: { zh: '水', ja: '水' },
  Pyro: { zh: '炎', ja: '炎' },
  Rock: { zh: '岩石', ja: '岩石' },
  Plant: { zh: '植物', ja: '植物' },
  Psychic: { zh: '念动力', ja: 'サイキック' },
  Wyrm: { zh: '幻龙', ja: '幻竜' },
  Cyberse: { zh: '电子界', ja: 'サイバース' },
  'Divine-Beast': { zh: '幻神兽', ja: '幻神獣' },
  Illusion: { zh: '幻想魔', ja: 'イリュージョン' },
  // attributes
  DARK: { zh: '暗', ja: '闇' },
  LIGHT: { zh: '光', ja: '光' },
  WATER: { zh: '水', ja: '水' },
  FIRE: { zh: '炎', ja: '炎' },
  EARTH: { zh: '地', ja: '地' },
  WIND: { zh: '风', ja: '風' },
  DIVINE: { zh: '神', ja: '神' },
  // spell/trap properties
  'Quick-Play': { zh: '速攻', ja: '速攻' },
  Continuous: { zh: '永续', ja: '永続' },
  Equip: { zh: '装备', ja: '装備' },
  Field: { zh: '场地', ja: 'フィールド' },
  Counter: { zh: '反击', ja: 'カウンター' },
};

function localizeTerm(term: string, locale: Locale): string {
  if (locale === 'en') return term;
  return termMap[term]?.[locale] || term;
}

export function getCardBadges(info: CardInfo, locale: Locale): string[] {
  const badges: string[] = [];
  if (!info) return badges;

  if (info.card_type === 'Monster' && info.monster_type_line) {
    // Parse "Dragon / Fusion / Effect" into parts
    const parts = info.monster_type_line.split('/').map(s => s.trim());
    // First badge: monster subtypes (non-race parts)
    const raceSet = new Set(Object.keys(termMap).filter(k =>
      !['Monster', 'Spell', 'Trap', 'Normal', 'Effect', 'Fusion', 'Synchro', 'Xyz', 'Link',
        'Ritual', 'Pendulum', 'Tuner', 'Flip', 'Toon', 'Spirit', 'Union', 'Gemini',
        'DARK', 'LIGHT', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE',
        'Quick-Play', 'Continuous', 'Equip', 'Field', 'Counter'].includes(k)
    ));
    const subtypes: string[] = [];
    let race = '';
    for (const p of parts) {
      if (raceSet.has(p)) {
        race = p;
      } else {
        subtypes.push(p);
      }
    }
    // Badge 1: card_type + subtypes
    const mainParts = [localizeTerm('Monster', locale), ...subtypes.map(s => localizeTerm(s, locale))];
    badges.push(mainParts.join('/'));

    // Badge 2: race/attribute + level/rank/link
    let badge2Parts: string[] = [];
    if (race) badge2Parts.push(localizeTerm(race, locale));
    if (info.attribute) badge2Parts.push(localizeTerm(info.attribute, locale));
    let levelStr = '';
    if (info.rank != null) levelStr = `☆${info.rank}`;
    else if (info.level != null) levelStr = `★${info.level}`;
    else if (info.link_arrows) levelStr = `LINK-${info.link_arrows.length}`;
    if (badge2Parts.length > 0 || levelStr) {
      let b2 = badge2Parts.join('/');
      if (levelStr) b2 = b2 ? `${b2} ${levelStr}` : levelStr;
      badges.push(b2);
    }

    // Badge 3: ATK/DEF
    if (info.atk != null || info.def != null) {
      const atk = info.atk != null ? String(info.atk) : '?';
      const def = info.link_arrows ? '' : (info.def != null ? String(info.def) : '?');
      badges.push(info.link_arrows ? atk : `${atk}/${def}`);
    }
  } else {
    // Spell or Trap
    const typeName = localizeTerm(info.card_type, locale);
    if (info.monster_type_line) {
      // e.g. "Quick-Play" for spell property
      const prop = info.monster_type_line.trim();
      if (prop && prop !== 'Normal') {
        badges.push(`${typeName}/${localizeTerm(prop, locale)}`);
      } else {
        badges.push(typeName);
      }
    } else {
      badges.push(typeName);
    }
  }

  return badges;
}

function buildCardInfo(apiCard: any, zhName: string): CardInfo {
  return {
    password: apiCard.password,
    card_type: apiCard.card_type,
    monster_type_line: apiCard.monster_type_line,
    attribute: apiCard.attribute,
    level: apiCard.level,
    rank: apiCard.rank,
    atk: apiCard.atk,
    def: apiCard.def,
    link_arrows: apiCard.link_arrows,
    pendulum_scale: apiCard.pendulum_scale,
    name: { zh: zhName, ja: apiCard.name?.ja, en: apiCard.name?.en },
    text: apiCard.text || {},
    pendulum_effect: apiCard.pendulum_effect,
  };
}

export async function fetchCardInfoBatch(entries: { id: number; name: string }[]): Promise<void> {
  // Filter out already cached
  const toFetch = entries.filter(e => !globalCardInfoCache[e.name]);
  if (toFetch.length === 0) return;

  const ids = toFetch.map(e => e.id);
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    const cards = data.cards || {};
    for (const entry of toFetch) {
      const apiCard = cards[String(entry.id)];
      if (apiCard) {
        globalCardInfoCache[entry.name] = buildCardInfo(apiCard, entry.name);
      }
    }
  } catch (e) {
    console.error('fetchCardInfoBatch failed:', e);
  }
}

export async function fetchCardInfo(name: string, id: number): Promise<CardInfo | null> {
  if (globalCardInfoCache[name]) return globalCardInfoCache[name];

  if (pendingRequests[name]) {
    await pendingRequests[name];
    return globalCardInfoCache[name] || null;
  }

  const promise = (async () => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      const apiCard = data.cards?.[String(id)];
      if (apiCard) {
        globalCardInfoCache[name] = buildCardInfo(apiCard, name);
      }
    } catch (e) {
      console.error('fetchCardInfo failed:', e);
    }
  })();

  pendingRequests[name] = promise;
  try {
    await promise;
  } finally {
    delete pendingRequests[name];
  }
  return globalCardInfoCache[name] || null;
}

export async function fetchCardInfoByPasswords(
  passwords: string[]
): Promise<Map<string, { name: string; konamiId: number; password: number; cardInfo: CardInfo }>> {
  const result = new Map<string, { name: string; konamiId: number; password: number; cardInfo: CardInfo }>();
  if (passwords.length === 0) return result;

  const uniquePasswords = [...new Set(passwords)];
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: uniquePasswords.map(Number), id_type: 'password' }),
    });
    const data = await res.json();
    const cards = data.cards || {};
    for (const [pw, apiCard] of Object.entries(cards) as [string, any][]) {
      const konamiId = apiCard.konami_id || Number(pw);
      // We need the zh name from card_data.json, but for YDK import we use API name as fallback
      const zhName = apiCard.name?.zh || apiCard.name?.en || pw;
      const info = buildCardInfo(apiCard, zhName);
      result.set(pw, { name: zhName, konamiId, password: info.password, cardInfo: info });
    }
  } catch (e) {
    console.error('fetchCardInfoByPasswords failed:', e);
  }
  return result;
}

export function isExtraDeck(info: CardInfo | null | undefined): boolean {
  if (!info?.monster_type_line) return false;
  return /Fusion|Synchro|Xyz|Link/.test(info.monster_type_line);
}
