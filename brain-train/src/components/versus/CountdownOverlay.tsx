interface CountdownOverlayProps {
  remaining: number | null;
}

export function CountdownOverlay({ remaining }: CountdownOverlayProps) {
  if (remaining === null) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="text-8xl font-headline font-extrabold text-primary animate-pulse-ring">
        {remaining > 0 ? remaining : 'GO!'}
      </div>
    </div>
  );
}
