import { describe, it, expect, beforeEach } from 'vitest';
import { useScriptStore } from '@/stores/script-store';
import type { ScriptRow } from '@/types';

describe('script-store', () => {
  beforeEach(() => {
    // Reset store state
    useScriptStore.setState({
      playId: 'default',
      playsConfig: null,
      scriptData: null,
      actors: [],
      scenes: [],
      isLoading: false,
      error: null,
    });
  });

  it('should have default state', () => {
    const state = useScriptStore.getState();
    expect(state.playId).toBe('default');
    expect(state.scriptData).toBeNull();
    expect(state.actors).toEqual([]);
    expect(state.scenes).toEqual([]);
  });

  it('should update playId', () => {
    useScriptStore.getState().setPlayId('new-play');
    expect(useScriptStore.getState().playId).toBe('new-play');
  });

  it('should extract actors from script data', () => {
    const mockData: ScriptRow[] = [
      { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Hello' },
      { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Maria', Mikrofon: '2', 'Text/Anweisung': 'Hi' },
      { Szene: '1', Kategorie: 'Anweisung', Charakter: '', Mikrofon: '', 'Text/Anweisung': 'Pause' },
      { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Bye' },
    ];

    useScriptStore.getState().setScriptData(mockData);

    const state = useScriptStore.getState();
    expect(state.actors).toEqual(['Hans', 'Maria']);
  });

  it('should extract scenes from script data', () => {
    const mockData: ScriptRow[] = [
      { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Line 1' },
      { Szene: '1', Kategorie: 'Schauspieler', Charakter: 'Maria', Mikrofon: '2', 'Text/Anweisung': 'Line 2' },
      { Szene: '2', Kategorie: 'Schauspieler', Charakter: 'Hans', Mikrofon: '1', 'Text/Anweisung': 'Line 3' },
    ];

    useScriptStore.getState().setScriptData(mockData);

    const state = useScriptStore.getState();
    expect(state.scenes).toHaveLength(2);
    expect(state.scenes[0].id).toBe('1');
    expect(state.scenes[1].id).toBe('2');
  });

  it('should handle loading state', () => {
    useScriptStore.getState().setLoading(true);
    expect(useScriptStore.getState().isLoading).toBe(true);

    useScriptStore.getState().setLoading(false);
    expect(useScriptStore.getState().isLoading).toBe(false);
  });

  it('should handle error state', () => {
    useScriptStore.getState().setError('Test error');
    expect(useScriptStore.getState().error).toBe('Test error');

    useScriptStore.getState().setError(null);
    expect(useScriptStore.getState().error).toBeNull();
  });
});
