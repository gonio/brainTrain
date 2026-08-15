// 左邻右舍线索文案 + 期望答案推导（移植自 BrainLogic web/src/pages/Zebra.tsx
// 与 server/src/games/zebra/zebraService.ts 判定逻辑，类型改用本地引擎）
import type { ZebraPuzzle, ZebraClue } from './zebraEngine';

// 物品显示名：人直呼其名，宠物/饮料加「养/喝…的人」
export function makeItemText(puzzle: ZebraPuzzle) {
  return (it: string): string => {
    if (puzzle.people.includes(it)) return it;
    if (puzzle.pets.includes(it)) return `养${it}的人`;
    return `喝${it}的人`;
  };
}

export function makeClueText(puzzle: ZebraPuzzle) {
  const itemText = makeItemText(puzzle);
  return (c: ZebraClue): string => {
    switch (c.kind) {
      case 'bind': return `${itemText(c.a)}和${itemText(c.b)}是同一座房子`;
      case 'at': return `${itemText(c.item)}在第 ${c.house} 座`;
      case 'notAt': return `${itemText(c.item)}不在第 ${c.house} 座`;
      case 'leftOf': return `${itemText(c.a)}在${itemText(c.b)}的左边`;
      case 'nextTo': return `${itemText(c.a)}和${itemText(c.b)}挨着`;
      case 'immediateLeft': return `${itemText(c.a)}紧挨在${itemText(c.b)}左边`;
    }
  };
}

/** 从谜题解推出问题的期望答案（与 BrainLogic 服务端判定逻辑一致） */
export function expectedZebraAnswer(p: ZebraPuzzle): string {
  const q = p.question;
  if (q.kind === 'whoHasPet') return p.people.find((x) => p.solution[x] === p.solution[q.pet])!;
  if (q.kind === 'whoDrinks') return p.people.find((x) => p.solution[x] === p.solution[q.drink])!;
  const items = q.attr === 'pet' ? p.pets : p.drinks;
  return items.find((it) => p.solution[it] === q.house)!;
}
