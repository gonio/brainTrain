import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useSettingsStore } from '../../stores/settingsStore';
import type { GameplayInstructionsConfig } from '../../lib/gameplayInstructions';

interface GameInstructionsDialogProps {
  config: GameplayInstructionsConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GameInstructionsDialog({ config, open, onOpenChange }: GameInstructionsDialogProps) {
  const { dismissRule } = useSettingsStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      dismissRule(config.mode);
    }
    onOpenChange(false);
  };

  // 每次打开弹窗重置勾选状态
  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.title} - 游戏规则</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 目标 */}
          <div>
            <h4 className="text-sm font-semibold mb-1">训练目标</h4>
            <p className="text-sm text-muted-foreground">{config.objective}</p>
          </div>

          {/* 玩法步骤 */}
          <div>
            <h4 className="text-sm font-semibold mb-1">玩法说明</h4>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              {config.howToPlay.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {/* 评分规则 */}
          <div>
            <h4 className="text-sm font-semibold mb-1">评分规则</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {config.scoringRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">·</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 不再提示 + 关闭 */}
        <div className="border-t pt-3 mt-2 space-y-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-border"
            />
            不再提示
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
