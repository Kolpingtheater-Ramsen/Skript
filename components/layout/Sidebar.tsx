'use client';
import { useScriptStore } from '@/stores/script-store';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSceneId: string | null;
  onSceneClick: (sceneId: string) => void;
}

export function Sidebar({ isOpen, onClose, currentSceneId, onSceneClick }: SidebarProps) {
  const { scenes } = useScriptStore();

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 bg-lmf-secondary',
        'transform transition-transform duration-300 ease-in-out border-r border-lmf-accent overflow-y-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:block'
      )}>
        <div className="p-4">
          <h2 className="mb-4 font-display text-lg font-semibold text-lmf-text">Inhaltsverzeichnis</h2>
          <nav className="space-y-1">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => { onSceneClick(scene.id); onClose(); }}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                  currentSceneId === scene.id
                    ? 'bg-lmf-primary text-white'
                    : 'text-lmf-text-muted hover:bg-lmf-accent hover:text-lmf-text'
                )}
              >
                Szene {scene.id}
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
