'use client';
import { useRef, useEffect } from 'react';
import { cn, getCategoryClass, formatLineNumber } from '@/lib/utils';
import { useDirectorStore } from '@/stores/director-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ScriptRow } from '@/types';

interface ScriptLineProps {
  row: ScriptRow;
  index: number;
  onClick?: () => void;
}

export function ScriptLine({ row, index, onClick }: ScriptLineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { markedLineIndex, isDirector } = useDirectorStore();
  const { selectedActor, autoScroll } = useSettingsStore();

  const isMarked = markedLineIndex === index;
  const isSelectedActor = selectedActor && row.Charakter === selectedActor;

  useEffect(() => {
    if (isMarked && autoScroll && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isMarked, autoScroll]);

  return (
    <div
      ref={ref}
      id={`line-${index}`}
      onClick={onClick}
      className={cn(
        'script-line',
        getCategoryClass(row.Kategorie),
        isMarked && 'marked',
        isSelectedActor && 'selected-actor',
        isDirector && 'cursor-pointer hover:bg-lmf-accent/30'
      )}
    >
      <div className="flex gap-4">
        <span className="text-xs text-lmf-text-muted font-mono w-8 shrink-0">
          {formatLineNumber(index)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {row.Charakter && (
              <span className={cn('font-semibold', isSelectedActor ? 'text-lmf-primary' : 'text-lmf-text')}>
                {row.Charakter}
              </span>
            )}
            {row.Mikrofon && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-lmf-accent text-lmf-text-muted">
                M{row.Mikrofon}
              </span>
            )}
          </div>
          <p className="line-text text-lmf-text mt-1">
            {row['Text/Anweisung']}
          </p>
        </div>
      </div>
    </div>
  );
}
