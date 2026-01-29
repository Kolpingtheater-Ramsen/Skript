'use client';
import { useEffect, useState } from 'react';
import { useScriptStore } from '@/stores/script-store';
import { useDirectorStore } from '@/stores/director-store';
import { fetchPlaysConfig, fetchScript } from '@/lib/api';
import { connectSocket, joinPlay } from '@/lib/socket';
import { LMFLogo } from '@/components/branding/LMFLogo';
import type { ScriptRow } from '@/types';

export default function StagePage() {
  const { playId, setPlaysConfig, setScriptData, scriptData, scenes } = useScriptStore();
  const { markedLineIndex } = useDirectorStore();
  const [currentLine, setCurrentLine] = useState<ScriptRow | null>(null);
  const [currentScene, setCurrentScene] = useState<string>('');

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

  // Update current line when marker changes
  useEffect(() => {
    if (scriptData && markedLineIndex !== null) {
      const line = scriptData[markedLineIndex];
      setCurrentLine(line);
      // Find current scene
      const scene = scenes.find(
        (s) => markedLineIndex >= s.startIndex && markedLineIndex <= s.endIndex
      );
      if (scene) setCurrentScene(scene.id);
    }
  }, [markedLineIndex, scriptData, scenes]);

  return (
    <div className="min-h-screen bg-lmf-background flex flex-col">
      {/* Header */}
      <header className="bg-lmf-secondary p-4 flex items-center justify-between border-b border-lmf-accent">
        <div className="flex items-center gap-4">
          <LMFLogo size="sm" />
          <h1 className="text-xl font-bold text-lmf-text">Bühnen-Ansicht</h1>
        </div>
        {currentScene && (
          <div className="text-lmf-primary font-display text-2xl">
            Szene {currentScene}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        {currentLine ? (
          <div className="max-w-4xl w-full text-center">
            {currentLine.Charakter && (
              <div className="mb-6">
                <span className="text-3xl font-bold text-lmf-primary">
                  {currentLine.Charakter}
                </span>
                {currentLine.Mikrofon && (
                  <span className="ml-4 text-xl text-lmf-text-muted">
                    (Mikrofon {currentLine.Mikrofon})
                  </span>
                )}
              </div>
            )}
            <p className="text-4xl md:text-5xl lg:text-6xl text-lmf-text leading-relaxed font-display">
              {currentLine['Text/Anweisung']}
            </p>
            <div className="mt-8 text-lmf-text-muted">
              Zeile {(markedLineIndex ?? 0) + 1}
            </div>
          </div>
        ) : (
          <div className="text-center text-lmf-text-muted">
            <p className="text-2xl mb-4">Warte auf Regie-Markierung...</p>
            <p className="text-lg">Die markierte Zeile wird hier groß angezeigt.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-lmf-secondary p-4 text-center text-lmf-text-muted border-t border-lmf-accent">
        Powered by LMF Theater Tools
      </footer>
    </div>
  );
}
