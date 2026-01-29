'use client';
import { useMemo } from 'react';
import { useScriptStore } from '@/stores/script-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useDirectorStore } from '@/stores/director-store';
import { setMarker } from '@/lib/socket';
import { isLineVisible } from '@/lib/utils';
import { ScriptLine } from './ScriptLine';
import { SceneHeader } from './SceneHeader';
import { SceneOverview } from './SceneOverview';

export function ScriptViewer() {
  const { playId, scriptData, scenes } = useScriptStore();
  const { filters, selectedActor, lineBlur, fontSize } = useSettingsStore();
  const { isDirector } = useDirectorStore();

  const handleLineClick = (index: number) => {
    if (isDirector) {
      setMarker(index, playId);
    }
  };

  const visibleScenes = useMemo(() => {
    if (!scriptData) return [];

    return scenes.map((scene) => ({
      ...scene,
      visibleLines: scene.lines.filter((line) =>
        isLineVisible(line, filters, selectedActor)
      ),
    })).filter((scene) => scene.visibleLines.length > 0);
  }, [scenes, scriptData, filters, selectedActor]);

  if (!scriptData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-lmf-text-muted">Lade Skript...</p>
      </div>
    );
  }

  return (
    <div
      className={lineBlur ? 'line-blur' : ''}
      style={{ fontSize: `${fontSize}px` }}
    >
      {visibleScenes.map((scene) => (
        <section key={scene.id} className="mb-8">
          <SceneHeader sceneId={scene.id} sceneName={scene.name} />
          <SceneOverview scene={scene} />
          <div className="space-y-1">
            {scene.visibleLines.map((line) => (
              <ScriptLine
                key={line._index}
                row={line}
                index={line._index!}
                onClick={() => handleLineClick(line._index!)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
