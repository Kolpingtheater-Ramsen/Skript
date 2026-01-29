'use client';
import { useState, useEffect, useCallback } from 'react';
import { useScriptStore } from '@/stores/script-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useDirectorStore } from '@/stores/director-store';
import { fetchPlaysConfig, fetchScript } from '@/lib/api';
import { connectSocket, joinPlay } from '@/lib/socket';
import { NavBar, Sidebar, BottomNav, SettingsModal } from '@/components/layout';
import { ScriptViewer, DirectorModal } from '@/components/script';
import { Footer } from '@/components/branding';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const { playId, setPlaysConfig, setScriptData, scriptData, setLoading, setError, scenes } = useScriptStore();
  const { selectedActor } = useSettingsStore();
  const { markedLineIndex } = useDirectorStore();

  // Load plays config and connect socket on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const config = await fetchPlaysConfig();
        setPlaysConfig(config);
        connectSocket();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [setPlaysConfig, setLoading, setError]);

  // Load script when play changes
  useEffect(() => {
    async function loadScript() {
      try {
        setLoading(true);
        const data = await fetchScript(playId);
        setScriptData(data);
        joinPlay(playId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load script');
      } finally {
        setLoading(false);
      }
    }
    loadScript();
  }, [playId, setScriptData, setLoading, setError]);

  // Navigation functions
  const scrollToScene = useCallback((sceneId: string) => {
    const element = document.getElementById(`scene-${sceneId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentSceneId(sceneId);
    }
  }, []);

  const scrollToLine = useCallback((index: number) => {
    const element = document.getElementById(`line-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentLineIndex(index);
    }
  }, []);

  const jumpToMarked = useCallback(() => {
    if (markedLineIndex !== null) {
      scrollToLine(markedLineIndex);
    }
  }, [markedLineIndex, scrollToLine]);

  const navigatePrevious = useCallback(() => {
    if (!scriptData) return;
    const newIndex = Math.max(0, currentLineIndex - 1);
    scrollToLine(newIndex);
  }, [scriptData, currentLineIndex, scrollToLine]);

  const navigateNext = useCallback(() => {
    if (!scriptData) return;
    const newIndex = Math.min(scriptData.length - 1, currentLineIndex + 1);
    scrollToLine(newIndex);
  }, [scriptData, currentLineIndex, scrollToLine]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePrevious, navigateNext]);

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar
        onSettingsClick={() => setSettingsOpen(true)}
        onDirectorClick={() => setDirectorOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentSceneId={currentSceneId}
          onSceneClick={scrollToScene}
        />

        <main className="flex-1 px-4 py-6 pb-20 lg:ml-64">
          <div className="container mx-auto max-w-4xl">
            <ScriptViewer />
          </div>
        </main>
      </div>

      <BottomNav
        currentLine={currentLineIndex}
        totalLines={scriptData?.length || 0}
        onPrevious={navigatePrevious}
        onNext={navigateNext}
        onJumpToMarked={jumpToMarked}
      />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DirectorModal isOpen={directorOpen} onClose={() => setDirectorOpen(false)} />
    </div>
  );
}
