'use client';
import { useState } from 'react';
import { Modal, Button } from '@/components/ui';
import { useDirectorStore } from '@/stores/director-store';
import { useScriptStore } from '@/stores/script-store';
import { setDirector, unsetDirector } from '@/lib/socket';

interface DirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DirectorModal({ isOpen, onClose }: DirectorModalProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { isDirector, directorName } = useDirectorStore();
  const { playId } = useScriptStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !password.trim()) {
      setError('Bitte Name und Passwort eingeben');
      return;
    }

    setDirector(name.trim(), password, playId);
    onClose();
  };

  const handleRelease = () => {
    unsetDirector(playId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Regie-Modus">
      {isDirector ? (
        <div className="space-y-4">
          <p className="text-lmf-text">
            Du bist als <strong className="text-lmf-primary">{directorName}</strong> eingeloggt.
          </p>
          <p className="text-sm text-lmf-text-muted">
            Als Regisseur kannst du Zeilen markieren, die für alle Teilnehmer sichtbar sind.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleRelease}>Regie abgeben</Button>
            <Button variant="secondary" onClick={onClose}>Schließen</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-lmf-text">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
              className="w-full rounded-md border border-lmf-text-muted bg-lmf-surface px-3 py-2 text-lmf-text focus:outline-none focus:ring-2 focus:ring-lmf-primary"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-lmf-text">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Regie-Passwort"
              className="w-full rounded-md border border-lmf-text-muted bg-lmf-surface px-3 py-2 text-lmf-text focus:outline-none focus:ring-2 focus:ring-lmf-primary"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary">Regie übernehmen</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
