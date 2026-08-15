// 真假岛陈述文案：把引擎的抽象陈述翻译成小白能懂的人话。
// 函数体移植自 E:/logic/web/src/pages/Truth.tsx（类型名 TruthStatement → 引擎的 Statement）。
import type { Statement } from './truthEngine';

// 一条陈述转成「自然口语」的引号内容（不含"第X人说"前缀，前缀在 UI 单独渲染）。
// 把 engine 的抽象形式翻译成小白能懂的人话。
export function statementText(s: Statement): string {
  switch (s.kind) {
    case 'isKnight':
      // value=true: "X 是骑士"；value=false: "X 是无赖"
      if (s.about === s.speaker) {
        // 自指："我是骑士 / 我是无赖"——经典悖论式断言
        return s.value ? '我是骑士' : '我是无赖';
      }
      return `第 ${s.about + 1} 人是${s.value ? '骑士' : '无赖'}`;
    case 'isSameKind':
      // 同类 = 两人都骑士、或都无赖；不同类 = 一骑士一无赖
      if (s.other === s.speaker) {
        // 自指：speaker 和自己永远同类。
        // value=true → 恒真陈述 → 只有骑士会这么说
        // value=false → 恒假陈述（"我和自己不同类"）→ 只有无赖会这么说
        return s.value ? '我和自己是同一类' : '我和自己不是同一类';
      }
      return s.value
        ? `我和第 ${s.other + 1} 人是同一类`
        : `我和第 ${s.other + 1} 人不是同一类`;
    case 'exactCount':
      // 全局断言：说话人对全岛骑士总数的判断
      return `岛上一共有 ${s.count} 个骑士`;
    case 'atLeast':
      return `岛上至少有 ${s.atLeast} 个骑士`;
    case 'atLeastOneOf':
      // speaker 与 other 至少有一个骑士
      if (s.other === s.speaker) {
        // 自指："我和我至少有一个骑士" ⟺ "我是骑士"
        return s.value ? '我是骑士' : '我是无赖';
      }
      return s.value
        ? `我和第 ${s.other + 1} 人里，至少有一个是骑士`
        : `我和第 ${s.other + 1} 人都不是骑士`;
  }
}
