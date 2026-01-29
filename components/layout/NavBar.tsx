'use client';
import Link from 'next/link';
import { LMFLogo } from '@/components/branding/LMFLogo';
import { Button, Select } from '@/components/ui';
import { useScriptStore } from '@/stores/script-store';
import { useDirectorStore } from '@/stores/director-store';

interface NavBarProps {
  onSettingsClick: () => void;
  onDirectorClick: () => void;
}

export function NavBar({ onSettingsClick, onDirectorClick }: NavBarProps) {
  const { playId, setPlayId, playsConfig } = useScriptStore();
  const { isDirector, directorName } = useDirectorStore();

  const playOptions = playsConfig
    ? Object.entries(playsConfig).map(([id, play]) => ({ value: id, label: play.name }))
    : [];

  return (
    <nav className="sticky top-0 z-40 border-b border-lmf-accent bg-lmf-secondary/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <LMFLogo size="sm" />
            <span className="hidden font-display text-xl font-bold text-lmf-text sm:inline">Skript</span>
          </Link>
          {playOptions.length > 0 && (
            <Select options={playOptions} value={playId} onChange={(e) => setPlayId(e.target.value)} className="w-48" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirector && (
            <span className="rounded-full bg-lmf-primary/20 px-3 py-1 text-sm text-lmf-primary">Regie: {directorName}</span>
          )}
          <Button variant={isDirector ? 'primary' : 'secondary'} size="sm" onClick={onDirectorClick}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Regie</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onSettingsClick}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Button>
        </div>
      </div>
    </nav>
  );
}
