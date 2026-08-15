// 排排坐线索文案：把引擎的抽象线索翻译成人话。
// 函数体移植自 E:/logic/web/src/pages/Lineup.tsx（类型 LineupClue 改自 ./lineupEngine）。
import type { LineupClue } from './lineupEngine';

// 线索翻译成人话
export function clueText(c: LineupClue, people: string[]): string {
  switch (c.kind) {
    case 'at': return `${people[c.person]} 在第 ${c.pos} 位`;
    case 'notAt': return `${people[c.person]} 不在第 ${c.pos} 位`;
    case 'before': return `${people[c.a]} 在 ${people[c.b]} 前面`;
    case 'adjacent': return `${people[c.a]} 和 ${people[c.b]} 挨着`;
    case 'adjacentLeft': return `${people[c.a]} 紧挨在 ${people[c.b]} 左边`;
    case 'gap': return `${people[c.a]} 和 ${people[c.b]} 中间隔着 ${c.gap} 个人`;
  }
}
