import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GatesGame } from '@/components/game/GatesGame';
import { generateGatesCircuit, evaluateCircuit } from '@/lib/logic/gatesEngine';
import { mulberry32 } from '@/lib/rng';

// GatesGame 里的 GatesDiagram 走 React.lazy + elkjs 异步布局，
// 本测试聚焦答题流程（按钮/判定/onRoundEnd），把电路图 mock 成空占位，
// 避免依赖 Suspense 解析时序与 elkjs；布局正确性由 gatesLayout.test.ts 覆盖。
vi.mock('@/components/game/GatesDiagram', () => ({
  default: () => <div data-testid="gates-diagram" />,
  GatesDiagram: () => <div data-testid="gates-diagram" />,
}));

// 组件与测试各自调一次 generateGatesCircuit(3, mulberry32(42))，得到同一道题
const circuit = generateGatesCircuit(3, mulberry32(42));
const answer = evaluateCircuit(circuit);
const correctLabel = answer ? '1' : '0';
const wrongLabel = answer ? '0' : '1';

describe('GatesGame', () => {
  it('渲染题干与 0/1 两个作答按钮', () => {
    render(<GatesGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={() => {}} />);
    expect(screen.getByText(/输出是 0 还是 1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '0' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
  });

  it('答对：onRoundEnd { correct: true, attempts: 1 }，之后按钮不再响应', () => {
    const onRoundEnd = vi.fn();
    render(<GatesGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByRole('button', { name: correctLabel }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: true, attempts: 1 });
    fireEvent.click(screen.getByRole('button', { name: wrongLabel }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1); // 结束后忽略点击
  });

  it('3 次全错：onRoundEnd { correct: false, attempts: 3 }', () => {
    const onRoundEnd = vi.fn();
    render(<GatesGame engineLevel={3} isActive={true} rng={mulberry32(42)} onRoundEnd={onRoundEnd} />);
    fireEvent.click(screen.getByRole('button', { name: wrongLabel }));
    fireEvent.click(screen.getByRole('button', { name: wrongLabel }));
    expect(onRoundEnd).not.toHaveBeenCalled(); // 还有 1 次机会，未结束
    fireEvent.click(screen.getByRole('button', { name: wrongLabel }));
    expect(onRoundEnd).toHaveBeenCalledTimes(1);
    expect(onRoundEnd.mock.calls[0][0]).toEqual({ correct: false, attempts: 3 });
  });
});
