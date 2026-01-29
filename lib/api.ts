import Papa from 'papaparse';
import type { ScriptRow, PlaysConfig } from '@/types';
import { storage } from './utils';

const CACHE_DURATION = 5 * 60 * 1000;

interface CacheEntry<T> { data: T; timestamp: number; }

function getCached<T>(key: string): T | null {
  const entry = storage.get<CacheEntry<T> | null>(key, null);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    storage.remove(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  storage.set<CacheEntry<T>>(key, { data, timestamp: Date.now() });
}

export async function fetchPlaysConfig(): Promise<PlaysConfig> {
  const cached = getCached<PlaysConfig>('plays-config');
  if (cached) return cached;
  const response = await fetch('/api/plays');
  if (!response.ok) throw new Error('Failed to fetch plays configuration');
  const data = await response.json();
  setCache('plays-config', data);
  return data;
}

export async function fetchScript(playId: string): Promise<ScriptRow[]> {
  const cacheKey = `script-${playId}`;
  const cached = getCached<ScriptRow[]>(cacheKey);
  if (cached) return cached;
  const response = await fetch(`/api/script/${playId}`);
  if (!response.ok) throw new Error(`Failed to fetch script for play: ${playId}`);
  const csvText = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse<ScriptRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map((row, index) => ({ ...row, _index: index }));
        setCache(cacheKey, data);
        resolve(data);
      },
      error: (error: Error) => reject(new Error(`Failed to parse script CSV: ${error.message}`)),
    });
  });
}

export async function fetchScriptDirect(sheetUrl: string): Promise<ScriptRow[]> {
  const response = await fetch(sheetUrl);
  if (!response.ok) throw new Error('Failed to fetch script from Google Sheets');
  const csvText = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse<ScriptRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map((row, index) => ({ ...row, _index: index }));
        resolve(data);
      },
      error: (error: Error) => reject(new Error(`Failed to parse script CSV: ${error.message}`)),
    });
  });
}
