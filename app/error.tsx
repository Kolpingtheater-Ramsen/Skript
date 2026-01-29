'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-lmf-background">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-2xl font-bold text-lmf-text">Etwas ist schiefgelaufen!</h2>
        <p className="mb-6 text-lmf-text-muted">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-md bg-lmf-primary px-4 py-2 text-white hover:bg-lmf-primary-dark"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
