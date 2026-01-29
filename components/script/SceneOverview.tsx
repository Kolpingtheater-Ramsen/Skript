import type { Scene } from '@/types';

interface SceneOverviewProps {
  scene: Scene;
}

export function SceneOverview({ scene }: SceneOverviewProps) {
  const actorMics = new Map<string, string>();

  scene.lines.forEach((line) => {
    if (line.Kategorie === 'Schauspieler' && line.Charakter && line.Mikrofon) {
      actorMics.set(line.Charakter, line.Mikrofon);
    }
  });

  if (actorMics.size === 0) return null;

  return (
    <div className="mb-4 rounded-lg bg-lmf-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-lmf-text-muted">Mikrofon-Übersicht</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {Array.from(actorMics.entries()).map(([actor, mic]) => (
          <div key={actor} className="flex items-center gap-2 text-sm">
            <span className="rounded bg-lmf-accent px-1.5 py-0.5 text-xs font-mono text-lmf-text">
              M{mic}
            </span>
            <span className="text-lmf-text-muted truncate">{actor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
