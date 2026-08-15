import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeLogicRunner } from '@/components/quest/QuestLogicRunner';
import type { LogicRoundProps } from '@/components/game/LogicSessionShell';
import type { QuestResult } from '@/types/quest';

// 假组件：点按钮即按预设结果结束本 round
function FakeGame({ onRoundEnd }: LogicRoundProps) {
  return <button onClick={() => onRoundEnd({ correct: true, attempts: 2 })}>done</button>;
}

describe('makeLogicRunner', () => {
  it('第二次答对：passed + 2 星 + score 67', () => {
    const onComplete = vi.fn();
    const Runner = makeLogicRunner('syllogism', FakeGame);
    render(<Runner difficulty={5} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('done'));
    const r = onComplete.mock.calls[0][0] as QuestResult;
    expect(r).toMatchObject({ gameId: 'syllogism', difficulty: 5, passed: true, stars: 2, score: 67 });
  });
});
