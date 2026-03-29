type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  disabled?: boolean;
}

const difficulties: { value: Difficulty; label: string; description: string }[] = [
  {
    value: 'easy',
    label: '简单',
    description: '适合初学者'
  },
  {
    value: 'medium',
    label: '中等',
    description: '有一定挑战性'
  },
  {
    value: 'hard',
    label: '困难',
    description: '高难度挑战'
  }
];

export function DifficultySelector({ value, onChange, disabled }: DifficultySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">难度选择</label>
      <div className="flex gap-2">
        {difficulties.map((diff) => (
          <button
            key={diff.value}
            onClick={() => onChange(diff.value)}
            disabled={disabled}
            className={`
              flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all
              ${value === diff.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-accent'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={diff.description}
          >
            {diff.label}
          </button>
        ))}
      </div>
    </div>
  );
}
