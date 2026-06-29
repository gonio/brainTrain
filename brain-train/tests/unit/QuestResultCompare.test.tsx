// QuestResultDialog 错题对比区块回归测试
//
// 关卡完成后，结算页应按游戏类型给出错误对比：
//  - 舒尔特表：默认显示「错点 N 处」汇总，「显示错点明细」折叠展开后逐条「点了X / 应点Y」
//  - 记忆序列：两行逐位对比，错位标 ✗
//  - 字色干扰：逐题列出全部错题（你选/正确）
//  - 暗瓶：不出现对比区块
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestResultDialog } from '../../src/components/quest/QuestResultDialog';
import type { QuestResult } from '../../src/types/quest';

function makeResult(over: Partial<QuestResult>): QuestResult {
  return {
    gameId: 'schulte',
    difficulty: 1,
    passed: true,
    stars: 2,
    score: 100,
    details: {},
    ...over,
  } as QuestResult;
}

describe('QuestResultDialog - 错题对比', () => {
  describe('舒尔特表', () => {
    const result = makeResult({
      gameId: 'schulte',
      stars: 2,
      score: 90,
      details: {
        maxCombo: 8,
        errorCount: 3,
        errors: [
          { clicked: 7, expected: 3 },
          { clicked: 9, expected: 4 },
          { clicked: 2, expected: 5 },
        ],
      },
    });

    it('直接显示错点汇总 + 全部明细（点了X / 应点Y），无需展开', () => {
      render(<QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />);

      // 汇总
      expect(screen.getByText(/错点\s*3/)).toBeInTheDocument();
      // 明细直接展示（不再有展开按钮、默认收起）
      expect(screen.getByText(/点了\s*7/)).toBeInTheDocument();
      expect(screen.getByText(/点了\s*9/)).toBeInTheDocument();
      expect(screen.getByText(/点了\s*2/)).toBeInTheDocument();
      // 正确答案数字也在
      expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
      // 不再有展开按钮
      expect(screen.queryByRole('button', { name: /明细/ })).not.toBeInTheDocument();
    });
  });

  describe('记忆序列', () => {
    const result = makeResult({
      gameId: 'sequence',
      stars: 1,
      score: 60,
      details: {
        sequence: ['🐶', '🐱', '🐭', '🐹', '🐰'],
        userSequence: ['🐶', '🐭', '🐱', '🐹', '🐷'],
        positionAccuracy: 60,
        itemAccuracy: 80,
        hasDistractors: true,
      },
    });

    it('两行逐位对比：正确序列与用户序列都展示，错位有标记', () => {
      const { container } = render(
        <QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />,
      );

      // 正确序列的物品出现
      expect(screen.getAllByText('🐶').length).toBeGreaterThan(0);
      expect(screen.getAllByText('🐱').length).toBeGreaterThan(0);
      // 有错位标记（✗）—— 至少有错位（第2、3、5位错）
      const marks = container.querySelectorAll('[data-mismatch="true"]');
      expect(marks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('字色干扰', () => {
    // dual 模式：两道错题规则不同，验证每题规则都被标出
    const result = makeResult({
      gameId: 'stroop',
      stars: 2,
      score: 75,
      details: {
        questionCount: 8,
        correctCount: 6,
        accuracy: 75,
        errors: [
          // standard 题：要求选颜色，正确答案=显示色蓝色，用户选了字义红色→错
          { word: '红色', wordColor: '蓝色', userAnswer: '红色', correctAnswer: '蓝色', rule: 'standard' },
          // reverse 题：要求选字义，正确答案=字义绿色，用户选了显示色黄色→错
          { word: '绿色', wordColor: '黄色', userAnswer: '黄色', correctAnswer: '绿色', rule: 'reverse' },
        ],
      },
    });

    it('每题标明规则（选颜色/选字义），dual 模式下规则可不同', () => {
      render(<QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />);

      // 错题计数
      expect(screen.getByText(/错\s*2\s*题/)).toBeInTheDocument();

      // 第1题：要求选颜色（standard）
      expect(screen.getAllByText(/要求选颜色/).length).toBe(1);
      // 第2题：要求选字义（reverse）
      expect(screen.getAllByText(/要求选字义/).length).toBe(1);

      // 你选 / 正确 都在
      expect(screen.getAllByText(/你选：红色/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/正确：蓝色/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/正确：绿色/).length).toBeGreaterThan(0);
    });

    it('题面按原样呈现：文字内容=字义，文字颜色=显示色（与题目一致）', () => {
      const { container } = render(
        <QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />,
      );
      const wordEls = container.querySelectorAll('[data-role="stroop-word"]');
      expect(wordEls.length).toBe(2);

      // 第1题：字义"红色"、显示色蓝色 → 蓝色的"红色"二字（#3b82f6）
      expect(wordEls[0].textContent).toBe('红色');
      expect((wordEls[0] as HTMLElement).style.color).toMatch(/#3b82f6|rgb\(59,\s*130,\s*246\)/i);

      // 第2题：字义"绿色"、显示色黄色 → 黄色的"绿色"二字（#eab308）
      expect(wordEls[1].textContent).toBe('绿色');
      expect((wordEls[1] as HTMLElement).style.color).toMatch(/#eab308|rgb\(234,\s*179,\s*8\)/i);
    });

    it('规则标注颜色区分：选颜色=primary、选字义=orange', () => {
      const { container } = render(
        <QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />,
      );
      const labelEls = Array.from(container.querySelectorAll('span')).filter((s) =>
        /要求选颜色|要求选字义/.test(s.textContent ?? ''),
      );
      expect(labelEls.length).toBe(2);
      const pickColorLabel = labelEls.find((s) => s.textContent?.includes('选颜色'));
      const pickMeaningLabel = labelEls.find((s) => s.textContent?.includes('选字义'));
      expect(pickColorLabel?.className).toMatch(/primary/);
      expect(pickColorLabel?.className).not.toMatch(/orange/);
      expect(pickMeaningLabel?.className).toMatch(/orange/);
    });

    it('超时未选显示「（超时未选）」而非空', () => {
      const timeoutResult = makeResult({
        gameId: 'stroop',
        details: {
          questionCount: 5,
          correctCount: 4,
          accuracy: 80,
          errors: [
            { word: '紫色', wordColor: '红色', userAnswer: '', correctAnswer: '红色', rule: 'standard' },
          ],
        },
      });
      render(<QuestResultDialog result={timeoutResult} isCleared={false} onNext={() => {}} onHub={() => {}} />);
      expect(screen.getByText(/你选：.*超时未选/)).toBeInTheDocument();
    });
  });

  describe('暗瓶', () => {
    const result = makeResult({
      gameId: 'bottle',
      stars: 3,
      score: 100,
      details: { totalSwaps: 5, optimalSwaps: 5 },
    });

    it('不出现任何对比/错题区块', () => {
      render(<QuestResultDialog result={result} isCleared={false} onNext={() => {}} onHub={() => {}} />);

      // 不应有错题/错点相关的文案
      expect(screen.queryByText(/错点|错题|显示.*明细/)).not.toBeInTheDocument();
    });
  });

  describe('失败态（passed:false）', () => {
    const failedResult = makeResult({
      gameId: 'bottle',
      passed: false,
      stars: 0,
      score: 0,
      details: { totalSwaps: 99, optimalSwaps: 5 },
    });

    it('显示「挑战失败」而非「关卡完成」', () => {
      render(<QuestResultDialog result={failedResult} isCleared={false} onNext={() => {}} onHub={() => {}} />);
      expect(screen.getByText('挑战失败')).toBeInTheDocument();
      expect(screen.queryByText('关卡完成！')).not.toBeInTheDocument();
    });

    it('主按钮文案为「再次挑战本关」', () => {
      render(<QuestResultDialog result={failedResult} isCleared={false} onNext={() => {}} onHub={() => {}} />);
      expect(screen.getByText('再次挑战本关')).toBeInTheDocument();
      expect(screen.queryByText('继续下一关')).not.toBeInTheDocument();
    });

    it('失败时同样显示错题对比区块（和成功一样展示明细）', () => {
      const failedSchulte = makeResult({
        gameId: 'schulte',
        passed: false,
        stars: 0,
        details: {
          maxCombo: 2, errorCount: 3,
          errors: [{ clicked: 7, expected: 3 }],
        },
      });
      render(<QuestResultDialog result={failedSchulte} isCleared={false} onNext={() => {}} onHub={() => {}} />);
      // 失败也展示明细
      expect(screen.getByText(/错点\s*3/)).toBeInTheDocument();
    });
  });
});
