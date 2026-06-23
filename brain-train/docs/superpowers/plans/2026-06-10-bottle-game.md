# 暗瓶排列 Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 BrainTrain 中新增"暗瓶排列"隐藏推理训练游戏

**Architecture:** 两层架构：Bottle.tsx 页面编排器管理游戏生命周期和计分，BottleGame.tsx 核心组件处理游戏逻辑和渲染。完全遵循现有 Schulte/Stroop/Sequence 的模式。

**Tech Stack:** React 19, TypeScript, Framer Motion, Tailwind CSS 4, Zustand (复用现有 store)

---

## File Structure

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 修改 | `src/types/index.ts` | 新增 `bottle` 模式和 `BottleDetails` 类型 |
| 修改 | `src/lib/gameplayInstructions.ts` | 新增暗瓶排列规则说明 |
| 新建 | `src/components/game/BottleGame.tsx` | 核心游戏组件：瓶子渲染、交换逻辑、匹配检测 |
| 新建 | `src/pages/games/Bottle.tsx` | 页面编排器：难度选择、生命周期、计分 |
| 修改 | `src/App.tsx` | 注册游戏条目和路由 |
| 修改 | `src/components/layout/AppLayout.tsx` | GAME_PATHS 新增路径 |
| 修改 | `src/components/game/GameCard.tsx` | 新增图标/颜色映射 |
| 修改 | `src/components/game/index.ts` | 导出新组件 |

---

## Task 1: 新增类型定义和规则说明

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/gameplayInstructions.ts`

- [ ] **Step 1: 更新 TrainingMode 联合类型和新增 BottleDetails**

在 `src/types/index.ts` 中：

将 `TrainingMode` 更新为：
```ts
export type TrainingMode =
  | 'schulte'   // 舒尔特表
  | 'stroop'    // 字色干扰
  | 'sequence'  // 序列记忆
  | 'bottle';   // 暗瓶排列
```

在 `SequenceDetails` 接口之后新增：
```ts
export interface BottleDetails {
  difficulty: 'easy' | 'medium' | 'hard';
  bottleCount: number;           // 4 | 6 | 9
  targetSequence: string[];      // 下排颜色 ID 数组（隐藏答案）
  playerSequence: string[];      // 上排颜色 ID 数组（玩家最终排列）
  totalSwaps: number;            // 总交换步数
  optimalSwaps: number;          // 最优步数
  completionTime: number;        // 完成用时（秒）
}
```

更新 `TrainingDetails` 联合类型为：
```ts
export type TrainingDetails = SchulteDetails | StroopDetails | SequenceDetails | BottleDetails;
```

- [ ] **Step 2: 新增暗瓶排列规则说明**

在 `src/lib/gameplayInstructions.ts` 中：

更新顶部 `TrainingMode` 类型定义：
```ts
type TrainingMode = 'schulte' | 'stroop' | 'sequence' | 'bottle';
```

在 `sequenceInstructions` 之后、`gameplayInstructionsMap` 之前新增：
```ts
export const bottleInstructions: GameplayInstructionsConfig = {
  mode: 'bottle',
  title: '暗瓶排列',
  description: '隐藏推理训练 - 培养逻辑推理和排除法思维能力',
  objective: '通过交换上排瓶子的位置，使上排与隐藏的下排完全匹配，训练逻辑推理能力。',
  howToPlay: [
    '屏幕上有两排瓶子，上排可见，下排隐藏（看不到颜色）',
    '两排瓶子的颜色集合相同，但排列顺序被随机打乱',
    '点击选中两个上排瓶子即可交换它们的位置（也支持拖拽交换）',
    '每次交换后，系统显示当前上排与下排匹配的瓶子数量',
    '当所有位置都匹配时，游戏胜利！',
  ],
  scoringRules: [
    '满分 100 分',
    '步数占 70%：越接近最优步数得分越高',
    '速度占 30%：用时越短得分越高',
    '无步数上限，可以自由尝试',
  ],
  hardModeNote: '9 个瓶子，颜色更多，推理难度更大。',
};
```

在 `gameplayInstructionsMap` 中新增条目：
```ts
bottle: bottleInstructions,
```

- [ ] **Step 3: 提交**

```bash
git add src/types/index.ts src/lib/gameplayInstructions.ts
git commit -m "🏷️ 新增暗瓶排列类型定义和规则说明"
```

---

## Task 2: 创建核心游戏组件 BottleGame.tsx

**Files:**
- Create: `src/components/game/BottleGame.tsx`

- [ ] **Step 1: 创建 BottleGame 组件**

创建 `src/components/game/BottleGame.tsx`，完整代码如下：

```tsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// 瓶子颜色定义 - 渐变玻璃质感
const BOTTLE_COLORS = [
  { id: 'red', gradient: 'linear-gradient(135deg, #fca5a5 0%, #dc2626 100%)', label: '红' },
  { id: 'blue', gradient: 'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)', label: '蓝' },
  { id: 'green', gradient: 'linear-gradient(135deg, #86efac 0%, #16a34a 100%)', label: '绿' },
  { id: 'yellow', gradient: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)', label: '黄' },
  { id: 'purple', gradient: 'linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)', label: '紫' },
  { id: 'orange', gradient: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)', label: '橙' },
  { id: 'cyan', gradient: 'linear-gradient(135deg, #67e8f9 0%, #0891b2 100%)', label: '青' },
  { id: 'pink', gradient: 'linear-gradient(135deg, #f9a8d4 0%, #db2777 100%)', label: '粉' },
  { id: 'brown', gradient: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)', label: '棕' },
];

const COLOR_MAP = Object.fromEntries(BOTTLE_COLORS.map(c => [c.id, c]));

// Fisher-Yates 洗牌
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 计算匹配数
function countMatches(target: string[], player: string[]): number {
  return target.reduce((acc, color, i) => acc + (color === player[i] ? 1 : 0), 0);
}

// 计算最优交换次数（n - 环数）
function computeOptimalSwaps(target: string[], player: string[]): number {
  const n = target.length;
  const targetPos = new Map<string, number>();
  target.forEach((color, i) => targetPos.set(color, i));

  const perm = player.map(color => targetPos.get(color)!);
  const visited = new Set<number>();
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    let j = i;
    while (!visited.has(j)) {
      visited.add(j);
      j = perm[j];
    }
    cycles++;
  }
  return n - cycles;
}

interface BottleGameProps {
  bottleCount: number;
  isActive: boolean;
  startTime: number;
  onSwap: (matchCount: number) => void;
  onComplete: (totalSwaps: number, optimalSwaps: number, targetSeq: string[], playerSeq: string[]) => void;
}

export function BottleGame({ bottleCount, isActive, startTime, onSwap, onComplete }: BottleGameProps) {
  const [playerSequence, setPlayerSequence] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const swapCountRef = useRef(0);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 生成目标序列和初始玩家序列
  const { target, initialPlayer, optimal } = useMemo(() => {
    const selectedColors = BOTTLE_COLORS.slice(0, bottleCount).map(c => c.id);
    const targetSeq = shuffle(selectedColors);
    let playerSeq = shuffle(selectedColors);
    // 确保初始状态不是全部匹配
    while (countMatches(targetSeq, playerSeq) === bottleCount) {
      playerSeq = shuffle(playerSeq);
    }
    return {
      target: targetSeq,
      initialPlayer: playerSeq,
      optimal: computeOptimalSwaps(targetSeq, playerSeq),
    };
  }, [startTime, bottleCount]);

  // 重置状态
  useEffect(() => {
    setPlayerSequence(initialPlayer);
    setMatchCount(countMatches(target, initialPlayer));
    swapCountRef.current = 0;
    setSelectedIndex(null);
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 交换两个位置的瓶子
  const swapBottles = useCallback((indexA: number, indexB: number) => {
    if (indexA === indexB) return;

    setPlayerSequence(prev => {
      const next = [...prev];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];

      const matches = countMatches(target, next);
      setMatchCount(matches);
      swapCountRef.current += 1;
      onSwap(matches);

      if (matches === bottleCount) {
        const swaps = swapCountRef.current;
        setTimeout(() => {
          onComplete(swaps, optimal, target, next);
        }, 400);
      }

      return next;
    });
    setSelectedIndex(null);
  }, [target, bottleCount, optimal, onSwap, onComplete]);

  // 点选交换
  const handleTap = useCallback((index: number) => {
    if (!isActive) return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      swapBottles(selectedIndex, index);
    }
  }, [isActive, selectedIndex, swapBottles]);

  // 拖拽结束 - 查找目标位置
  const handleDragEnd = useCallback((dragIndex: number, info: { point: { x: number; y: number } }) => {
    const { x, y } = info.point;
    let targetSlot: number | null = null;
    for (let i = 0; i < slotRefs.current.length; i++) {
      if (i === dragIndex) continue;
      const rect = slotRefs.current[i]?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        targetSlot = i;
        break;
      }
    }
    if (targetSlot !== null) {
      swapBottles(dragIndex, targetSlot);
    }
  }, [swapBottles]);

  // 根据瓶子数量计算尺寸
  const bottleWidth = bottleCount <= 4 ? 56 : bottleCount <= 6 ? 44 : 36;
  const bottleHeight = bottleCount <= 4 ? 72 : bottleCount <= 6 ? 56 : 44;
  const gap = bottleCount <= 4 ? 12 : bottleCount <= 6 ? 8 : 6;

  if (playerSequence.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* 匹配计数 */}
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1 block">
          匹配
        </span>
        <span className="text-3xl font-black font-headline text-primary">
          {matchCount}<span className="text-lg text-muted-foreground">/{bottleCount}</span>
        </span>
      </div>

      {/* 上排 - 可见瓶子（玩家操作） */}
      <div className="flex justify-center items-end" style={{ gap }}>
        {playerSequence.map((colorId, index) => (
          <div
            key={`slot-${index}`}
            ref={el => { slotRefs.current[index] = el; }}
            className="flex items-center justify-center"
            style={{ width: bottleWidth, height: bottleHeight + 8 }}
          >
            <motion.div
              layout
              layoutId={`bottle-${colorId}-${startTime}`}
              drag={isActive}
              dragMomentum={false}
              dragElastic={0.1}
              whileDrag={{ scale: 1.1, zIndex: 50 }}
              onDragEnd={(_, info) => handleDragEnd(index, info)}
              onClick={() => handleTap(index)}
              className={`
                relative rounded-2xl overflow-hidden shadow-lg cursor-pointer select-none
                transition-shadow duration-200
                ${selectedIndex === index ? 'ring-3 ring-primary shadow-primary/30' : ''}
              `}
              style={{
                width: bottleWidth,
                height: bottleHeight,
                background: COLOR_MAP[colorId]?.gradient,
              }}
            >
              {/* 高光效果 */}
              <div
                className="absolute bg-white/25 rounded-full -rotate-12 pointer-events-none"
                style={{
                  top: bottleCount <= 4 ? 6 : 4,
                  left: bottleCount <= 4 ? 6 : 3,
                  width: bottleCount <= 4 ? 10 : 7,
                  height: bottleCount <= 4 ? 24 : 16,
                }}
              />
              {/* 瓶口 */}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-t-md bg-white/20"
                style={{
                  top: -3,
                  width: bottleCount <= 4 ? 16 : 12,
                  height: bottleCount <= 4 ? 8 : 6,
                }}
              />
            </motion.div>
          </div>
        ))}
      </div>

      {/* 下排 - 隐藏瓶子 */}
      <div className="flex justify-center items-start" style={{ gap }}>
        {target.map((_, index) => (
          <div
            key={`hidden-${index}`}
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: bottleWidth,
              height: bottleHeight,
              background: 'linear-gradient(135deg, rgba(148,163,184,0.15) 0%, rgba(71,85,105,0.25) 100%)',
              border: '1px dashed rgba(148,163,184,0.3)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-slate-400/30" style={{ fontSize: bottleCount <= 4 ? 20 : 14 }}>?</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `cd D:/BrainTrain/brain-train && npx tsc --noEmit 2>&1 | head -20`
Expected: 可能因未导出而报错，但组件本身不应有类型错误

- [ ] **Step 3: 提交**

```bash
git add src/components/game/BottleGame.tsx
git commit -m "✨ 新增暗瓶排列核心游戏组件"
```

---

## Task 3: 创建页面编排器 Bottle.tsx

**Files:**
- Create: `src/pages/games/Bottle.tsx`

- [ ] **Step 1: 创建 Bottle 页面编排器**

创建 `src/pages/games/Bottle.tsx`，完整代码如下：

```tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAudio } from '../../hooks/useAudio';
import { BottleGame } from '../../components/game/BottleGame';
import { ScoreBoard } from '../../components/game/ScoreBoard';
import { GameControlBar } from '../../components/game/GameControlBar';
import { GameStartScreen } from '../../components/game/GameStartScreen';
import { DifficultySelector } from '../../components/game/DifficultySelector';
import type { TrainingDetails } from '../../types';

const DIFFICULTY_CONFIG = {
  easy: { count: 4, label: '简单' },
  medium: { count: 6, label: '中等' },
  hard: { count: 9, label: '困难' },
} as const;

type Difficulty = keyof typeof DIFFICULTY_CONFIG;

// 基准时间（秒）和惩罚系数按难度设定
const SCORING_CONFIG: Record<Difficulty, { baselineTime: number; stepPenalty: number; timeDecay: number }> = {
  easy:   { baselineTime: 30,  stepPenalty: 15, timeDecay: 1.0 },
  medium: { baselineTime: 60,  stepPenalty: 10, timeDecay: 0.5 },
  hard:   { baselineTime: 120, stepPenalty: 8,  timeDecay: 0.3 },
};

export function Bottle() {
  const { startGame, endGame, status } = useGameStore();
  const { soundEnabled } = useSettingsStore();
  const { playEffect } = useAudio();

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameStartTime, setGameStartTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalSwaps, setTotalSwaps] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [lastOptimalSwaps, setLastOptimalSwaps] = useState(0);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  // 计时器
  useEffect(() => {
    if (!isPlaying || gameStartTime === 0) return;
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - gameStartTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, gameStartTime]);

  const handleStart = useCallback(() => {
    startGame('bottle');
    setGameStartTime(Date.now());
    setElapsedTime(0);
    setTotalSwaps(0);
    setShowResult(false);
    setFinalScore(0);
  }, [startGame]);

  const handleSwap = useCallback((matchCount: number) => {
    setTotalSwaps(prev => prev + 1);
    if (soundEnabled) {
      playEffect('tick');
    }
  }, [soundEnabled, playEffect]);

  const handleComplete = useCallback((
    swaps: number,
    optimalSwaps: number,
    targetSeq: string[],
    playerSeq: string[],
  ) => {
    const totalTime = (Date.now() - gameStartTime) / 1000;
    const config = SCORING_CONFIG[difficulty];
    const bottleCount = DIFFICULTY_CONFIG[difficulty].count;

    // 计分：步数 70% + 时间 30%
    const extraSwaps = Math.max(0, swaps - optimalSwaps);
    const stepScore = Math.max(0, 100 - extraSwaps * config.stepPenalty);
    const timeScore = Math.max(0, 100 - Math.max(0, totalTime - config.baselineTime) * config.timeDecay);
    const score = Math.min(100, Math.round(stepScore * 0.7 + timeScore * 0.3));

    const accuracy = Math.round((optimalSwaps / Math.max(1, swaps)) * 100);

    const details: TrainingDetails = {
      difficulty,
      bottleCount,
      targetSequence: targetSeq,
      playerSequence: playerSeq,
      totalSwaps: swaps,
      optimalSwaps,
      completionTime: totalTime,
    };

    endGame({ score, accuracy, details });
    setFinalScore(score);
    setLastOptimalSwaps(optimalSwaps);
    setShowResult(true);

    if (soundEnabled) {
      playEffect('complete');
    }
  }, [gameStartTime, difficulty, endGame, soundEnabled, playEffect]);

  const bottleCount = DIFFICULTY_CONFIG[difficulty].count;

  return (
    <>
      <GameControlBar
        title="暗瓶排列"
        showTimer={isPlaying}
        elapsedTime={Math.floor(elapsedTime)}
      />

      <div className="max-w-2xl mx-auto px-6 pt-4 pb-32 flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* 开始页面 */}
        {isIdle && !showResult && (
          <div className="flex flex-col items-center gap-6 pt-8">
            <GameStartScreen
              mode="bottle"
              title="暗瓶排列"
              description="交换上排瓶子，推理出隐藏的下排排列"
              onStart={handleStart}
            />
            {/* 难度选择 */}
            <div className="w-full max-w-xs">
              <DifficultySelector
                difficulty={difficulty}
                onChange={(d) => setDifficulty(d as Difficulty)}
              />
              <p className="text-center text-xs text-muted-foreground mt-2">
                {bottleCount} 个瓶子
              </p>
            </div>
          </div>
        )}

        {/* 游戏进行中 */}
        {(isPlaying || isPaused) && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
            <BottleGame
              bottleCount={bottleCount}
              isActive={isPlaying}
              startTime={gameStartTime}
              onSwap={handleSwap}
              onComplete={handleComplete}
            />
            {/* 底部状态 */}
            <div className="flex justify-center gap-12">
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">步数</span>
                <span className="text-foreground text-2xl font-bold font-headline">{totalSwaps}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">用时</span>
                <span className="text-foreground text-2xl font-bold font-headline">{Math.floor(elapsedTime)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* 结果页面 */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 pt-8"
          >
            <div className="p-6 bg-surface-container-low rounded-2xl border border-border w-full">
              <h3 className="text-lg font-semibold mb-4 text-center font-headline">训练完成！</h3>
              <ScoreBoard score={finalScore} accuracy={Math.round((lastOptimalSwaps / Math.max(1, totalSwaps)) * 100)} />
              <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
                <p>步数: {totalSwaps}（最优: {lastOptimalSwaps}）</p>
                <p>用时: {elapsedTime.toFixed(1)}秒</p>
                <p>难度: {DIFFICULTY_CONFIG[difficulty].label}（{bottleCount}个瓶子）</p>
              </div>
            </div>
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
            >
              再玩一次
            </motion.button>
          </motion.div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/games/Bottle.tsx
git commit -m "✨ 新增暗瓶排列页面编排器"
```

---

## Task 4: 注册游戏到应用

**Files:**
- Modify: `src/components/game/index.ts`
- Modify: `src/components/game/GameCard.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 导出 BottleGame 组件**

在 `src/components/game/index.ts` 末尾新增一行：
```ts
export { BottleGame } from './BottleGame';
```

- [ ] **Step 2: 更新 GameCard 图标和颜色映射**

在 `src/components/game/GameCard.tsx` 中：

`modeIcons` 对象新增：
```ts
bottle: { icon: 'science', color: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' },
```

`modeColors` 对象新增：
```ts
bottle: 'bg-amber-600',
```

- [ ] **Step 3: 更新 GAME_PATHS**

在 `src/components/layout/AppLayout.tsx` 第 12 行的 `GAME_PATHS` 数组中追加：
```ts
const GAME_PATHS = ['/games/schulte', '/games/stroop', '/games/sequence', '/games/bottle'];
```

- [ ] **Step 4: 更新 App.tsx**

在 `src/App.tsx` 中做 3 处修改：

1) 新增 import（在 `import { Sequence }` 后面）：
```ts
import { Bottle } from './pages/games/Bottle';
```

2) `games` 数组末尾新增（在 sequence 条目后）：
```ts
{
  mode: 'bottle',
  title: '暗瓶排列',
  description: '隐藏推理训练',
  priority: 'P2',
},
```

3) 路由配置中新增（在 `games/sequence` 路由后）：
```ts
{ path: 'games/bottle', element: <Bottle /> },
```

- [ ] **Step 5: 提交**

```bash
git add src/components/game/index.ts src/components/game/GameCard.tsx src/components/layout/AppLayout.tsx src/App.tsx
git commit -m "🔗 注册暗瓶排列游戏到应用路由和导航"
```

---

## Task 5: 构建验证

- [ ] **Step 1: TypeScript 类型检查**

Run: `cd D:/BrainTrain/brain-train && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Vite 构建**

Run: `cd D:/BrainTrain/brain-train && npx vite build`
Expected: Build 成功，输出到 dist/

- [ ] **Step 3: 本地启动验证**

Run: `cd D:/BrainTrain/brain-train && npx vite dev`
手动验证：
1. 首页出现"暗瓶排列"卡片，图标为烧瓶（science），琥珀色调
2. 点击卡片进入游戏页面，显示开始屏幕和难度选择
3. 选择难度后点击开始，显示两排瓶子
4. 点击选中瓶子（高亮），再点击另一个瓶子完成交换
5. 尝试拖拽瓶子到另一个位置完成交换
6. 匹配计数实时更新
7. 全部匹配后显示分数面板
8. 统计页面能看到暗瓶排列的训练记录

- [ ] **Step 4: 确认无误后最终提交（如有修复）**

```bash
git add -A
git commit -m "🔧 修复构建或运行时问题"
```
