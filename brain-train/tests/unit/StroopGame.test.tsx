// StroopGame 判定一致性测试
//
// dual 模式每题随机 standard/reverse，但同一题内：
//   - 界面提示（选颜色 / 选字义）由 rule 决定
//   - correctAnswer 由同一个 rule 决定
//   - isCorrect = userAnswer === correctAnswer
// 三者必须一致，否则用户按提示选却被判错。
//
// 这里 mock Math.random 构造确定场景，验证：
//   1. standard 题：选 wordColor(显示色) 判对、选 word(字义) 判错
//   2. reverse 题：选 word(字义) 判对、选 wordColor(显示色) 判错
//   3. correctAnswer 与规则一致
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { StroopGame } from '../../src/components/game/StroopGame';

// helper：固定题目数据。控制 wordColorIdx=文字字义、displayColorIdx=显示色
// Math.random 在题目生成时被调用多次，我们用一个序列让它可预测。
function fixedRandom(seq: number[]) {
  let i = 0;
  Math.random = () => seq[i++ % seq.length];
}

describe('StroopGame 判定一致性', () => {
  let original: typeof Math.random;
  beforeEach(() => {
    original = Math.random;
  });
  afterEach(() => {
    Math.random = original;
  });


  it('standard 题：选「文字显示的颜色」判对，选「文字字义」判错', () => {
    // 强制题目：word=COLORS[0]=红色（字义），显示色=COLORS[1]=蓝色
    // wordColor 选 index 0：Math.random()*6 < 1 → 返回 0，需要 random 在 [0,1/6)
    // displayColor 选 index 1：需要 random 在 [1/6, 2/6)
    // 70% 不一致分支：random < 0.7 → true
    // 题目生成调用顺序：wordColor, displayColor, 一致性判定
    fixedRandom([0.0, 0.2, 0.5]);

    const onAnswer = vi.fn();
    const { rerender } = render(
      <StroopGame
        isActive={true}
        onAnswer={onAnswer}
        currentQuestion={0}
        totalQuestions={3}
        mode="standard"
      />,
    );

    // 题目应是：word="红色"，显示成蓝色
    // standard：正确答案 = 显示色 = "蓝色"
    // 选"蓝色"（显示色）→ 对
    fireEvent.click(getColorButton('蓝色'));
    let last = onAnswer.mock.calls.at(-1)![0];
    expect(last.isCorrect).toBe(true);
    expect(last.correctAnswer).toBe('蓝色');
    expect(last.word).toBe('红色');

    // 下一题：选"红色"（字义）→ 错
    onAnswer.mockClear();
    rerender(
      <StroopGame
        isActive={true}
        onAnswer={onAnswer}
        currentQuestion={1}
        totalQuestions={3}
        mode="standard"
      />,
    );
    fireEvent.click(getColorButton('红色'));
    last = onAnswer.mock.calls.at(-1)![0];
    expect(last.isCorrect).toBe(false);
    expect(last.correctAnswer).toBe('蓝色'); // 仍以显示色为准
  });

  it('reverse 题：选「文字字义」判对，选「显示色」判错', () => {
    fixedRandom([0.0, 0.2, 0.5]);
    const onAnswer = vi.fn();
    render(
      <StroopGame
        isActive={true}
        onAnswer={onAnswer}
        currentQuestion={0}
        totalQuestions={3}
        mode="reverse"
      />,
    );
    // word="红色"(字义)，显示蓝色。reverse：正确答案 = 字义 = "红色"
    fireEvent.click(getColorButton('红色')); // 选字义 → 对
    const last = onAnswer.mock.calls.at(-1)![0];
    expect(last.isCorrect).toBe(true);
    expect(last.correctAnswer).toBe('红色');
  });
});

// 回归：每题限时——timeLeft 每秒递减、超时触发 onAnswer（之前只有 setTimeout，timeLeft 恒为初值）
describe('StroopGame 每题限时', () => {
  let originalNow: () => number;
  beforeEach(() => {
    originalNow = Date.now;
    vi.useFakeTimers();
  });
  afterEach(() => {
    Date.now = originalNow;
    vi.useRealTimers();
  });

  it('超时触发 onAnswer（isCorrect=false）', () => {
    // 固定题目：word="红色"(字义)，显示色蓝色
    fixedRandom([0.0, 0.2, 0.5]);
    const onAnswer = vi.fn();
    render(
      <StroopGame
        isActive={true}
        onAnswer={onAnswer}
        currentQuestion={0}
        totalQuestions={3}
        mode="standard"
        timePerQuestion={3}
      />,
    );

    // 推进 3 秒 → 超时
    act(() => { vi.advanceTimersByTime(3100); });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    const last = onAnswer.mock.calls.at(-1)![0];
    expect(last.isCorrect).toBe(false);
    expect(last.userAnswer).toBe('');
    // standard：正确答案 = 显示色 = 蓝色
    expect(last.correctAnswer).toBe('蓝色');
  });
});

// 从 DOM 里按颜色名找按钮
function getColorButton(name: string) {
  const buttons = document.querySelectorAll('button');
  for (const b of Array.from(buttons)) {
    if (b.textContent?.includes(name)) return b;
  }
  throw new Error(`找不到颜色按钮：${name}`);
}
