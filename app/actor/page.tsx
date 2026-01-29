'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useScriptStore } from '@/stores/script-store';
import { useDirectorStore } from '@/stores/director-store';
import { fetchPlaysConfig, fetchScript } from '@/lib/api';
import { connectSocket, joinPlay } from '@/lib/socket';
import { LMFLogo } from '@/components/branding/LMFLogo';
import { Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ScriptRow } from '@/types';

export default function ActorPage() {
  const searchParams = useSearchParams();
  const initialActor = searchParams.get('actor') || '';

  const { playId, setPlaysConfig, setScriptData, scriptData, actors } = useScriptStore();
  const { markedLineIndex } = useDirectorStore();
  const [selectedActor, setSelectedActor] = useState(initialActor);

  // Initialize
  useEffect(() => {
    async function init() {
      const config = await fetchPlaysConfig();
      setPlaysConfig(config);
      connectSocket();
    }
    init();
  }, [setPlaysConfig]);

  // Load script
  useEffect(() => {
    async function loadScript() {
      const data = await fetchScript(playId);
      setScriptData(data);
      joinPlay(playId);
    }
    loadScript();
  }, [playId, setScriptData]);

  // Set initial actor if provided via URL
  useEffect(() => {
    if (initialActor && actors.includes(initialActor)) {
      setSelectedActor(initialActor);
    }
  }, [initialActor, actors]);

  // Filter lines for selected actor
  const actorLines = useMemo(() => {
    if (!scriptData || !selectedActor) return [];
    return scriptData
      .map((row, index) => ({ ...row, _index: index }))
      .filter((row) => row.Charakter === selectedActor);
  }, [scriptData, selectedActor]);

  // Find current/next line for actor
  const currentActorLineIndex = useMemo(() => {
    if (markedLineIndex === null || actorLines.length === 0) return -1;
    return actorLines.findIndex((line) => (line._index ?? 0) >= markedLineIndex);
  }, [actorLines, markedLineIndex]);

  const actorOptions = actors.map((actor) => ({ value: actor, label: actor }));

  return (
    <div className="min-h-screen bg-lmf-background flex flex-col">
      {/* Header */}
      <header className="bg-lmf-secondary p-4 border-b border-lmf-accent">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LMFLogo size="sm" />
            <h1 className="text-xl font-bold text-lmf-text">Schauspieler-Ansicht</h1>
          </div>
          <Select
            options={actorOptions}
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            placeholder="Rolle auswählen..."
            className="w-48"
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 pb-20 overflow-y-auto">
        <div className="container mx-auto max-w-2xl">
          {selectedActor ? (
            <div className="space-y-4">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-display font-bold text-lmf-primary">
                  {selectedActor}
                </h2>
                <p className="text-lmf-text-muted">
                  {actorLines.length} Einsätze
                </p>
              </div>

              {actorLines.map((line, idx) => {
                const isNext = idx === currentActorLineIndex;
                const isPast = idx < currentActorLineIndex;

                return (
                  <div
                    key={line._index}
                    id={`actor-line-${line._index}`}
                    className={cn(
                      'p-4 rounded-lg transition-all',
                      isNext && 'bg-lmf-primary/20 border-2 border-lmf-primary scale-105',
                      isPast && 'opacity-50',
                      !isNext && !isPast && 'bg-lmf-surface'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-lmf-text-muted font-mono">
                        #{(line._index ?? 0) + 1}
                      </span>
                      {line.Mikrofon && (
                        <span className="text-xs px-2 py-0.5 rounded bg-lmf-accent text-lmf-text-muted">
                          M{line.Mikrofon}
                        </span>
                      )}
                      {isNext && (
                        <span className="text-xs px-2 py-0.5 rounded bg-lmf-primary text-white">
                          JETZT
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-lg',
                      isNext ? 'text-lmf-text font-semibold text-xl' : 'text-lmf-text-muted'
                    )}>
                      {line['Text/Anweisung']}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-2xl text-lmf-text-muted mb-4">
                Bitte wähle deine Rolle aus
              </p>
              <p className="text-lmf-text-muted">
                Du siehst dann nur deine Einsätze.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-lmf-secondary p-4 border-t border-lmf-accent">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <span className="text-lmf-text-muted">
            {selectedActor && currentActorLineIndex >= 0 && (
              <>Einsatz {currentActorLineIndex + 1} von {actorLines.length}</>
            )}
          </span>
          <span className="text-lmf-text-muted">
            Powered by LMF
          </span>
        </div>
      </footer>
    </div>
  );
}
