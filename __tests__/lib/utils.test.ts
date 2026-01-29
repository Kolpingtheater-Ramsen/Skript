import { describe, it, expect } from 'vitest';
import { cn, getCategoryFilter, getCategoryClass, formatLineNumber, isLineVisible } from '@/lib/utils';
import type { ScriptRow, CategoryFilter, FilterState } from '@/types';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });
  });

  describe('getCategoryFilter', () => {
    it('should map German categories to filters', () => {
      expect(getCategoryFilter('Schauspieler')).toBe('actor');
      expect(getCategoryFilter('Anweisung')).toBe('instruction');
      expect(getCategoryFilter('Technik')).toBe('technical');
      expect(getCategoryFilter('Licht')).toBe('lighting');
      expect(getCategoryFilter('Ton')).toBe('audio');
      expect(getCategoryFilter('Requisite')).toBe('props');
      expect(getCategoryFilter('Mikrofon')).toBe('microphone');
    });

    it('should return instruction for unknown categories', () => {
      expect(getCategoryFilter('Unknown')).toBe('instruction');
    });
  });

  describe('getCategoryClass', () => {
    it('should return CSS class for category', () => {
      expect(getCategoryClass('Schauspieler')).toBe('category-actor');
      expect(getCategoryClass('Licht')).toBe('category-lighting');
    });
  });

  describe('formatLineNumber', () => {
    it('should format line numbers with padding', () => {
      expect(formatLineNumber(0)).toBe('001');
      expect(formatLineNumber(9)).toBe('010');
      expect(formatLineNumber(99)).toBe('100');
      expect(formatLineNumber(999)).toBe('1000');
    });
  });

  describe('isLineVisible', () => {
    const createFilters = (overrides: Partial<Record<CategoryFilter, { enabled: boolean }>> = {}) => {
      const base: Record<CategoryFilter, FilterState> = {
        actor: { filter: 'actor', enabled: true, contextLines: 0 },
        instruction: { filter: 'instruction', enabled: true, contextLines: 0 },
        technical: { filter: 'technical', enabled: false, contextLines: 0 },
        lighting: { filter: 'lighting', enabled: false, contextLines: 0 },
        audio: { filter: 'audio', enabled: false, contextLines: 0 },
        props: { filter: 'props', enabled: false, contextLines: 0 },
        microphone: { filter: 'microphone', enabled: false, contextLines: 0 },
      };
      return { ...base, ...overrides };
    };

    it('should show lines when category is enabled', () => {
      const row: ScriptRow = { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Hello' };
      expect(isLineVisible(row, createFilters(), null)).toBe(true);
    });

    it('should hide lines when category is disabled', () => {
      const row: ScriptRow = { Szene: '1', Kategorie: 'Technik', Charakter: '', Mikrofon: '', 'Text/Anweisung': 'Sound cue' };
      expect(isLineVisible(row, createFilters(), null)).toBe(false);
    });

    it('should filter by selected actor', () => {
      const row: ScriptRow = { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Hello' };
      expect(isLineVisible(row, createFilters(), 'Hans')).toBe(true);
      expect(isLineVisible(row, createFilters(), 'Maria')).toBe(false);
    });
  });
});
