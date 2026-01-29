'use client';
import { Modal, Button, Select, Checkbox, Slider } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings-store';
import { useScriptStore } from '@/stores/script-store';
import type { CategoryFilter } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const filterLabels: Record<CategoryFilter, string> = {
  actor: 'Schauspieler',
  instruction: 'Anweisungen',
  technical: 'Technik',
  lighting: 'Licht',
  audio: 'Ton',
  props: 'Requisite',
  microphone: 'Mikrofon',
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { actors } = useScriptStore();
  const { theme, setTheme, selectedActor, setSelectedActor, autoScroll, setAutoScroll, lineBlur, setLineBlur, fontSize, setFontSize, filters, setFilter, resetSettings } = useSettingsStore();

  const actorOptions = [{ value: '', label: 'Alle Rollen' }, ...actors.map((actor) => ({ value: actor, label: actor }))];
  const themeOptions = [{ value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }, { value: 'pink', label: 'Pink' }];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Einstellungen">
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-lmf-text">Farbschema</label>
          <Select options={themeOptions} value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'pink')} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-lmf-text">Rolle auswählen</label>
          <Select options={actorOptions} value={selectedActor || ''} onChange={(e) => setSelectedActor(e.target.value || null)} />
        </div>
        <Slider label="Schriftgröße" showValue min={12} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
        <div className="space-y-3">
          <Checkbox id="autoScroll" label="Auto-Scroll zur Markierung" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          <Checkbox id="lineBlur" label="Zeilen-Blur (Übungsmodus)" checked={lineBlur} onChange={(e) => setLineBlur(e.target.checked)} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-lmf-text">Kategorien anzeigen</label>
          <div className="space-y-2">
            {(Object.keys(filters) as CategoryFilter[]).map((filter) => (
              <Checkbox key={filter} id={`filter-${filter}`} label={filterLabels[filter]} checked={filters[filter].enabled} onChange={(e) => setFilter(filter, { enabled: e.target.checked })} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-lmf-accent">
          <Button variant="secondary" onClick={resetSettings}>Zurücksetzen</Button>
          <Button variant="primary" onClick={onClose}>Schließen</Button>
        </div>
      </div>
    </Modal>
  );
}
