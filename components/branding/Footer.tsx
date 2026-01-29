import { LMFLogo } from './LMFLogo';

export function Footer() {
  return (
    <footer className="border-t border-lmf-accent bg-lmf-secondary py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <LMFLogo size="sm" />
            <span className="text-sm text-lmf-text-muted">Powered by LMF Theater Tools</span>
          </div>
          <div className="text-sm text-lmf-text-muted">© {new Date().getFullYear()} Kolpingtheater Ramsen</div>
        </div>
      </div>
    </footer>
  );
}
