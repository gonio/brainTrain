import { Info } from 'lucide-react';

interface GameInstructionsProps {
  title: string;
  description: string;
  steps: string[];
  className?: string;
}

export function GameInstructions({ title, description, steps, className }: GameInstructionsProps) {
  return (
    <div className={`bg-surface-container/50 rounded-xl p-3 text-xs text-muted-foreground ${className}`}>
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary/70" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title}</p>
          <p>{description}</p>
          <ol className="list-decimal list-inside space-y-0.5 pl-1">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
