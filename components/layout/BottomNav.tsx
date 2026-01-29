'use client';
import { Button } from '@/components/ui';
import { useDirectorStore } from '@/stores/director-store';
import { useSettingsStore } from '@/stores/settings-store';

interface BottomNavProps {
  currentLine: number;
  totalLines: number;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToMarked: () => void;
}

export function BottomNav({ currentLine, totalLines, onPrevious, onNext, onJumpToMarked }: BottomNavProps) {
  const { markedLineIndex, isDirector } = useDirectorStore();
  const { selectedActor } = useSettingsStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-lmf-accent bg-lmf-secondary/95 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onPrevious}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Zurück</span>
          </Button>
          <span className="text-sm text-lmf-text-muted">{currentLine + 1} / {totalLines}</span>
          <Button variant="secondary" size="sm" onClick={onNext}>
            <span className="hidden sm:inline">Weiter</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedActor && (
            <span className="rounded-full bg-lmf-accent px-3 py-1 text-sm text-lmf-text">{selectedActor}</span>
          )}
          {markedLineIndex !== null && !isDirector && (
            <Button variant="primary" size="sm" onClick={onJumpToMarked}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Zur Markierung
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
