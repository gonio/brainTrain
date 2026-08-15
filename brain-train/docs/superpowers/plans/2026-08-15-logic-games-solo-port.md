# 逻辑谜题移植（PR1：单人部分）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 BrainLogic（E:/logic）的 6 个逻辑谜题游戏移植进 BrainTrain 前端，接入自由练习与主线闯关两种形态。

**Architecture:** 纯客户端移植——6 个谜题引擎（纯 TS、零依赖、rng 可注入）从 `E:/logic/server/src/games/*/(*Engine).ts` 原样复制到 `brain-train/src/lib/logic/`；每个游戏一个核心组件（自由练习与闯关共用）+ 一个薄页面；闯关侧每游戏一个 Runner 适配器。判定规则见 `D:/BrainTrain/CONTEXT.md` 与 `docs/adr/0001-brainlogic-port.md`：尝试次数制（3 次机会，首/次/三次对 = 3/2/1 星），谜题不限时。

**Tech Stack:** React 19 + TS + Vite + Tailwind v4（Stitch 体系）+ zustand + Dexie/IndexedDB + framer-motion + vitest（jsdom）。新增唯一依赖 `elkjs`（仅逻辑门，懒加载）。

## Global Constraints

- 工作分支：`feat/logic-games-solo`，从 `main` 最新切出（Task 1 处理）。
- 引擎文件**逐字复制**，不改逻辑；只允许改文件头注释。源：`E:/logic/server/src/games/{gates,truth,lineup,syllogism,zebra,fallacy}/`*`Engine.ts`（均无 import，自包含）。
- 不引入 XP/雷达；移植游戏只产生 `TrainingRecord`（IndexedDB）、闯关星级、连续打卡与每日目标。
- UI 全部走 Stitch 设计体系：`font-headline`、`bg-surface`、`text-foreground`、`bg-primary text-primary-foreground`、`material-symbols-outlined` 图标；禁止出现 BrainLogic 的 indigo-600/灰卡片原生 Tailwind 配色。
- 音效复用 `useAudio().playEffect('correct' | 'wrong' | 'complete' | 'tick')`，受 `useSettingsStore().soundEnabled` 门控。
- 自由练习会话固定 **5 题一局**，每题最多 **3 次作答机会**；`score = round(累计星数 / (3×5) × 100)`，`accuracy = 首次作答正确率`。
- 所有测试放 `brain-train/tests/unit/`，运行命令 `npm test -- --run <file>`（vitest，globals 已开，别名 `@/` 可用）。
- 测试用确定性随机：`mulberry32` 种子 PRNG（代码见 Task 1），组件经 `rng` prop 注入。
- 中文 UI 文案；提交信息用 `feat:` / `test:` 前缀。
- 每次 commit 前在 `brain-train/` 下跑 `npx tsc --noEmit` 必须无错。

---

### Task 1: 切分支 + 移植 6 个引擎与找谬误题库

**Files:**
- Create: `brain-train/src/lib/logic/gatesEngine.ts`（复制自 `E:/logic/server/src/games/gates/gatesEngine.ts`）
- Create: `brain-train/src/lib/logic/truthEngine.ts`（复制自 `E:/logic/server/src/games/truth/truthEngine.ts`）
- Create: `brain-train/src/lib/logic/lineupEngine.ts`（复制自 `E:/logic/server/src/games/lineup/lineupEngine.ts`）
- Create: `brain-train/src/lib/logic/syllogismEngine.ts`（复制自 `E:/logic/server/src/games/syllogism/syllogismEngine.ts`）
- Create: `brain-train/src/lib/logic/zebraEngine.ts`（复制自 `E:/logic/server/src/games/zebra/zebraEngine.ts`）
- Create: `brain-train/src/lib/logic/fallacyEngine.ts`（复制自 `E:/logic/server/src/games/fallacy/fallacyEngine.ts`）
- Create: `brain-train/src/lib/logic/fallacyBank.ts`（由 `E:/logic/server/src/games/fallacy/questions.json` 生成）
- Test: `brain-train/tests/unit/logicEngines.test.ts`

**Interfaces:**
- Produces（后续所有任务依赖）:
  - `generateGatesCircuit(level: number, rng?: () => number): GatesCircuit`，`evaluateCircuit(c: GatesCircuit): boolean`；`GatesCircuit { level; inputs: boolean[]; gates: Gate[]; outputGateId: number }`
  - `generateTruthPuzzle(level: number, rng?): TruthPuzzle`；`TruthPuzzle { level; statements: Statement[]; knight: boolean[] }`（`knight` 是答案）；`countSolutions(p): number`
  - `generateLineupPuzzle(level: number, rng?): LineupPuzzle`；`{ level; people: string[]; clues: LineupClue[]; solution: number[]; question: { kind:'whoAt';pos:number } | { kind:'whereIs';person:number } }`
  - `generateSyllogismPuzzle(level: number, rng?): SyllogismPuzzle`；`{ level; premises: [string,string]; conclusion: string; valid: boolean }`（`valid` 是答案）
  - `generateZebraPuzzle(level: number, rng?): ZebraPuzzle`；`{ level; houses; people; pets; drinks; clues: ZebraClue[]; question: ZebraQuestion }`（答案由 question 从内部解推出，组件判定用 `zebraClueHolds`/穷举或直接比对引擎导出——见 Task 8）
  - `judgeFallacy(q: FallacyQuestion, sentenceId: number, fallacyType: string): FallacyJudgeResult`；`FALLACY_TYPES: readonly string[]`（8 类）
  - `FALLACY_BANK: FallacyQuestion[]`，`pickFallacyQuestion(difficulty: 1|2|3, rng?: () => number): FallacyQuestion`

- [ ] **Step 1: 切分支**

```bash
cd /d/BrainTrain
git status --short   # 确认无未提交改动；有则先 stash 或提交
git checkout main && git pull
git checkout -b feat/logic-games-solo
```

- [ ] **Step 2: 复制 6 个引擎文件**

```bash
cd /d/BrainTrain/brain-train
mkdir -p src/lib/logic
cp /e/logic/server/src/games/gates/gatesEngine.ts         src/lib/logic/gatesEngine.ts
cp /e/logic/server/src/games/truth/truthEngine.ts         src/lib/logic/truthEngine.ts
cp /e/logic/server/src/games/lineup/lineupEngine.ts       src/lib/logic/lineupEngine.ts
cp /e/logic/server/src/games/syllogism/syllogismEngine.ts src/lib/logic/syllogismEngine.ts
cp /e/logic/server/src/games/zebra/zebraEngine.ts         src/lib/logic/zebraEngine.ts
cp /e/logic/server/src/games/fallacy/fallacyEngine.ts     src/lib/logic/fallacyEngine.ts
grep -c "^import" src/lib/logic/*.ts || true   # 预期全 0：引擎自包含
```

- [ ] **Step 3: 生成 fallacyBank.ts（带 id 与选题助手）**

写临时脚本 `/tmp/gen-fallacy-bank.cjs`：

```js
const fs = require('fs');
const bank = require('E:/logic/server/src/games/fallacy/questions.json');
const withIds = bank.map((q, i) => ({ id: `fq-${String(i + 1).padStart(2, '0')}`, ...q }));
const out = `// 找谬误题库：移植自 BrainLogic（E:/logic/server/src/games/fallacy/questions.json），31 题原样。
// id 在移植时按顺序生成（fq-01..fq-31）。
import type { FallacyQuestion } from './fallacyEngine';

export const FALLACY_BANK: FallacyQuestion[] = ${JSON.stringify(withIds, null, 2)};

/** 按难度随机抽一题（difficulty 1=入门 2=进阶 3=挑战） */
export function pickFallacyQuestion(
  difficulty: 1 | 2 | 3,
  rng: () => number = Math.random,
): FallacyQuestion {
  const pool = FALLACY_BANK.filter((q) => q.difficulty === difficulty);
  if (pool.length === 0) throw new Error(\`题库难度 \${difficulty} 无题\`);
  return pool[Math.floor(rng() * pool.length)];
}
`;
fs.writeFileSync('D:/BrainTrain/brain-train/src/lib/logic/fallacyBank.ts', out);
console.log('written', withIds.length, 'questions');
```

运行：`node /tmp/gen-fallacy-bank.cjs` → 预期输出 `written 31 questions`。

- [ ] **Step 4: 写引擎冒烟测试**

`brain-train/tests/unit/logicEngines.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { generateGatesCircuit, evaluateCircuit } from '@/lib/logic/gatesEngine';
import { generateTruthPuzzle, countSolutions } from '@/lib/logic/truthEngine';
import { generateLineupPuzzle, countLineupSolutions } from '@/lib/logic/lineupEngine';
import { generateSyllogismPuzzle } from '@/lib/logic/syllogismEngine';
import { generateZebraPuzzle } from '@/lib/logic/zebraEngine';
import { judgeFallacy, FALLACY_TYPES } from '@/lib/logic/fallacyEngine';
import { FALLACY_BANK, pickFallacyQuestion } from '@/lib/logic/fallacyBank';

/** mulberry32 种子 PRNG：测试确定性用。组件的 rng prop 也吃这个类型。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('移植引擎冒烟', () => {
  it('gates：1/10/20 级生成且可求值', () => {
    for (const level of [1, 10, 20]) {
      const c = generateGatesCircuit(level, mulberry32(level));
      expect(c.gates.length).toBeGreaterThan(0);
      expect(typeof evaluateCircuit(c)).toBe('boolean');
    }
  });

  it('truth：3/4/5/6 人谜题有唯一解', () => {
    for (const level of [3, 4, 5, 6]) {
      const p = generateTruthPuzzle(level, mulberry32(level * 7));
      expect(p.statements).toHaveLength(level);
      expect(countSolutions(p)).toBe(1);
    }
  });

  it('lineup：1/10/20 级线索收敛到唯一解', () => {
    for (const level of [1, 10, 20]) {
      const p = generateLineupPuzzle(level, mulberry32(level * 13));
      expect(countLineupSolutions(p.people.length, p.clues)).toBe(1);
    }
  });

  it('syllogism：低级别只出 tier-1 全称式', () => {
    const p = generateSyllogismPuzzle(3, mulberry32(42));
    expect(p.premises).toHaveLength(2);
    expect(typeof p.valid).toBe('boolean');
  });

  it('zebra：1/11 级分别生成 3/4 座房子', () => {
    expect(generateZebraPuzzle(1, mulberry32(1)).houses).toBe(3);
    expect(generateZebraPuzzle(11, mulberry32(11)).houses).toBe(4);
  });

  it('fallacy：题库 31 题、8 类、判定正误', () => {
    expect(FALLACY_BANK).toHaveLength(31);
    expect(FALLACY_TYPES).toHaveLength(8);
    const q = pickFallacyQuestion(1, mulberry32(5));
    expect(q.difficulty).toBe(1);
    const correctSentence = q.material.find((s) => s.isFallacy)!;
    const good = judgeFallacy(q, correctSentence.id, q.fallacyType);
    expect(good.locatedCorrectly).toBe(true);
    expect(good.classifiedCorrectly).toBe(true);
    const bad = judgeFallacy(q, correctSentence.id, FALLACY_TYPES.find((t) => t !== q.fallacyType)!);
    expect(bad.classifiedCorrectly).toBe(false);
  });
});
```

- [ ] **Step 5: 跑测试 + 类型检查**

```bash
cd /d/BrainTrain/brain-train
npm test -- --run tests/unit/logicEngines.test.ts   # 预期 6 个 it 全 PASS
npx tsc --noEmit                                     # 预期无错
```

注意：`countLineupSolutions`/`countSolutions` 若未从引擎导出（它们已导出，见引擎源码 `export function`），测试编译会立刻报出，按引擎实际导出名调整 import 即可，不要改引擎逻辑。

- [ ] **Step 6: Commit**

```bash
cd /d/BrainTrain
git add brain-train/src/lib/logic brain-train/tests/unit/logicEngines.test.ts
git commit -m "feat: 移植 BrainLogic 6 个谜题引擎与找谬误题库（原样复制）"
```

---

### Task 2: 尝试次数制计分助手

**Files:**
- Create: `brain-train/src/lib/logic/attempts.ts`
- Test: `brain-train/tests/unit/logicAttempts.test.ts`

**Interfaces:**
- Produces:
  - `MAX_ATTEMPTS = 3`
  - `starsForAttempts(used: number): 0 | 1 | 2 | 3` — 1→3，2→2，3→1，其余（>3 或未答对）→0
  - `logicSessionScore(stars: number[]): number` — `round(sum / (3 × stars.length) × 100)`，空数组→0
  - `firstTryAccuracy(rounds: { attempts: number; correct: boolean }[]): number` — 首次作答即对的比例 ×100，空数组→0
  - `LogicRoundOutcome { correct: boolean; attempts: number }`（每题结果，自由练习与闯关共用）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { MAX_ATTEMPTS, starsForAttempts, logicSessionScore, firstTryAccuracy } from '@/lib/logic/attempts';

describe('尝试次数制计分', () => {
  it('星级映射', () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect(starsForAttempts(1)).toBe(3);
    expect(starsForAttempts(2)).toBe(2);
    expect(starsForAttempts(3)).toBe(1);
    expect(starsForAttempts(4)).toBe(0);
  });
  it('会话分：5 题全首对 = 100', () => {
    expect(logicSessionScore([3, 3, 3, 3, 3])).toBe(100);
    expect(logicSessionScore([3, 2, 1, 0, 3])).toBe(60);
    expect(logicSessionScore([])).toBe(0);
  });
  it('首次作答正确率', () => {
    expect(firstTryAccuracy([
      { attempts: 1, correct: true },
      { attempts: 2, correct: true },
      { attempts: 3, correct: false },
    ])).toBe(33);
    expect(firstTryAccuracy([])).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npm test -- --run tests/unit/logicAttempts.test.ts`，预期模块不存在报错。

- [ ] **Step 3: 实现**

```ts
// 尝试次数制（尝试次数制 / Attempt-based Clearing，见 CONTEXT.md）：
// 谜题不限时，每题最多 3 次作答机会；按第几次答对评星。
export const MAX_ATTEMPTS = 3;

export interface LogicRoundOutcome {
  correct: boolean;
  attempts: number; // 实际作答次数（答对或机会用完时的次数）
}

export function starsForAttempts(used: number): 0 | 1 | 2 | 3 {
  if (used === 1) return 3;
  if (used === 2) return 2;
  if (used === 3) return 1;
  return 0;
}

/** 自由练习会话分：累计星数占满星比例 ×100 */
export function logicSessionScore(stars: number[]): number {
  if (stars.length === 0) return 0;
  const sum = stars.reduce((a, b) => a + b, 0);
  return Math.round((sum / (3 * stars.length)) * 100);
}

/** 首次作答正确率（%） */
export function firstTryAccuracy(rounds: LogicRoundOutcome[]): number {
  if (rounds.length === 0) return 0;
  const firstTry = rounds.filter((r) => r.correct && r.attempts === 1).length;
  return Math.round((firstTry / rounds.length) * 100);
}
```

- [ ] **Step 4: 跑测试确认通过** — 同上命令，预期 3 个 it 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add brain-train/src/lib/logic/attempts.ts brain-train/tests/unit/logicAttempts.test.ts
git commit -m "feat: 逻辑谜题尝试次数制计分助手"
```

---

### Task 3: 类型与静态注册点扩展

**Files:**
- Modify: `brain-train/src/types/index.ts:1-6`（TrainingMode）、`:88-89`（TrainingDetails union）
- Modify: `brain-train/src/lib/gameplayInstructions.ts:2`（局部 TrainingMode）+ 文件尾（6 个配置 + map 注册）
- Modify: `brain-train/src/components/game/GameCard.tsx:15-27`
- Modify: `brain-train/src/pages/Stats.tsx:9-22`
- Test: `brain-train/tests/unit/logicRegistry.test.ts`

**Interfaces:**
- Produces:
  - `TrainingMode` 扩为 10 值：`'schulte' | 'stroop' | 'sequence' | 'bottle' | 'gates' | 'truth' | 'lineup' | 'syllogism' | 'zebra' | 'fallacy'`
  - `LogicPuzzleDetails { game: LogicGameId; engineLevel: number; rounds: LogicRoundOutcome[] }`，`LogicGameId = 'gates'|'truth'|'lineup'|'syllogism'|'zebra'|'fallacy'`；加入 `TrainingDetails` union
  - `LOGIC_GAME_NAMES: Record<LogicGameId, string>`（`src/types/index.ts` 导出，UI 各处复用）

- [ ] **Step 1: 扩展 types/index.ts**

`TrainingMode` 改为：

```ts
// Training modes
export type TrainingMode =
  | 'schulte'   // 舒尔特表
  | 'stroop'    // 字色干扰
  | 'sequence'  // 序列记忆
  | 'bottle'    // 暗瓶排列
  | 'gates'     // 逻辑门
  | 'truth'     // 真假岛
  | 'lineup'    // 排排坐
  | 'syllogism' // 说得通吗
  | 'zebra'     // 左邻右舍
  | 'fallacy';  // 找谬误

// 移植的逻辑谜题游戏 id（TrainingMode 的子集）
export type LogicGameId = 'gates' | 'truth' | 'lineup' | 'syllogism' | 'zebra' | 'fallacy';

export const LOGIC_GAME_NAMES: Record<LogicGameId, string> = {
  gates: '逻辑门',
  truth: '真假岛',
  lineup: '排排坐',
  syllogism: '说得通吗',
  zebra: '左邻右舍',
  fallacy: '找谬误',
};
```

`TrainingDetails` union 上方新增：

```ts
// 逻辑谜题统一训练详情：5 题一局，每题记对错与作答次数
export interface LogicPuzzleDetails {
  game: LogicGameId;
  engineLevel: number;             // 本局使用的引擎难度（1-20；找谬误为题库难度 1-3）
  rounds: { correct: boolean; attempts: number }[];
}
```

union 末尾追加 `| LogicPuzzleDetails`。

- [ ] **Step 2: GameCard 图标与配色**

`modeIcons` / `modeColors` 各追加 6 项（Material Symbols 图标名）：

```ts
  gates: { icon: 'memory', color: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100' },
  truth: { icon: 'theater_comedy', color: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' },
  lineup: { icon: 'groups', color: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100' },
  syllogism: { icon: 'quiz', color: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100' },
  zebra: { icon: 'home', color: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' },
  fallacy: { icon: 'troubleshoot', color: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' },
```

```ts
  gates: 'bg-violet-600',
  truth: 'bg-emerald-600',
  lineup: 'bg-cyan-600',
  syllogism: 'bg-indigo-600',
  zebra: 'bg-rose-600',
  fallacy: 'bg-amber-600',
```

- [ ] **Step 3: Stats.tsx 标签**

`modeNames` 追加：`gates: '逻辑门', truth: '真假岛', lineup: '排排坐', syllogism: '说得通吗', zebra: '左邻右舍', fallacy: '找谬误'`；
`modeIcons` 追加：`gates: '🔌', truth: '🏝️', lineup: '🪑', syllogism: '💬', zebra: '🏠', fallacy: '🕵️'`。

- [ ] **Step 4: gameplayInstructions.ts**

第 2 行局部类型改为 `type TrainingMode = import('../types').TrainingMode;`（删掉 4 值字面量 union，直接复用主类型，防止今后再次漏改）。
文件尾追加 6 个 `GameplayInstructionsConfig` 并注册进 `gameplayInstructionsMap`。示例（说得通吗，其余 5 个按同结构写全，文案围绕各自玩法与 3 次机会规则）：

```ts
export const syllogismInstructions: GameplayInstructionsConfig = {
  mode: 'syllogism',
  title: '说得通吗',
  description: '演绎推理训练 - 判断三段论推理形式是否有效',
  objective: '给出两句前提和一句结论，判断这个推理在形式上是否成立（与内容真假无关）。',
  howToPlay: [
    '阅读两句前提与一句结论',
    '只根据推理形式判断「说得通」还是「说不通」',
    '每题最多 3 次作答机会，答错可再试',
    '一局 5 题，按作答表现评星计分',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '高难度会混入含特称命题与直觉陷阱的条目。',
};
// …truth/lineup/zebra/fallacy/gates 同结构各一份…
```

并加入 `gameplayInstructionsMap`（保持 `Record<TrainingMode, GameplayInstructionsConfig>` 完整）。其余 5 份配置全文如下（结构相同，照录）：

```ts
export const truthInstructions: GameplayInstructionsConfig = {
  mode: 'truth',
  title: '真假岛',
  description: '演绎推理训练 - 从真话假话中推出每人身份',
  objective: '岛上每人只说真话或只说假话。根据每个人的陈述，推出谁是骑士（只说真话）、谁是无赖（只说假话）。',
  howToPlay: [
    '阅读每个人说的一句话',
    '为每个人选择身份：骑士或无赖',
    '点「提交答案」判定；答案唯一',
    '每题最多 3 次作答机会，一局 5 题',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '高难度岛民更多，陈述形式也更绕（计数、存在性断言等）。',
};

export const lineupInstructions: GameplayInstructionsConfig = {
  mode: 'lineup',
  title: '排排坐',
  description: '演绎推理训练 - 根据约束推出排队位置',
  objective: 'N 个人排成一列，根据若干约束（先后/相邻/间隔/位置否定）推出指定位置是谁，或某人在第几位。',
  howToPlay: [
    '阅读全部约束条件',
    '在脑中或草稿上排出唯一满足所有约束的队列',
    '根据问题点选答案（人名或位置）',
    '每题最多 3 次作答机会，一局 5 题',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '高难度人数更多（至多 7 人），且会出现间隔类约束。',
};

export const zebraInstructions: GameplayInstructionsConfig = {
  mode: 'zebra',
  title: '左邻右舍',
  description: '演绎推理训练 - 迷你斑马谜题',
  objective: '几座房子里住着不同的人，各养不同宠物、喝不同饮料。根据交叉约束推出题目所问的归属。',
  howToPlay: [
    '看清人、宠物、饮料三类条目与全部线索',
    '推出每条目各在第几座房子（答案唯一）',
    '根据问题点选答案',
    '每题最多 3 次作答机会，一局 5 题',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '高难度有 4 座房子，线索类型更多（紧挨左侧等）。',
};

export const fallacyInstructions: GameplayInstructionsConfig = {
  mode: 'fallacy',
  title: '找谬误',
  description: '谬误批判训练 - 定位并归类逻辑谬误',
  objective: '一段话里藏着一处逻辑谬误。先点出有问题的那句话，再选出它属于哪种谬误。',
  howToPlay: [
    '通读材料，材料按句切分',
    '点选含谬误的那句话',
    '从 8 种谬误类型中点选归类',
    '两步全对才算答对；答错会提示是定位错还是类型错',
    '每题最多 3 次作答机会，一局 5 题',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '挑战难度材料更长、谬误更隐蔽；题库共 31 题，会循环出现。',
};

export const gatesInstructions: GameplayInstructionsConfig = {
  mode: 'gates',
  title: '逻辑门',
  description: '规则推演训练 - 推电路输出',
  objective: '给出由 AND/OR/NOT/XOR 组成的电路图与各输入位的值，推出最终输出是 0 还是 1。',
  howToPlay: [
    '看清每个输入位的值（0/1）',
    '沿导线逐级推每个门的输出',
    '点选最终输出的值',
    '每题最多 3 次作答机会，一局 5 题',
  ],
  scoringRules: [
    '首次答对 3 星，第二次 2 星，第三次 1 星，3 次全错 0 星',
    '得分 = 累计星数占满星比例 ×100',
  ],
  hardModeNote: '高难度门更多、层级更深，且混入 NOT/XOR。',
};
```

- [ ] **Step 5: 写注册完整性守卫测试**

`brain-train/tests/unit/logicRegistry.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { LOGIC_GAME_NAMES } from '@/types';
import { gameplayInstructionsMap } from '@/lib/gameplayInstructions';

const LOGIC_IDS = Object.keys(LOGIC_GAME_NAMES) as (keyof typeof LOGIC_GAME_NAMES)[];

describe('逻辑游戏注册完整性', () => {
  it('6 个游戏 id', () => {
    expect(LOGIC_IDS.sort()).toEqual(['fallacy', 'gates', 'lineup', 'syllogism', 'truth', 'zebra']);
  });
  it.each(LOGIC_IDS)('%s 有玩法说明', (id) => {
    const cfg = gameplayInstructionsMap[id];
    expect(cfg).toBeDefined();
    expect(cfg.howToPlay.length).toBeGreaterThan(0);
    expect(cfg.scoringRules.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: 验证 + Commit**

```bash
cd /d/BrainTrain/brain-train
npx tsc --noEmit
npm test -- --run tests/unit/logicRegistry.test.ts
git add -A && git commit -m "feat: TrainingMode 扩展 6 个逻辑游戏 + 图标/说明/统计标签注册"
```

---

### Task 4: LogicSessionShell 自由练习会话外壳

所有 6 个逻辑游戏的自由练习页面共用同一流程：开始屏（自动弹规则）→ 三档难度 → 3 秒倒计时 → 5 题循环（每题独立引擎难度、3 次机会）→ 结算（得分/首对率/逐题星级）→ 再玩一次。抽成一个外壳，游戏只提供"单题渲染器"。

**Files:**
- Create: `brain-train/src/components/game/LogicSessionShell.tsx`
- Test: `brain-train/tests/unit/LogicSessionShell.test.tsx`

**Interfaces:**
- Consumes: `LogicRoundOutcome`/`logicSessionScore`/`firstTryAccuracy`（Task 2）；`GameStartScreen`、`ScoreBoard`、`GameControlBar`、`useStartCountdown`、`useGameStore`、`useAudio`（现有）
- Produces:
  ```tsx
  export interface LogicRoundProps {
    engineLevel: number;
    isActive: boolean;
    rng?: () => number;
    onRoundEnd: (o: LogicRoundOutcome) => void;
  }
  export interface LogicSessionShellProps {
    mode: TrainingMode;                 // 逻辑游戏 id
    title: string;
    description: string;
    engineLevels: Record<'easy' | 'medium' | 'hard', readonly [number, number]>; // 每档引擎难度闭区间
    renderRound: (props: LogicRoundProps) => React.ReactNode;
  }
  export function LogicSessionShell(props: LogicSessionShellProps): JSX.Element;
  ```
  行为约定（实现者照此写，后续游戏任务的 `renderRound` 照此对接）：
  - idle：渲染 `GameStartScreen`（`mode/title/description/onStart`）+ 三档难度按钮（样式照 `Sequence.tsx` 内联 DifficultySelector）
  - 开始：`triggerCountdown(() => startGame(mode))`；每题 `engineLevel = 区间内随机整数`（`Math.floor(Math.random() * (max - min + 1)) + min`）
  - 题与题之间用 `key={roundIdx}` 重挂载单题组件；`onRoundEnd` 收到结果后记录、播 `correct`/`wrong`，500ms 后自动进下一题
  - 5 题结束：`endGame({ score: logicSessionScore(stars), accuracy: firstTryAccuracy(rounds), details: { game: mode, engineLevel: 所用最高 engineLevel, rounds } as LogicPuzzleDetails })`
  - 结算屏：`ScoreBoard` + 逐题星级列表（★/✗）+ 「再玩一次」按钮

- [ ] **Step 1: 写外壳测试**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogicSessionShell } from '@/components/game/LogicSessionShell';

describe('LogicSessionShell', () => {
  const noop = () => {};
  it('初始渲染开始屏与三档难度', () => {
    render(
      <LogicSessionShell
        mode="syllogism"
        title="说得通吗"
        description="测试"
        engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
        renderRound={() => null}
      />,
    );
    expect(screen.getByText('说得通吗')).toBeTruthy();
    expect(screen.getByText('开始训练')).toBeTruthy();
    expect(screen.getByText('简单')).toBeTruthy();
    expect(screen.getByText('困难')).toBeTruthy();
  });
  it('难度可切换选中态', () => {
    render(
      <LogicSessionShell
        mode="syllogism" title="说得通吗" description="测试"
        engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
        renderRound={() => null}
      />,
    );
    const hard = screen.getByText('困难');
    fireEvent.click(hard);
    expect(hard.className).toContain('bg-primary');
  });
});
```

（完整 5 题流程涉及倒计时定时器与 Dexie 写入，留人工冒烟验证，不做 jsdom 测试。）

- [ ] **Step 2: 跑测试确认失败** — `npm test -- --run tests/unit/LogicSessionShell.test.tsx`，预期组件不存在报错。若 `@testing-library/react` 未装，按现有 `tests/unit/SequenceGame.test.tsx` 的渲染方式对齐（项目已有该依赖则直接用）。

- [ ] **Step 3: 实现外壳**（完整组件，约 150 行；流程参照 `src/pages/games/Sequence.tsx`，结算参照其 ScoreBoard 用法，难度按钮样式照其内联 DifficultySelector）

要点：
- `type Difficulty = 'easy' | 'medium' | 'hard'`，默认 `'easy'`
- 状态：`difficulty`、`roundIdx`（0-4）、`outcomes: LogicRoundOutcome[]`、`showResult`
- `handleStart` → 倒计时 → `startGame(mode)` 且清空 outcomes/roundIdx
- `handleRoundEnd(o)` → push outcome；未够 5 题则 `setTimeout(() => setRoundIdx(i => i + 1), 500)`；够 5 题则算分、`endGame`、`playEffect('complete')`、`showResult = true`
- 结算屏逐题星级：`outcomes.map` 渲染 `★×n` 或 `✗`，用 `starsForAttempts`
- 单题渲染区：`<div key={roundIdx}>{renderRound({ engineLevel, isActive, onRoundEnd: handleRoundEnd })}</div>`，并显示「第 {roundIdx+1}/5 题」

- [ ] **Step 4: 跑测试确认通过 + tsc**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: 逻辑谜题自由练习会话外壳 LogicSessionShell"`

---

### Task 5: 说得通吗（syllogism）

**Files:**
- Create: `brain-train/src/components/game/SyllogismGame.tsx`
- Create: `brain-train/src/pages/games/Syllogism.tsx`
- Modify: `brain-train/src/App.tsx`（import + games[] + route）
- Test: `brain-train/tests/unit/SyllogismGame.test.tsx`

**Interfaces:**
- Consumes: `generateSyllogismPuzzle`（Task 1）、`LogicRoundProps`/`LogicSessionShell`（Task 4）
- Produces: `SyllogismGame(props: LogicRoundProps)`（Task 11 的 QuestSyllogismRunner 直接复用）

- [ ] **Step 1: 写组件测试**

关键技巧：组件接受 `rng` 注入，测试用同一个 `mulberry32` 种子先调引擎算出本题答案，再据此点按钮——断言精确且确定。

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyllogismGame } from '@/components/game/SyllogismGame';
import { generateSyllogismPuzzle } from '@/lib/logic/syllogismEngine';
import { mulberry32 } from './logicEngines.test';

// 组件与测试各自调一次 generateSyllogismPuzzle(3, mulberry32(42))，得到同一道题
const expected = generateSyllogismPuzzle(3, mulberry32(42)).valid;
const correctLabel = expected ? '说得通' : '说不通';
const wrongLabel = expected ? '说不通' : '说得通';

describe('SyllogismGame', () => {
  it('渲染两句前提一句结论与两个判断按钮', () => {
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={() => {}} />);
    expect(screen.getByText('说得通')).toBeTruthy();
    expect(screen.getByText('说不通')).toBeTruthy();
    expect(screen.getByText(/前提/)).toBeTruthy();
    expect(screen.getByText(/结论/)).toBeTruthy();
  });

  it('答对：onRoundEnd { correct: true, attempts: 1 }，之后按钮不再响应', () => {
    const onRoundEnd = vi.fn();
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByText(correctLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1); // 结束后忽略点击
  });

  it('3 次全错：onRoundEnd { correct: false, attempts: 3 }', () => {
    const onRoundEnd = vi.fn();
    render(<SyllogismGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByText(wrongLabel));
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).not.toHaveBeenCalled(); // 还有 1 次机会，未结束
    fireEvent.click(screen.getByText(wrongLabel));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: false, attempts: 3 });
  });
});
```

其余 5 个游戏的组件测试沿用同一技巧（rng 注入 + 引擎预算答案），不再重复说明。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现组件**

结构（约 110 行）：
- `const puzzle = useMemo(() => generateSyllogismPuzzle(engineLevel, rng), [engineLevel, rng])`
- 状态：`attempts`（已用次数）、`verdict: 'correct' | 'wrong' | null`、`ended`
- UI：卡片列出「前提 1：…」「前提 2：…」「结论：…」；下方两个等宽按钮「说得通」「说不通」（`bg-surface border`，选中/反馈时 `bg-primary text-primary-foreground` / 错误 `bg-red-500/20`）；剩余机会提示「还剩 {3 - attempts} 次机会」
- `handlePick(choice: boolean)`：`ended || !isActive` 直接 return；`choice === puzzle.valid` → `setVerdict('correct')`、播 `correct`、`onRoundEnd({ correct: true, attempts: attempts + 1 })`；否则播 `wrong`，`attempts + 1 >= 3` → `onRoundEnd({ correct: false, attempts: 3 })`，否则 `attempts+1` 并显示「再想想」
- 结束后展示谜底：「这段推理其实{说得通/说不通}」

- [ ] **Step 4: 页面 + 注册**

`src/pages/games/Syllogism.tsx`：

```tsx
import { LogicSessionShell } from '../../components/game/LogicSessionShell';
import { SyllogismGame } from '../../components/game/SyllogismGame';

export function Syllogism() {
  return (
    <LogicSessionShell
      mode="syllogism"
      title="说得通吗"
      description="判断三段论的推理形式是否有效"
      engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}
      renderRound={(p) => <SyllogismGame {...p} />}
    />
  );
}
```

`App.tsx`：import 该页；`games[]` 追加 `{ mode: 'syllogism', title: '说得通吗', description: '演绎推理训练', priority: 'P2' }`；路由追加 `{ path: 'games/syllogism', element: <Syllogism /> }`。

- [ ] **Step 5: 验证 + Commit** — `npx tsc --noEmit && npm test -- --run tests/unit/SyllogismGame.test.tsx`，然后 `git add -A && git commit -m "feat: 说得通吗自由练习（组件+页面+注册）"`

---

### Task 6: 真假岛（truth）

**Files:**
- Create: `brain-train/src/lib/logic/truthText.ts`（陈述→中文文案）
- Create: `brain-train/src/components/game/TruthGame.tsx`
- Create: `brain-train/src/pages/games/Truth.tsx`
- Modify: `brain-train/src/App.tsx`
- Test: `brain-train/tests/unit/TruthGame.test.tsx`

**Interfaces:**
- Consumes: `generateTruthPuzzle`、`TruthPuzzle`、`Statement`（Task 1）
- Produces: `statementText(s: Statement): string`；`TruthGame(props: LogicRoundProps)`

- [ ] **Step 1: 移植陈述文案函数**

把 `E:/logic/web/src/pages/Truth.tsx:18-53` 的 `function statementText(s: TruthStatement): string` 整段复制为 `src/lib/logic/truthText.ts` 的 `export function statementText(s: Statement): string`（类型名 `TruthStatement` 改为引擎的 `Statement`，import 自 `./truthEngine`；函数体一字不改，含自指边缘案例文案）。

- [ ] **Step 2: 写组件测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TruthGame } from '@/components/game/TruthGame';
import { mulberry32 } from './logicEngines.test';

describe('TruthGame', () => {
  it('渲染每人一句陈述与身份切换', () => {
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={() => {}} />);
    // 3 人岛：3 条陈述 + 每人一个骑士/无赖切换 + 提交按钮
    expect(screen.getAllByRole('button', { name: /骑士|无赖/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('提交答案')).toBeTruthy();
  });
  it('提交后回调一次作答结果', () => {
    const onRoundEnd = vi.fn();
    render(<TruthGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByText('提交答案'));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0].attempts).toBe(1);
  });
});
```

- [ ] **Step 3: 跑测试确认失败 → 实现组件**

结构（约 140 行）：
- `const puzzle = useMemo(() => generateTruthPuzzle(engineLevel, rng), ...)`（engineLevel 3-6）
- 状态：`knight: boolean[]`（初始全 true）、`attempts`、`ended`
- UI：每人一张卡片：陈述文本（`statementText`）+ 二选一切换（骑士/无赖，`bg-primary` 选中）；底部「提交答案」全宽按钮 + 剩余机会
- 判定：提交时 `arraysEqual(knight, puzzle.knight)`（组件内写 4 行比较即可）；对/错处理同 SyllogismGame
- 结束后揭示：逐人标出真实身份「第 i 人：骑士/无赖」

- [ ] **Step 4: 页面 + 注册**（同 Task 5 结构；`engineLevels={{ easy: [3, 3], medium: [4, 5], hard: [6, 6] }}`，description `'演绎推理训练'`，route `games/truth`）

- [ ] **Step 5: 验证 + Commit** — `git commit -m "feat: 真假岛自由练习"`

---

### Task 7: 排排坐（lineup）

**Files:**
- Create: `brain-train/src/lib/logic/lineupText.ts`
- Create: `brain-train/src/components/game/LineupGame.tsx`
- Create: `brain-train/src/pages/games/Lineup.tsx`
- Modify: `brain-train/src/App.tsx`
- Test: `brain-train/tests/unit/LineupGame.test.tsx`

**Interfaces:**
- Consumes: `generateLineupPuzzle`、`LineupPuzzle`、`LineupClue`（Task 1）
- Produces: `clueText(c: LineupClue, people: string[]): string`；`LineupGame(props: LogicRoundProps)`

- [ ] **Step 1: 移植线索文案** — 复制 `E:/logic/web/src/pages/Lineup.tsx:11-21` 的 `clueText` 为 `src/lib/logic/lineupText.ts` 的导出函数（类型改自 `./lineupEngine`）。

- [ ] **Step 2: 写组件测试**（同 TruthGame 模式：渲染出线索列表与选项 chips；点一个选项即一次作答，断言 `onRoundEnd` 回调 attempts=1）

- [ ] **Step 3: 实现组件**（约 130 行）
- `const puzzle = useMemo(() => generateLineupPuzzle(engineLevel, rng), ...)`
- UI：线索列表（`clueText(c, puzzle.people)` 逐条）；问题区：`question.kind === 'whoAt'` → 「第 {pos} 位是谁？」选项 = `puzzle.people` 名字 chips；`whereIs` → 「{people[person]} 在第几位？」选项 = `1..people.length` 数字 chips
- 点选项 = 一次作答。判定：`whoAt` → 选中名字 === `people[solution[pos - 1]]`；`whereIs` → 选中数字 === `solution.indexOf(person) + 1`（`solution[posIdx] = personId`，0 基）
- 对/错处理同前；结束后揭示正确排位（`solution.map(pid => people[pid])` 横向列出）

- [ ] **Step 4: 页面 + 注册**（`engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}`，route `games/lineup`）

- [ ] **Step 5: 验证 + Commit** — `git commit -m "feat: 排排坐自由练习"`

---

### Task 8: 左邻右舍（zebra）

**Files:**
- Create: `brain-train/src/lib/logic/zebraText.ts`
- Create: `brain-train/src/components/game/ZebraGame.tsx`
- Create: `brain-train/src/pages/games/Zebra.tsx`
- Modify: `brain-train/src/App.tsx`
- Test: `brain-train/tests/unit/ZebraGame.test.tsx`

**Interfaces:**
- Consumes: `generateZebraPuzzle`、`ZebraPuzzle`、`ZebraClue`（Task 1）
- Produces: `makeClueText(puzzle): (c: ZebraClue) => string`；`expectedZebraAnswer(p: ZebraPuzzle): string`；`ZebraGame(props: LogicRoundProps)`

- [ ] **Step 1: 移植线索文案 + 答案推导**

`src/lib/logic/zebraText.ts`：复制 `E:/logic/web/src/pages/Zebra.tsx:11-31` 的 `makeItemText`/`makeClueText`（`ZebraRound` 类型改为引擎的 `ZebraPuzzle`），并新增答案推导（逻辑复制自 `E:/logic/server/src/games/zebra/zebraService.ts:57-66`）：

```ts
import type { ZebraPuzzle } from './zebraEngine';

/** 从谜题解推出问题的期望答案（与 BrainLogic 服务端判定逻辑一致） */
export function expectedZebraAnswer(p: ZebraPuzzle): string {
  const q = p.question;
  if (q.kind === 'whoHasPet') return p.people.find((x) => p.solution[x] === p.solution[q.pet])!;
  if (q.kind === 'whoDrinks') return p.people.find((x) => p.solution[x] === p.solution[q.drink])!;
  const items = q.attr === 'pet' ? p.pets : p.drinks;
  return items.find((it) => p.solution[it] === q.house)!;
}
```

- [ ] **Step 2: 写组件测试**（同前模式；额外单测 `expectedZebraAnswer`：用 mulberry32 生成谜题，断言返回值非空且属于正确选项集）

- [ ] **Step 3: 实现组件**（约 130 行）
- UI：属性栏（人/宠物/饮料各一行 chips 展示）；线索列表（`makeClueText`）；问题区按 `question.kind` 出选项：`whoHasPet`/`whoDrinks` → 人名 chips；`whatAtHouse` → `attr === 'pet' ? pets : drinks` chips
- 点选项 = 一次作答，与 `expectedZebraAnswer(puzzle)` 比对；结束后揭示答案

- [ ] **Step 4: 页面 + 注册**（`engineLevels={{ easy: [1, 7], medium: [8, 14], hard: [15, 20] }}`，route `games/zebra`）

- [ ] **Step 5: 验证 + Commit** — `git commit -m "feat: 左邻右舍自由练习"`

---

### Task 9: 找谬误（fallacy）

**Files:**
- Create: `brain-train/src/components/game/FallacyGame.tsx`
- Create: `brain-train/src/pages/games/Fallacy.tsx`
- Modify: `brain-train/src/App.tsx`
- Test: `brain-train/tests/unit/FallacyGame.test.tsx`

**Interfaces:**
- Consumes: `FALLACY_BANK`、`pickFallacyQuestion`、`judgeFallacy`、`FALLACY_TYPES`（Task 1）
- Produces: `FallacyGame(props: LogicRoundProps)`（`engineLevel` 语义 = 题库难度 1/2/3）

- [ ] **Step 1: 写组件测试**

```tsx
// 渲染：材料句子可点选、8 个谬误类型 chips、提交按钮（两者都选后才可点）
// 流程：点谬误句 + 点正确类型 + 提交 ⇒ onRoundEnd { correct: true, attempts: 1 }
// 定位对分类错 ⇒ 也算答错（消耗一次机会）——判定规则：两步全对才算对
```

测试用 mulberry32 选题后从 `FALLACY_BANK` 反查该题答案驱动点击（测试可直接 import FALLACY_BANK 找答案，无需组件暴露）。

- [ ] **Step 2: 跑测试确认失败 → 实现组件**（约 150 行）
- `const question = useMemo(() => pickFallacyQuestion(engineLevel as 1|2|3, rng), ...)`
- 状态：`pickedSentenceId: number | null`、`pickedType: string | null`、`attempts`、`ended`
- UI：标题 + 材料逐句渲染（每句一个可点卡片，选中 `ring-2 ring-primary`）；谬误类型 8 chips 网格（`FALLACY_TYPES`）；「提交答案」（未选全禁用）
- 判定：`judgeFallacy(question, pickedSentenceId, pickedType)`，`correct = locatedCorrectly && classifiedCorrectly`；答错时给出提示文案「定位错」或「类型错」（不揭示具体答案，否则同一题 3 次机会形同虚设——只提示哪一步错了）
- 结束后：揭示正确句子与类型 + 展示 `question.explanation`

- [ ] **Step 3: 页面 + 注册**（`engineLevels={{ easy: [1, 1], medium: [2, 2], hard: [3, 3] }}`，route `games/fallacy`）

- [ ] **Step 4: 验证 + Commit** — `git commit -m "feat: 找谬误自由练习"`

---

### Task 10: 逻辑门（gates，含 elkjs 电路图）

**Files:**
- Modify: `brain-train/package.json`（+`elkjs`）
- Create: `brain-train/src/lib/logic/gatesLayout.ts`（移植 + 改 import）
- Create: `brain-train/src/components/game/GatesDiagram.tsx`（移植 + 换皮）
- Create: `brain-train/src/components/game/GatesGame.tsx`
- Create: `brain-train/src/pages/games/Gates.tsx`
- Modify: `brain-train/src/App.tsx`
- Test: `brain-train/tests/unit/gatesLayout.test.ts`（移植自 `E:/logic/web/src/lib/gatesLayout.test.ts`）

**Interfaces:**
- Consumes: `generateGatesCircuit`、`evaluateCircuit`、`GatesCircuit`（Task 1）
- Produces: `GatesDiagram({ circuit: GatesCircuit })`（纯展示）；`GatesGame(props: LogicRoundProps)`

- [ ] **Step 1: 装依赖 + 移植布局层**

```bash
cd /d/BrainTrain/brain-train
npm i elkjs
cp /e/logic/web/src/lib/gatesLayout.ts src/lib/logic/gatesLayout.ts
```

改 `src/lib/logic/gatesLayout.ts` 头部两处 import：
- `import ELK from 'elkjs'` → `import ELK from 'elkjs/lib/elk.bundled.js'`（浏览器包，避免 node 版 worker 问题）
- `from '../types/index.js'` → `from './gatesEngine'`

移植其测试：`cp /e/logic/web/src/lib/gatesLayout.test.ts tests/unit/gatesLayout.test.ts`，import 路径同步改 `@/lib/logic/...`，跑通。

- [ ] **Step 2: 移植并换皮 GatesDiagram**

`cp /e/logic/web/src/components/GatesDiagram.tsx src/components/game/GatesDiagram.tsx`，然后换皮（这是"视觉一致"的核心工作）：
- 删掉 `.dark` 相关逻辑与 `--color-gate-*`/`--color-signal` 霓虹变量引用
- 走线：`stroke` 用 `currentColor` + 容器 `text-muted-foreground`；通电（值为 true）的线用 `text-primary`
- 门体：`fill` 用 surface 色（`fill="var(--color-surface)"` 或直接 Tailwind `fill-surface` 类），边框 `stroke-border`；门类型文字 `fill-foreground font-headline`
- 输入位圆点：true=`fill-primary`、false=`fill-muted`
- 输出端：未作答=中性，答对=`text-success` 脉冲、答错=`text-red-500` 脉冲（动画用 Tailwind `animate-pulse`，不引 BrainLogic 的 keyframes）
- 保留 elkjs 布局调用与 `gates-enter` 类名之外的 BrainLogic 动画类全部移除

- [ ] **Step 3: 实现 GatesGame**（约 120 行）
- `const circuit = useMemo(() => generateGatesCircuit(engineLevel, rng), ...)`
- 电路图懒加载：`const GatesDiagram = lazy(() => import('./GatesDiagram'))` + `<Suspense fallback={<div className="h-64 animate-pulse bg-surface-container rounded-2xl" />}>`
- 题干：「所有输入如图所示，输出是 0 还是 1？」两个大按钮「0」「1」
- 判定：选择 === `evaluateCircuit(circuit)`；对/错处理同前；结束后在图上高亮正确输出

- [ ] **Step 4: 页面 + 注册**（`engineLevels={{ easy: [1, 6], medium: [7, 13], hard: [14, 20] }}`，route `games/gates`；gates[] 条目 description `'规则推演训练'`）

- [ ] **Step 5: 验证 + Commit**

```bash
npx tsc --noEmit
npm test -- --run tests/unit/gatesLayout.test.ts
npm run build   # 确认 elkjs 被打成独立 chunk、主包不胀
git add -A && git commit -m "feat: 逻辑门自由练习（elkjs 电路图换皮 Stitch 体系）"
```

---

### Task 11: 主线闯关集成（6 游戏 × 10 关）

**Files:**
- Modify: `brain-train/src/types/quest.ts:5`（GameId）、`:107`（GAME_IDS）+ 新增 `LogicPuzzleDifficultyParams`
- Modify: `brain-train/src/lib/questGameConfig.ts`（6 张难度表 + DIFFICULTY_TABLES）
- Modify: `brain-train/src/lib/questEngine.ts:12`（createInitialProgress）
- Modify: `brain-train/src/db/index.ts`（Dexie v6 迁移）
- Create: `brain-train/src/components/quest/QuestLogicRunner.tsx`（Runner 工厂）
- Modify: `brain-train/src/components/quest/QuestRunner.tsx:18-23`（RUNNERS）
- Modify: `brain-train/src/components/quest/QuestHub.tsx:5-10`、`:28`（GAME_NAMES + 总关数）
- Modify: `brain-train/src/components/quest/QuestHUD.tsx:4`（GAME_NAMES）
- Modify: `brain-train/src/components/quest/QuestResultDialog.tsx:18-23`（GAME_NAMES）
- Modify: `brain-train/src/App.tsx:141`（40 关 → 100 关文案）
- Test: `brain-train/tests/unit/QuestLogicRunner.test.tsx`、`brain-train/tests/unit/questEngineLogic.test.ts`

**Interfaces:**
- Consumes: 全部 6 个 `*Game` 组件（Task 5-10）、`starsForAttempts`/`LogicRoundOutcome`（Task 2）、`LogicRoundProps`（Task 4）
- Produces:
  - `LogicPuzzleDifficultyParams { engineLevel: number }`（找谬误的 engineLevel = 题库难度 1-3）
  - `makeLogicRunner(gameId: GameId, Component: React.ComponentType<LogicRoundProps>): React.FC<RunnerProps>`
  - `GAME_IDS` 含 10 个游戏

- [ ] **Step 1: 扩展 quest 类型与 GAME_IDS**

`types/quest.ts`：

```ts
export type GameId =
  | 'schulte' | 'sequence' | 'stroop' | 'bottle'
  | 'gates' | 'truth' | 'lineup' | 'syllogism' | 'zebra' | 'fallacy';

/** 逻辑谜题关卡参数：引擎难度（1-20；找谬误为题库难度 1-3） */
export interface LogicPuzzleDifficultyParams {
  engineLevel: number;
}
```

`GAME_IDS` 改为：

```ts
/** 10 个游戏的 id 列表（引擎迭代用） */
export const GAME_IDS: readonly GameId[] = [
  'schulte', 'sequence', 'stroop', 'bottle',
  'gates', 'truth', 'lineup', 'syllogism', 'zebra', 'fallacy',
] as const;
```

- [ ] **Step 2: 6 张闯关难度表**

`questGameConfig.ts` 追加（`goodThreshold/excellentThreshold` 对逻辑游戏无意义——尝试次数制在 Runner 内评星，这里填占位 2/3 满足类型）：

```ts
import type { LogicPuzzleDifficultyParams } from '@/types/quest';

// 尝试次数制评星在 QuestLogicRunner 内完成，thresholds 仅为类型占位
const L = (difficulty: number, engineLevel: number): DifficultyLevel<LogicPuzzleDifficultyParams> =>
  ({ difficulty, params: { engineLevel }, goodThreshold: 2, excellentThreshold: 3 });

// 逻辑门：engineLevel = 门数量，1-20 取 10 个点
export const GATES_DIFFICULTIES = [L(1, 1), L(2, 2), L(3, 3), L(4, 5), L(5, 7), L(6, 9), L(7, 11), L(8, 13), L(9, 16), L(10, 20)];
// 真假岛：engineLevel = 岛民数，只有 3-6，低级重复 3 人但陈述类型逐步解锁
export const TRUTH_DIFFICULTIES = [L(1, 3), L(2, 3), L(3, 4), L(4, 4), L(5, 5), L(6, 5), L(7, 5), L(8, 6), L(9, 6), L(10, 6)];
// 排排坐 / 说得通吗 / 左邻右舍：1-20 等距取 10 点
export const LINEUP_DIFFICULTIES = [L(1, 1), L(2, 3), L(3, 5), L(4, 7), L(5, 9), L(6, 11), L(7, 13), L(8, 15), L(9, 17), L(10, 20)];
export const SYLLOGISM_DIFFICULTIES = LINEUP_DIFFICULTIES;
export const ZEBRA_DIFFICULTIES = LINEUP_DIFFICULTIES;
// 找谬误：题库难度 1/2/3
export const FALLACY_DIFFICULTIES = [L(1, 1), L(2, 1), L(3, 1), L(4, 2), L(5, 2), L(6, 2), L(7, 2), L(8, 3), L(9, 3), L(10, 3)];
```

`DIFFICULTY_TABLES` 追加 6 个键（`gates: GATES_DIFFICULTIES` 等）。

注意：三个游戏共用 `LINEUP_DIFFICULTIES` 引用是只读常量复用，安全；若有人后续要分化难度再拆开。

- [ ] **Step 3: createInitialProgress + Dexie v6 迁移**

`questEngine.ts` 的 `progress` 改为：

```ts
progress: { schulte: 0, sequence: 0, stroop: 0, bottle: 0, gates: 0, truth: 0, lineup: 0, syllogism: 0, zebra: 0, fallacy: 0 },
```

`db/index.ts` 在 v5 之后追加（老存档补 6 个 0 键，星级记录不受影响）：

```ts
// v6: 主线闯关新增 6 个逻辑游戏，老存档 progress 补零键
this.version(6).stores({
  userProfile: 'id',
  trainingRecords: 'id, mode, startedAt, [mode+startedAt]',
  dailyGoals: 'date',
  schulteQuestProgress: 'id',
  questProgress: 'id',
  versusAuth: 'id',
}).upgrade(async (tx) => {
  const rec = await tx.table('questProgress').get('singleton');
  if (!rec) return;
  for (const g of ['gates', 'truth', 'lineup', 'syllogism', 'zebra', 'fallacy']) {
    if (rec.progress[g] === undefined) rec.progress[g] = 0;
  }
  await tx.table('questProgress').put(rec);
});
```

- [ ] **Step 4: Runner 工厂 + 注册**

`src/components/quest/QuestLogicRunner.tsx`：

```tsx
// 逻辑谜题闯关 Runner 工厂：单题、最多 3 次作答、尝试次数制评星
import { getDifficulty } from '@/lib/questGameConfig';
import { starsForAttempts, type LogicRoundOutcome } from '@/lib/logic/attempts';
import type { LogicRoundProps } from '@/components/game/LogicSessionShell';
import type { GameId, LogicPuzzleDifficultyParams, QuestResult } from '@/types/quest';
import type { RunnerProps } from './QuestRunner';

export function makeLogicRunner(
  gameId: GameId,
  Component: React.ComponentType<LogicRoundProps>,
): React.FC<RunnerProps> {
  return function LogicQuestRunner({ difficulty, onComplete }: RunnerProps) {
    const level = getDifficulty(gameId, difficulty);
    const { engineLevel } = level.params as LogicPuzzleDifficultyParams;

    const handleRoundEnd = (o: LogicRoundOutcome) => {
      const stars = o.correct ? starsForAttempts(o.attempts) : 0;
      const result: QuestResult = {
        gameId,
        difficulty,
        passed: o.correct,              // 3 次全错 = 闯关失败，重挑本关
        stars,
        score: o.correct ? Math.round((stars / 3) * 100) : 0,
        details: { engineLevel, correct: o.correct, attempts: o.attempts },
      };
      onComplete(result);
    };

    return <Component engineLevel={engineLevel} isActive={true} onRoundEnd={handleRoundEnd} />;
  };
}
```

`QuestRunner.tsx` 的 RUNNERS 追加：

```ts
import { makeLogicRunner } from './QuestLogicRunner';
import { GatesGame } from '@/components/game/GatesGame';
import { TruthGame } from '@/components/game/TruthGame';
import { LineupGame } from '@/components/game/LineupGame';
import { SyllogismGame } from '@/components/game/SyllogismGame';
import { ZebraGame } from '@/components/game/ZebraGame';
import { FallacyGame } from '@/components/game/FallacyGame';

// RUNNERS 内追加：
  gates: makeLogicRunner('gates', GatesGame),
  truth: makeLogicRunner('truth', TruthGame),
  lineup: makeLogicRunner('lineup', LineupGame),
  syllogism: makeLogicRunner('syllogism', SyllogismGame),
  zebra: makeLogicRunner('zebra', ZebraGame),
  fallacy: makeLogicRunner('fallacy', FallacyGame),
```

- [ ] **Step 5: 大厅/HUD/结算弹窗/首页文案**

`QuestHub.tsx`、`QuestHUD.tsx`、`QuestResultDialog.tsx` 三处的 `GAME_NAMES` 改为：

```ts
import { LOGIC_GAME_NAMES } from '@/types';
const GAME_NAMES: Record<GameId, string> = {
  schulte: '舒尔特表',
  sequence: '序列记忆',
  stroop: '字色干扰',
  bottle: '暗瓶排列',
  ...LOGIC_GAME_NAMES,
};
```

`QuestHub.tsx:28` 的 `已完成 {totalCleared}/40 关` 改为 `已完成 {totalCleared}/{GAME_IDS.length * 10} 关`。
`App.tsx:141` 文案改为 `10 个游戏随机串联，由易到难，100 关挑战`。

- [ ] **Step 6: 写测试**

`tests/unit/questEngineLogic.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { createInitialProgress, pickNextGame, isCleared } from '@/lib/questEngine';
import { GAME_IDS } from '@/types/quest';
import { DIFFICULTY_TABLES, getDifficulty } from '@/lib/questGameConfig';

describe('闯关集成 10 游戏', () => {
  it('GAME_IDS 10 个，初始进度全 0', () => {
    expect(GAME_IDS).toHaveLength(10);
    const p = createInitialProgress();
    expect(Object.keys(p.progress)).toHaveLength(10);
    expect(isCleared(p)).toBe(false);
    expect(pickNextGame(p)).not.toBeNull();
  });
  it('每个游戏都有 10 级难度表且 engineLevel 在界', () => {
    for (const g of GAME_IDS) {
      expect(DIFFICULTY_TABLES[g]).toHaveLength(10);
    }
    expect((getDifficulty('truth', 10).params as { engineLevel: number }).engineLevel).toBe(6);
    expect((getDifficulty('gates', 10).params as { engineLevel: number }).engineLevel).toBe(20);
    expect((getDifficulty('fallacy', 8).params as { engineLevel: number }).engineLevel).toBe(3);
  });
});
```

`tests/unit/QuestLogicRunner.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeLogicRunner } from '@/components/quest/QuestLogicRunner';
import type { LogicRoundProps } from '@/components/game/LogicSessionShell';
import type { QuestResult } from '@/types/quest';

// 假组件：点按钮即按预设结果结束本 round
function FakeGame({ onRoundEnd }: LogicRoundProps) {
  return <button onClick={() => onRoundEnd({ correct: true, attempts: 2 })}>done</button>;
}

describe('makeLogicRunner', () => {
  it('第二次答对：passed + 2 星 + score 67', () => {
    const onComplete = vi.fn();
    const Runner = makeLogicRunner('syllogism', FakeGame);
    render(<Runner difficulty={5} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('done'));
    const r = onComplete.mock.calls[0][0] as QuestResult;
    expect(r).toMatchObject({ gameId: 'syllogism', difficulty: 5, passed: true, stars: 2, score: 67 });
  });
});
```

- [ ] **Step 7: 验证 + Commit**

```bash
cd /d/BrainTrain/brain-train
npx tsc --noEmit
npm test -- --run tests/unit/questEngineLogic.test.ts tests/unit/QuestLogicRunner.test.tsx
npm test -- --run   # 全量单测，修复任何残留 4 游戏假设（如旧 quest 测试断言 progress 恰为 4 键）
git add -A && git commit -m "feat: 6 个逻辑游戏接入主线闯关（10 游戏 × 10 关）"
```

---

### Task 12: 全量验证与 PR

**Files:** 无新增（验证 + 提交流程）

- [ ] **Step 1: 静态与单测全绿**

```bash
cd /d/BrainTrain/brain-train
npx tsc --noEmit
npm run lint        # 有未用 import/变量就清掉
npm test -- --run
npm run build       # 确认构建通过；确认 elkjs 独立 chunk
```

- [ ] **Step 2: 人工冒烟清单**（`npm run dev`，逐项过）

- 首页 10 张游戏卡，6 张新卡图标/配色正确；点进 6 个新页面，规则弹窗首进自动弹出
- 每个游戏自由练习完整玩一局（5 题）：答错扣机会、3 次全错进下一题、结算分/首对率合理、训练记录入 IndexedDB（DevTools → Application → IndexedDB → trainingRecords）
- 统计页：新模式名称/图标正常显示
- 主线闯关：大厅显示 10 游戏进度行、「已完成 x/100 关」；能抽到逻辑游戏关卡；3 次全错 → 「再次挑战本关」；答对按次数评星；旧存档（如有）加载不炸、新游戏从 0 开始
- 逻辑门：电路图懒加载（Network 面板 elkjs chunk 按需）、浅色主题下走线/门体可读、移动端不溢出版心
- 暗色模式下 6 个新页面无违和（globals.css 的 `html.dark` 重映射应自动生效）

- [ ] **Step 3: 推送 + 建 PR**

```bash
cd /d/BrainTrain
git push -u origin feat/logic-games-solo
gh pr create --base main --title "feat: 移植 BrainLogic 6 个逻辑谜题游戏（单人部分）" --body "$(cat <<'EOF'
## 概要
BrainLogic（E:/logic）6 个逻辑谜题游戏移植进 BrainTrain，接入自由练习 + 主线闯关。
决策记录：docs/adr/0001-brainlogic-port.md；词汇表：CONTEXT.md。

## 内容
- 引擎原样移植到 src/lib/logic/（gates/truth/lineup/syllogism/zebra/fallacy + 31 题谬误题库）
- 尝试次数制计分（3 次机会，1/2/3 次对 = 3/2/1 星），谜题不限时
- 自由练习：LogicSessionShell 统一会话外壳，三档难度，5 题一局
- 主线闯关：10 游戏 × 10 关 = 100 关，QuestLogicRunner 工厂适配
- 逻辑门 elkjs 电路图换皮 Stitch 浅色体系（懒加载独立 chunk）
- Dexie v6：老闯关存档补 6 个零键

## 未做（PR2 范围）
- 多人对战形态（服务端引擎 + 房间选档）

## 验证
- tsc / lint / vitest 全绿；6 游戏自由练习与闯关人工冒烟通过
EOF
)"
```

---

## Self-Review 记录

- **Spec 覆盖**：6 游戏（T5-T10）、自由练习三档（T4 外壳）、闯关 10 关尝试次数制（T11）、视觉换皮（T10 + Global Constraints）、题库原样（T1）、丢 XP（无任务=正确）、双 PR 之 PR1 范围（T12 声明 PR2 除外）。BrainLogic 退役/弃域名/弃数据属运维动作，不在本代码计划内。
- **已知留白**：zebra 组件的问题文案（question→中文问句）在 T8 Step 3 只给了选项规则，问句文案极短（「谁养{pet}？」等 3 种），实现时顺手写；QuestResultDialog 对逻辑游戏无专属错题对比块——通用星级区已够用，details 里存了 attempts 供日后扩展。
- **类型一致性**：`LogicRoundProps`（T4 产）被 T5-T11 全部消费；`LogicPuzzleDifficultyParams`（T11 产）与工厂内 `as` 断言一致；`LOGIC_GAME_NAMES`（T3 产）在 T11 三处 GAME_NAMES 复用。
