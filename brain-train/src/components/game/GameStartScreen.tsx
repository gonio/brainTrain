import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../../stores/settingsStore';
import { gameplayInstructionsMap } from '../../lib/gameplayInstructions';
import { GameInstructionsDialog } from './GameInstructions';
import { Button } from '../ui/button';
import type { TrainingMode } from '../../types';

interface GameStartScreenProps {
  mode: TrainingMode;
  title: string;
  description: string;
  onStart: () => void;
}

export function GameStartScreen({ mode, title, description, onStart }: GameStartScreenProps) {
  const { isRuleDismissed } = useSettingsStore();
  const [rulesOpen, setRulesOpen] = useState(false);

  const config = gameplayInstructionsMap[mode];

  // 首次进入自动弹出规则
  useEffect(() => {
    if (!isRuleDismissed(mode)) {
      setRulesOpen(true);
    }
  }, [mode, isRuleDismissed]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      {/* 游戏图标和标题 */}
      <div className="text-center mb-8">
        <h2 className="font-headline text-2xl font-extrabold mb-2">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {/* 展示规则按钮 */}
      <Button
        variant="ghost"
        onClick={() => setRulesOpen(true)}
        className="mb-4 text-muted-foreground"
      >
        <span className="material-symbols-outlined mr-1.5 text-lg">help_outline</span>
        展示规则
      </Button>

      {/* 开始训练按钮 */}
      <Button
        onClick={onStart}
        size="lg"
        className="px-12 py-6 text-lg font-bold rounded-2xl"
      >
        开始训练
      </Button>

      {/* 规则弹窗 */}
      {config && (
        <GameInstructionsDialog
          config={config}
          open={rulesOpen}
          onOpenChange={setRulesOpen}
        />
      )}
    </motion.div>
  );
}
