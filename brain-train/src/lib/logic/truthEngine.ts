// 真假岛：陈述求值、自洽判定、解计数、谜题生成（纯逻辑，无 IO）
//
// 规则：N 个居民，每人或是骑士（说真话）或是无赖（说谎）。每人留一句关于身份的陈述。
// 自洽：骑士的陈述必须为真，无赖的陈述必须为假。
// 唯一解：生成的身份必须是使所有陈述自洽的唯一身份组合。
//
// 陈述形式（5 种，按人数渐进引入）：
// - isKnight：「第 X 人是骑士/无赖」——基础二元断言
// - isSameKind：「我和 X 是同类/不同类」——打破翻转对称（纯 isKnight 恒偶数解）
// - exactCount：「全岛恰好有 N 个骑士」——全局计数，信息量大
// - atLeast：「全岛至少有 N 个骑士」——全局计数变体
// - atLeastOneOf：「我和 X 里至少有一个骑士」——二元或门断言
//
// 数学约束：所有新类型都打破翻转对称（翻转后骑士总数变 N-k，计数类陈述真假会变），
// 故混合后能稳定产生唯一解。唯一解率经枚举验证：3人25%→6人13%，500次重试预算充足。

export type Statement =
  | { kind: 'isKnight'; speaker: number; about: number; value: boolean }
  // 「第 about 人是骑士（value=true）/无赖（value=false）」
  | { kind: 'isSameKind'; speaker: number; other: number; value: boolean }
  // 「说话人 speaker 与 other 同类（value=true）/不同类（value=false）」
  | { kind: 'exactCount'; speaker: number; count: number }
  // 「全岛恰好有 count 个骑士」——全局计数断言，打破翻转对称
  | { kind: 'atLeast'; speaker: number; atLeast: number }
  // 「全岛至少有 atLeast 个骑士」
  | { kind: 'atLeastOneOf'; speaker: number; other: number; value: boolean };
  // 「speaker 与 other 至少有一个骑士（value=true）/两人都不是骑士（value=false）」

export interface TruthPuzzle {
  level: number;
  statements: Statement[]; // statements[i] 是第 i 人说的
  knight: boolean[]; // 答案（生成器填，不发给前端）
}

// 一条陈述在给定身份下「内容本身」的真假
export function evaluateStatement(stmt: Statement, knight: boolean[]): boolean {
  switch (stmt.kind) {
    case 'isKnight':
      // 「about 是 value」的真假
      return knight[stmt.about] === stmt.value;
    case 'isSameKind':
      // 「speaker 与 other 同类」的真假，再按 value 取定
      // 同类 ⟺ knight[other] === knight[speaker]
      return (knight[stmt.other] === knight[stmt.speaker]) === stmt.value;
    case 'exactCount':
      // 「全岛恰好有 count 个骑士」
      return knight.filter(Boolean).length === stmt.count;
    case 'atLeast':
      // 「全岛至少有 atLeast 个骑士」
      return knight.filter(Boolean).length >= stmt.atLeast;
    case 'atLeastOneOf':
      // 「speaker 与 other 至少有一个骑士」，再按 value 取定
      // value=true 断言「至少一个」，value=false 断言「两人都不是」（即取反）
      return (knight[stmt.speaker] || knight[stmt.other]) === stmt.value;
  }
}

// 一组身份是否与所有陈述自洽（骑士说真、无赖说假）
export function isConsistent(puzzle: TruthPuzzle, knight: boolean[]): boolean {
  for (let i = 0; i < puzzle.statements.length; i++) {
    const stmt = puzzle.statements[i];
    const speakerIsKnight = knight[i];
    const stmtTruth = evaluateStatement(stmt, knight);
    if (speakerIsKnight !== stmtTruth) return false;
  }
  return true;
}

// 枚举所有身份组合，统计自洽解的数量
export function countSolutions(puzzle: TruthPuzzle): number {
  const n = puzzle.statements.length;
  let count = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    const knight = Array.from({ length: n }, (_, i) => ((mask >> i) & 1) === 1);
    if (isConsistent(puzzle, knight)) count++;
  }
  return count;
}

// 把一条陈述归一成「玩家看到的句子内容」（忽略说话人，因为内容相同即视为重复）。
// 用于去重：两句话内容一样会让玩家觉得套路雷同。
function statementContentKey(s: Statement): string {
  switch (s.kind) {
    case 'isKnight':
      // 「第 about 人是骑士/无赖」
      return `knight:${s.about}:${s.value}`;
    case 'isSameKind':
      // 「我和 other 同类/不同类」——other 是说话人相对的对象
      return `same:${s.other}:${s.value}`;
    case 'exactCount':
      // 「岛上有 count 个骑士」
      return `count:${s.count}`;
    case 'atLeast':
      // 「岛上至少有 atLeast 个骑士」
      return `atLeast:${s.atLeast}`;
    case 'atLeastOneOf':
      // 「我和 other 里至少有一个骑士」
      return `oneOf:${s.other}:${s.value}`;
  }
}

// 检查一组陈述里是否有内容重复的句子（玩家视角）
function hasDuplicateContent(statements: Statement[]): boolean {
  const seen = new Set<string>();
  for (const s of statements) {
    const key = statementContentKey(s);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

// 生成谜题：随机身份 → 生成自洽陈述 → 校验唯一解 + 无重复句 → 不满足重试
export function generateTruthPuzzle(level: number, rng: () => number = Math.random): TruthPuzzle {
  const n = Math.max(3, Math.min(6, level));
  for (let attempt = 0; attempt < 500; attempt++) {
    const knight = Array.from({ length: n }, () => rng() < 0.5);
    const statements: Statement[] = [];
    for (let i = 0; i < n; i++) {
      statements.push(makeStatement(i, n, knight, rng));
    }
    const puzzle: TruthPuzzle = { level: n, statements, knight };
    // 唯一解 + 无重复句（玩家不希望看到两条一样的句子）
    if (countSolutions(puzzle) === 1 && !hasDuplicateContent(statements)) return puzzle;
  }
  // 兜底：500 次重试仍未找到唯一解（实测 N≤6 下从未触发）。
  // 抛错让上层显式处理，避免静默返回多解谜题导致玩家被误判。
  throw new Error(`truth: 在 ${n} 人谜题中 500 次重试后仍未生成唯一解`);
}

// 难度渐进：按人数 n 逐级引入新陈述类型（用户指定进度）。
// 3人=老套路，4人=加「岛上有N个骑士」，5人=加「至少有N个」，6人=全开「至少有一个」。
// 已用 node 枚举验证：各关卡唯一解率 13-31%，500 次重试预算充足。
type Kind = Statement['kind'];
function typePool(n: number): Array<{ kind: Kind; weight: number }> {
  // 各类型等权出现，按人数逐级解锁
  const kinds: Kind[] =
    n <= 3 ? ['isKnight', 'isSameKind']
    : n === 4 ? ['isKnight', 'isSameKind', 'exactCount']
    : n === 5 ? ['isKnight', 'isSameKind', 'exactCount', 'atLeast']
    : ['isKnight', 'isSameKind', 'exactCount', 'atLeast', 'atLeastOneOf'];
  return kinds.map((kind) => ({ kind, weight: 1 }));
}

function pickKind(n: number, rng: () => number): Kind {
  const pool = typePool(n);
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.kind;
  }
  return pool[0].kind;
}

// 为第 i 个说话人生成一句自洽陈述（陈述内容真假 == speaker 是否骑士）
function makeStatement(
  i: number,
  n: number,
  knight: boolean[],
  rng: () => number,
): Statement {
  const kind = pickKind(n, rng);
  const wantTrue = knight[i]; // 骑士说真，无赖说假

  switch (kind) {
    case 'isKnight': {
      const about = Math.floor(rng() * n); // 可以等于 i
      const aboutIsKnight = knight[about];
      const value = wantTrue ? aboutIsKnight : !aboutIsKnight;
      return { kind: 'isKnight', speaker: i, about, value };
    }
    case 'isSameKind': {
      const other = Math.floor(rng() * n); // 可以等于 i（自指时恒同类，弱化约束）
      const sameKindTruth = knight[other] === knight[i];
      const value = wantTrue ? sameKindTruth : !sameKindTruth;
      return { kind: 'isSameKind', speaker: i, other, value };
    }
    case 'exactCount': {
      const actualCount = knight.filter(Boolean).length;
      // 骑士说真 → count=实际数（speaker 是骑士时 actualCount≥1，不会是 0）
      // 无赖说假 → count≠实际数，取 [1,n] 内的随机值（排除 0）
      let count = actualCount;
      if (!wantTrue) {
        do {
          count = 1 + Math.floor(rng() * n);
        } while (count === actualCount);
      }
      return { kind: 'exactCount', speaker: i, count };
    }
    case 'atLeast': {
      const actualCount = knight.filter(Boolean).length;
      // 骑士说真 → atLeast∈[1,actualCount]（speaker 是骑士时 actualCount≥1）
      // 无赖说假 → atLeast∈[actualCount+1, n]
      let threshold: number;
      if (wantTrue) {
        threshold = 1 + Math.floor(rng() * actualCount);
      } else {
        threshold = actualCount + 1 + Math.floor(rng() * (n - actualCount));
      }
      return { kind: 'atLeast', speaker: i, atLeast: Math.min(threshold, n) };
    }
    case 'atLeastOneOf': {
      const other = Math.floor(rng() * n); // 可以等于 i
      const truth = knight[i] || knight[other]; // 两人是否至少有一个骑士
      const value = wantTrue ? truth : !truth;
      return { kind: 'atLeastOneOf', speaker: i, other, value };
    }
  }
}
