import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FallacyGame } from '@/components/game/FallacyGame';
import { pickFallacyQuestion } from '@/lib/logic/fallacyBank';
import { FALLACY_TYPES } from '@/lib/logic/fallacyEngine';
import { mulberry32 } from '@/lib/rng';

// 组件与测试各自调一次 pickFallacyQuestion(3, mulberry32(7))，得到同一道题；
// 测试从题库反查该题答案（含谬误的句子 + 谬误类型）来驱动点击
const question = pickFallacyQuestion(3, mulberry32(7));
const correctSentence = question.material.find((s) => s.isFallacy)!;
const wrongType = FALLACY_TYPES.find((t) => t !== question.fallacyType)!;

function renderGame(onRoundEnd: (o: { correct: boolean; attempts: number }) => void) {
  return render(
    <FallacyGame engineLevel={3} isActive={true} rng={mulberry32(7)} onRoundEnd={onRoundEnd} />,
  );
}

describe('FallacyGame', () => {
  it('渲染材料句子、8 个谬误类型 chips 与禁用的提交按钮', () => {
    renderGame(() => {});
    expect(screen.getByText(question.title)).toBeTruthy();
    question.material.forEach((s) => {
      expect(screen.getByRole('button', { name: s.text })).toBeTruthy();
    });
    FALLACY_TYPES.forEach((t) => {
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
    });
    const submit = screen.getByRole('button', { name: '提交答案' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('选对句子与类型后提交，一次作答上抛 correct', () => {
    const onRoundEnd = vi.fn();
    renderGame(onRoundEnd);
    fireEvent.click(screen.getByRole('button', { name: correctSentence.text }));
    fireEvent.click(screen.getByRole('button', { name: question.fallacyType }));
    const submit = screen.getByRole('button', { name: '提交答案' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
  });

  it('定位对但类型错：提示类型不对，消耗一次机会但不结算', () => {
    const onRoundEnd = vi.fn();
    renderGame(onRoundEnd);
    fireEvent.click(screen.getByRole('button', { name: correctSentence.text }));
    fireEvent.click(screen.getByRole('button', { name: wrongType }));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    // 只提示哪一步错了，不揭示答案；回合未结束，还剩 2 次机会
    expect(screen.getByText(/类型不对/)).toBeTruthy();
    expect(screen.getByText(/还剩 2 次机会/)).toBeTruthy();
    expect(onRoundEnd).not.toHaveBeenCalled();
  });
});
