export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-lmf-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-lmf-primary border-t-transparent" />
        <p className="text-lmf-text-muted">Lade...</p>
      </div>
    </div>
  );
}
