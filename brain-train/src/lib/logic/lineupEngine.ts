// 排排坐：排序约束推理（纯逻辑，无 IO）
//
// 规则：N 个人排成一列（位置 1..N），给若干条全部成立的线索，解唯一。
// 生成：随机排列 → 候选线索库（所有成立的线索）→ 贪心加线索到唯一解 → 冗余精简。

export type LineupClue =
  | { kind: 'at'; person: number; pos: number }        // X 在第 k 位
  | { kind: 'notAt'; person: number; pos: number }     // X 不在第 k 位
  | { kind: 'before'; a: number; b: number }           // X 在 Y 前面（不相邻也可）
  | { kind: 'adjacent'; a: number; b: number }         // X 和 Y 挨着
  | { kind: 'adjacentLeft'; a: number; b: number }     // X 紧挨在 Y 左边
  | { kind: 'gap'; a: number; b: number; gap: number };// X 和 Y 中间隔 k 个人

export type LineupQuestion =
  | { kind: 'whoAt'; pos: number }      // 第 k 位是谁？
  | { kind: 'whereIs'; person: number };// X 在第几位？

export interface LineupPuzzle {
  level: number;
  people: string[];      // 名字，下标即 personId
  clues: LineupClue[];
  solution: number[];    // solution[posIdx] = personId（posIdx 0 基）
  question: LineupQuestion;
}

// 名字池：N ≤ 7
const NAME_POOL = ['小赵', '小钱', '小孙', '小李', '小周', '小吴', '小郑'];

// 关卡 → 人数：1-4 → 4 人；5-9 → 5 人；10-14 → 6 人；15-20 → 7 人
export function peopleCountForLevel(level: number): number {
  if (level <= 4) return 4;
  if (level <= 9) return 5;
  if (level <= 14) return 6;
  return 7;
}

// 关卡 → 解锁的线索类型（渐进）
function clueKindsForLevel(level: number): LineupClue['kind'][] {
  if (level <= 4) return ['at', 'notAt', 'before'];
  if (level <= 14) return ['at', 'notAt', 'before', 'adjacent', 'adjacentLeft'];
  return ['at', 'notAt', 'before', 'adjacent', 'adjacentLeft', 'gap'];
}

// posOf[person] = 位置（1 基）。线索是否成立
export function clueHolds(clue: LineupClue, posOf: number[]): boolean {
  switch (clue.kind) {
    case 'at': return posOf[clue.person] === clue.pos;
    case 'notAt': return posOf[clue.person] !== clue.pos;
    case 'before': return posOf[clue.a] < posOf[clue.b];
    case 'adjacent': return Math.abs(posOf[clue.a] - posOf[clue.b]) === 1;
    case 'adjacentLeft': return posOf[clue.a] + 1 === posOf[clue.b];
    case 'gap': return Math.abs(posOf[clue.a] - posOf[clue.b]) === clue.gap + 1;
  }
}

// 枚举 1..N 的全部排列（返回 posOf 形式的解计数用）
function eachPermutation(n: number, fn: (perm: number[]) => void): void {
  // perm[posIdx] = personId
  const used = new Array(n).fill(false);
  const cur: number[] = [];
  const dfs = () => {
    if (cur.length === n) { fn(cur.slice()); return; }
    for (let p = 0; p < n; p++) {
      if (used[p]) continue;
      used[p] = true;
      cur.push(p);
      dfs();
      cur.pop();
      used[p] = false;
    }
  };
  dfs();
}

// 满足全部线索的排列数
export function countLineupSolutions(n: number, clues: LineupClue[]): number {
  let count = 0;
  eachPermutation(n, (perm) => {
    const posOf = new Array(n);
    perm.forEach((person, idx) => { posOf[person] = idx + 1; });
    if (clues.every((c) => clueHolds(c, posOf))) count++;
  });
  return count;
}

// 对给定解成立的所有候选线索（按关卡类型过滤）
function candidateClues(n: number, posOf: number[], kinds: LineupClue['kind'][]): LineupClue[] {
  const out: LineupClue[] = [];
  for (let p = 0; p < n; p++) {
    if (kinds.includes('at')) out.push({ kind: 'at', person: p, pos: posOf[p] });
    if (kinds.includes('notAt')) {
      for (let pos = 1; pos <= n; pos++) {
        if (pos !== posOf[p]) out.push({ kind: 'notAt', person: p, pos });
      }
    }
  }
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      if (kinds.includes('before') && posOf[a] < posOf[b]) out.push({ kind: 'before', a, b });
      if (kinds.includes('adjacent') && a < b && Math.abs(posOf[a] - posOf[b]) === 1) out.push({ kind: 'adjacent', a, b });
      if (kinds.includes('adjacentLeft') && posOf[a] + 1 === posOf[b]) out.push({ kind: 'adjacentLeft', a, b });
      if (kinds.includes('gap')) {
        const d = Math.abs(posOf[a] - posOf[b]);
        if (a < b && d >= 2) out.push({ kind: 'gap', a, b, gap: d - 1 });
      }
    }
  }
  return out;
}

export function generateLineupPuzzle(level: number, rng: () => number = Math.random): LineupPuzzle {
  const lv = Math.max(1, Math.min(20, level));
  const n = peopleCountForLevel(lv);
  const kinds = clueKindsForLevel(lv);

  for (let attempt = 0; attempt < 300; attempt++) {
    // 随机解：posOf[p]
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // order[posIdx] = personId → posOf
    const posOf = new Array(n);
    order.forEach((person, idx) => { posOf[person] = idx + 1; });

    // 候选线索洗牌
    const cands = candidateClues(n, posOf, kinds);
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }

    // 贪心：只加能缩小解集的线索，直到唯一解
    const clues: LineupClue[] = [];
    let count = countLineupSolutions(n, clues);
    for (const c of cands) {
      const next = countLineupSolutions(n, [...clues, c]);
      if (next < count) {
        clues.push(c);
        count = next;
        if (count === 1) break;
      }
    }
    if (count !== 1) continue; // 重开排列

    // 冗余精简：能移除且解仍唯一的线索一律移除
    for (let i = clues.length - 1; i >= 0; i--) {
      const rest = clues.filter((_, j) => j !== i);
      if (countLineupSolutions(n, rest) === 1) clues.splice(i, 1);
    }

    // 问题：whoAt / whereIs 各半
    const question: LineupQuestion = rng() < 0.5
      ? { kind: 'whoAt', pos: 1 + Math.floor(rng() * n) }
      : { kind: 'whereIs', person: Math.floor(rng() * n) };

    return {
      level: lv,
      people: NAME_POOL.slice(0, n),
      clues,
      solution: order,
      question,
    };
  }
  throw new Error(`lineup: level ${lv} 在 300 次重试后仍未生成唯一解谜题`);
}
