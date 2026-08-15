// 说得通吗：三段论形式有效性判断（纯逻辑，无 IO）
//
// 题库全手工精编：每条的 valid 指「推理形式是否有效」，与结论内容真假无关。
// 2×2 信念偏差配比：valid×conforming / valid×surprising / invalid×conforming / invalid×neutral，
// 保证「结论符合直觉但形式无效」「结论反直觉但形式有效」的陷阱题稳定出现。

export interface SylEntry {
  premises: [string, string];
  conclusion: string;
  valid: boolean;
  intuitive: 'conforming' | 'surprising' | 'neutral';
  tier: 1 | 2; // 1=全称式（低关卡）；2=含特称式
}

export interface SyllogismPuzzle {
  level: number;
  premises: [string, string];
  conclusion: string;
  valid: boolean; // 答案，不下发
}

export const SYLLOGISM_POOL: readonly SylEntry[] = [
  // ---- valid × conforming ----
  { tier: 1, valid: true, intuitive: 'conforming',
    premises: ['所有猫都是动物', '所有橘猫都是猫'],
    conclusion: '所有橘猫都是动物' },
  { tier: 1, valid: true, intuitive: 'conforming',
    premises: ['所有哺乳动物都不是鱼', '所有鲸鱼都是哺乳动物'],
    conclusion: '所有鲸鱼都不是鱼' },
  { tier: 2, valid: true, intuitive: 'conforming',
    premises: ['所有狗都是动物', '有些导盲犬是狗'],
    conclusion: '有些导盲犬是动物' },
  { tier: 2, valid: true, intuitive: 'conforming',
    premises: ['所有蝙蝠都不是鸟', '有些夜行动物是蝙蝠'],
    conclusion: '有些夜行动物不是鸟' },
  { tier: 1, valid: true, intuitive: 'conforming',
    premises: ['所有生活在水里的都不是鱼', '所有企鹅都生活在水里'],
    conclusion: '所有企鹅都不是鱼' },

  // ---- valid × surprising（前提可疑但形式有效，结论反直觉） ----
  { tier: 1, valid: true, intuitive: 'surprising',
    premises: ['所有会飞的都是鸟', '所有蝙蝠都会飞'],
    conclusion: '所有蝙蝠都是鸟' },
  { tier: 2, valid: true, intuitive: 'surprising',
    premises: ['所有穿白大褂的都是医生', '有些程序员穿白大褂'],
    conclusion: '有些程序员是医生' },
  { tier: 2, valid: true, intuitive: 'surprising',
    premises: ['所有鱼都不会飞', '有些飞鱼是鱼'],
    conclusion: '有些飞鱼不会飞' },

  // ---- invalid × conforming（结论符合直觉但形式无效：直觉陷阱） ----
  { tier: 1, valid: false, intuitive: 'conforming',
    premises: ['所有猫都是动物', '所有橘猫都是动物'],
    conclusion: '所有橘猫都是猫' },
  { tier: 2, valid: false, intuitive: 'conforming',
    premises: ['有些橘猫是猫', '所有猫都是动物'],
    conclusion: '所有橘猫都是动物' },
  { tier: 2, valid: false, intuitive: 'conforming',
    premises: ['所有健身教练都是早起的人', '有些早起的人喝咖啡'],
    conclusion: '有些健身教练喝咖啡' },
  { tier: 2, valid: false, intuitive: 'conforming',
    premises: ['有些大学生是爱运动的人', '有些爱运动的人是篮球队员'],
    conclusion: '有些大学生是篮球队员' },
  { tier: 1, valid: false, intuitive: 'conforming',
    premises: ['所有鸟都会飞', '所有企鹅都不是鸟'],
    conclusion: '所有企鹅都不会飞' },

  // ---- invalid × neutral/surprising ----
  { tier: 1, valid: false, intuitive: 'surprising',
    premises: ['所有狗都是动物', '所有猫都是动物'],
    conclusion: '所有猫都是狗' },
  { tier: 2, valid: false, intuitive: 'neutral',
    premises: ['所有演员都是明星', '有些群演不是演员'],
    conclusion: '有些群演不是明星' },
  { tier: 2, valid: false, intuitive: 'neutral',
    premises: ['所有鱼都不会飞', '有些飞鱼是鱼'],
    conclusion: '有些飞鱼会飞' },
];

// 2×2 格子定义（invalid 格 neutral/surprising 合并为一格）
type Cell = { valid: boolean; intuitive: SylEntry['intuitive'][] };
const CELLS: Cell[] = [
  { valid: true, intuitive: ['conforming'] },
  { valid: true, intuitive: ['surprising'] },
  { valid: false, intuitive: ['conforming'] },
  { valid: false, intuitive: ['neutral', 'surprising'] },
];

export function generateSyllogismPuzzle(level: number, rng: () => number = Math.random): SyllogismPuzzle {
  const lv = Math.max(1, Math.min(20, level));
  // 1-8 关只出全称式（tier 1），9 关起全量
  const pool = SYLLOGISM_POOL.filter((e) => (lv <= 8 ? e.tier === 1 : true));

  // 按格子加权随机：17 关起「直觉陷阱」格（invalid×conforming）权重 ×2
  const weighted = CELLS.map((cell, i) => ({
    cell,
    weight: lv >= 17 && i === 2 ? 2 : 1,
    entries: pool.filter((e) => e.valid === cell.valid && cell.intuitive.includes(e.intuitive)),
  })).filter((w) => w.entries.length > 0);

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  let chosen = weighted[0];
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) { chosen = w; break; }
  }
  const entry = chosen.entries[Math.floor(rng() * chosen.entries.length)];

  // 前提顺序随机（不影响有效性）
  const premises: [string, string] = rng() < 0.5
    ? [entry.premises[0], entry.premises[1]]
    : [entry.premises[1], entry.premises[0]];

  return { level: lv, premises, conclusion: entry.conclusion, valid: entry.valid };
}
