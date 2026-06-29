// QuestRunner 倒计时回归测试
//
// 主线闯关（Quest.tsx）在 view==='playing' 时挂载 QuestRunner，后者在挂载 effect 里触发 3-2-1 倒计时，
// phase==='ready' 才渲染真正的游戏 Runner。
// bug：倒计时数字「3」一直不动。这里渲染真实 QuestRunner（mock 掉内部 Runner），
// 用 fake timers 推进，断言 overlay 里的数字会从 3 → 2 → 1 → 消失（ready）。
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

// mock 掉 4 个具体 Runner，避免引入真实游戏的复杂依赖
vi.mock('../../src/components/quest/QuestSchulteRunner', () => ({
  QuestSchulteRunner: () => <div data-testid="mock-runner">schulte</div>,
}));
vi.mock('../../src/components/quest/QuestSequenceRunner', () => ({
  QuestSequenceRunner: () => <div data-testid="mock-runner">sequence</div>,
}));
vi.mock('../../src/components/quest/QuestStroopRunner', () => ({
  QuestStroopRunner: () => <div data-testid="mock-runner">stroop</div>,
}));
vi.mock('../../src/components/quest/QuestBottleRunner', () => ({
  QuestBottleRunner: () => <div data-testid="mock-runner">bottle</div>,
}));

import { QuestRunner } from '../../src/components/quest/QuestRunner';

describe('QuestRunner 倒计时（主线闯关）— 真实定时器', () => {
  it('挂载后显示 3，真实时间推进后依次出现 2、1，最后挂载 Runner', async () => {
    render(
      <QuestRunner gameId="schulte" difficulty={1} onComplete={() => {}} />,
    );

    // 初始：显示 3
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    // 等 1.x 秒后应出现 2
    await waitFor(
      () => expect(screen.getByText('2')).toBeInTheDocument(),
      { timeout: 2500 },
    );

    // 再等应出现 1
    await waitFor(
      () => expect(screen.getByText('1')).toBeInTheDocument(),
      { timeout: 2500 },
    );

    // 倒计时结束 → Runner 挂载
    await waitFor(
      () => expect(screen.getByTestId('mock-runner')).toBeInTheDocument(),
      { timeout: 2500 },
    );
  }, 15000);

  it('StrictMode 双挂载下也能正常倒数（复现主线闯关卡死的真实环境）', async () => {
    // main.tsx 用 <StrictMode> 包裹整个应用，开发态会双挂载组件。
    render(
      <StrictMode>
        <QuestRunner gameId="schulte" difficulty={1} onComplete={() => {}} />
      </StrictMode>,
    );

    // 初始显示 3
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument(), { timeout: 2000 });

    // 真实时间推进：3 → 2 → 1 → 挂载 Runner
    await waitFor(
      () => expect(screen.getByText('2')).toBeInTheDocument(),
      { timeout: 2500 },
    );
    await waitFor(
      () => expect(screen.getByText('1')).toBeInTheDocument(),
      { timeout: 2500 },
    );
    await waitFor(
      () => expect(screen.getByTestId('mock-runner')).toBeInTheDocument(),
      { timeout: 2500 },
    );
  }, 15000);
});
