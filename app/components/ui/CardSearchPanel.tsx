import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '@/app/i18n';
import { getCardImageUrl } from '../../config';

export interface SearchResult {
  cid: number;
  id: number;
  cn_name: string;
  sc_name: string;
  jp_name: string;
  en_name: string;
  md_name: string;
  text: { types: string; desc: string };
  data: { type: number; atk: number; def: number; level: number; race: number; attribute: number };
}

interface CardSearchPanelProps {
  mode: 'replace' | 'add';
  onReplace?: (result: SearchResult) => void;
  onAdd?: (result: SearchResult) => void;
  onClose: () => void;
}

export default function CardSearchPanel({ mode, onReplace, onAdd, onClose }: CardSearchPanelProps) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const cacheRef = useRef<Record<string, SearchResult[]>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setHasSearched(false); return; }
    if (cacheRef.current[q]) { setResults(cacheRef.current[q]); setHasSearched(true); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`https://ygocdb.com/api/v0/?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list: SearchResult[] = data.result || [];
      cacheRef.current[q] = list;
      setResults(list);
    } catch { setResults([]); }
    setHasSearched(true);
    setIsSearching(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const handleSelect = (r: SearchResult) => {
    if (mode === 'replace') onReplace?.(r);
    else onAdd?.(r);
  };

  const getDisplayName = (r: SearchResult) => {
    if (locale === 'ja') return r.jp_name || r.cn_name || r.sc_name;
    if (locale === 'en') return r.en_name || r.cn_name || r.sc_name;
    return r.cn_name || r.sc_name;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--card-border)] bg-gradient-card shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onClose} className="p-1.5 -ml-1 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-bold text-[var(--foreground)]">
            {mode === 'replace' ? t('sidebar.replaceCard') : t('sidebar.addCard')}
          </span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--card-border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--card-border)] border-t-[var(--primary)] animate-spin" />
            <span className="ml-2 text-sm text-[var(--foreground-muted)]">{t('sidebar.searching')}</span>
          </div>
        )}
        {!isSearching && hasSearched && results.length === 0 && (
          <p className="text-center text-sm text-[var(--foreground-muted)] py-8">{t('sidebar.noResults')}</p>
        )}
        {!isSearching && results.map(r => (
          <button
            key={r.cid}
            onClick={() => handleSelect(r)}
            className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--background-secondary)] active:bg-[var(--card-border)] transition-colors"
          >
            <img
              src={getCardImageUrl(r.id, locale)}
              alt=""
              className="w-10 h-14 rounded object-cover bg-[var(--background-secondary)] shrink-0"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--foreground)] truncate font-medium">{getDisplayName(r)}</p>
              <p className="text-xs text-[var(--foreground-muted)] truncate">{r.text?.types || ''}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
