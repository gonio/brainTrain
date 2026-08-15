// 左邻右舍：迷你斑马谜题（纯逻辑，无 IO）
//
// 规则：N 座房子排一排（1..N），每座住一人、养一宠物、喝一饮料，互不重复。
// 给若干条全部成立的线索，解唯一。
// 生成：随机分配 → 候选线索库 → 贪心加线索到唯一解 → 冗余精简。

export type ZebraClue =
  | { kind: 'bind'; a: string; b: string }              // 同一座房子（如 小王养猫）
  | { kind: 'at'; item: string; house: number }         // 在第 k 座
  | { kind: 'notAt'; item: string; house: number }      // 不在第 k 座
  | { kind: 'leftOf'; a: string; b: string }            // a 的房在 b 左边（不相邻也可）
  | { kind: 'nextTo'; a: string; b: string }            // 挨着
  | { kind: 'immediateLeft'; a: string; b: string };    // a 紧挨在 b 左边

export type ZebraQuestion =
  | { kind: 'whoHasPet'; pet: string }                  // 谁养 X？
  | { kind: 'whoDrinks'; drink: string }                // 谁喝 X？
  | { kind: 'whatAtHouse'; house: number; attr: 'pet' | 'drink' }; // 第 k 座养/喝什么？

export interface ZebraPuzzle {
  level: number;
  houses: number;
  people: string[];
  pets: string[];
  drinks: string[];
  clues: ZebraClue[];
  solution: Record<string, number>; // item → house（1 基），不下发
  question: ZebraQuestion;
}

const PERSON_POOL = ['小王', '小李', '小张', '小陈'];
const PET_POOL = ['猫', '狗', '鸟', '鱼'];
const DRINK_POOL = ['牛奶', '咖啡', '茶', '果汁'];

// 关卡 → 房子数：1-10 → 3；11-20 → 4
export function housesForLevel(level: number): number {
  return level <= 10 ? 3 : 4;
}

function clueKindsForLevel(level: number): ZebraClue['kind'][] {
  if (level <= 5) return ['bind', 'at', 'notAt'];
  if (level <= 10) return ['bind', 'at', 'notAt', 'leftOf', 'nextTo'];
  return ['bind', 'at', 'notAt', 'leftOf', 'nextTo', 'immediateLeft'];
}

export function zebraClueHolds(clue: ZebraClue, houseOf: Record<string, number>): boolean {
  switch (clue.kind) {
    case 'bind': return houseOf[clue.a] === houseOf[clue.b];
    case 'at': return houseOf[clue.item] === clue.house;
    case 'notAt': return houseOf[clue.item] !== clue.house;
    case 'leftOf': return houseOf[clue.a] < houseOf[clue.b];
    case 'nextTo': return Math.abs(houseOf[clue.a] - houseOf[clue.b]) === 1;
    case 'immediateLeft': return houseOf[clue.a] + 1 === houseOf[clue.b];
  }
}

// N 个物品分配到 N 座房子的全部排列，fn(houseOfPartial)
function eachAssignment(items: string[], n: number, fn: (assign: number[]) => void): void {
  const used = new Array(n + 1).fill(false);
  const cur: number[] = [];
  const dfs = () => {
    if (cur.length === items.length) { fn(cur.slice()); return; }
    for (let h = 1; h <= n; h++) {
      if (used[h]) continue;
      used[h] = true;
      cur.push(h);
      dfs();
      cur.pop();
      used[h] = false;
    }
  };
  dfs();
}

// 满足全部线索的分配数（枚举 人×宠物×饮料 全空间）
export function countZebraSolutions(
  p: Pick<ZebraPuzzle, 'houses' | 'people' | 'pets' | 'drinks'>,
  clues: ZebraClue[],
): number {
  const n = p.houses;
  let count = 0;
  eachAssignment(p.people, n, (pa) => {
    eachAssignment(p.pets, n, (pe) => {
      eachAssignment(p.drinks, n, (dr) => {
        const houseOf: Record<string, number> = {};
        p.people.forEach((it, i) => { houseOf[it] = pa[i]; });
        p.pets.forEach((it, i) => { houseOf[it] = pe[i]; });
        p.drinks.forEach((it, i) => { houseOf[it] = dr[i]; });
        if (clues.every((c) => zebraClueHolds(c, houseOf))) count++;
      });
    });
  });
  return count;
}

// 对给定解成立的所有候选线索（跨类组合 + 位置/相对关系）
function candidateClues(p: ZebraPuzzle, kinds: ZebraClue['kind'][]): ZebraClue[] {
  const all = [...p.people, ...p.pets, ...p.drinks];
  const category = (it: string) =>
    p.people.includes(it) ? 'person' : p.pets.includes(it) ? 'pet' : 'drink';
  const out: ZebraClue[] = [];
  for (const it of all) {
    if (kinds.includes('at')) out.push({ kind: 'at', item: it, house: p.solution[it] });
    if (kinds.includes('notAt')) {
      for (let h = 1; h <= p.houses; h++) {
        if (h !== p.solution[it]) out.push({ kind: 'notAt', item: it, house: h });
      }
    }
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      const a = all[i];
      const b = all[j];
      if (kinds.includes('bind') && i < j && category(a) !== category(b) && p.solution[a] === p.solution[b]) {
        out.push({ kind: 'bind', a, b });
      }
      if (kinds.includes('leftOf') && p.solution[a] < p.solution[b]) out.push({ kind: 'leftOf', a, b });
      if (kinds.includes('nextTo') && i < j && Math.abs(p.solution[a] - p.solution[b]) === 1) {
        out.push({ kind: 'nextTo', a, b });
      }
      if (kinds.includes('immediateLeft') && p.solution[a] + 1 === p.solution[b]) {
        out.push({ kind: 'immediateLeft', a, b });
      }
    }
  }
  return out;
}

export function generateZebraPuzzle(level: number, rng: () => number = Math.random): ZebraPuzzle {
  const lv = Math.max(1, Math.min(20, level));
  const n = housesForLevel(lv);
  const kinds = clueKindsForLevel(lv);

  for (let attempt = 0; attempt < 300; attempt++) {
    // 随机解
    const solution: Record<string, number> = {};
    const people = PERSON_POOL.slice(0, n);
    const pets = PET_POOL.slice(0, n);
    const drinks = DRINK_POOL.slice(0, n);
    for (const items of [people, pets, drinks]) {
      const houses = Array.from({ length: n }, (_, i) => i + 1);
      for (let i = houses.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [houses[i], houses[j]] = [houses[j], houses[i]];
      }
      items.forEach((it, i) => { solution[it] = houses[i]; });
    }
    const base: ZebraPuzzle = {
      level: lv, houses: n, people, pets, drinks,
      clues: [], solution, question: { kind: 'whoHasPet', pet: pets[0] },
    };

    // 候选线索洗牌
    const cands = candidateClues(base, kinds);
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }

    // 贪心到唯一解
    const clues: ZebraClue[] = [];
    let count = countZebraSolutions(base, clues);
    for (const c of cands) {
      const next = countZebraSolutions(base, [...clues, c]);
      if (next < count) {
        clues.push(c);
        count = next;
        if (count === 1) break;
      }
    }
    if (count !== 1) continue;

    // 冗余精简
    for (let i = clues.length - 1; i >= 0; i--) {
      const rest = clues.filter((_, j) => j !== i);
      if (countZebraSolutions(base, rest) === 1) clues.splice(i, 1);
    }

    // 问题：三种问法随机
    const r = rng();
    const question: ZebraQuestion =
      r < 0.4 ? { kind: 'whoHasPet', pet: pets[Math.floor(rng() * n)] }
      : r < 0.8 ? { kind: 'whoDrinks', drink: drinks[Math.floor(rng() * n)] }
      : {
          kind: 'whatAtHouse',
          house: 1 + Math.floor(rng() * n),
          attr: rng() < 0.5 ? 'pet' : 'drink',
        };

    return { ...base, clues, question };
  }
  throw new Error(`zebra: level ${lv} 在 300 次重试后仍未生成唯一解谜题`);
}
