import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestResultDialog } from '../../src/components/game/QuestResultDialog';

describe('QuestResultDialog - 通关弹窗', () => {
  const passingProps = {
    type: 'pass' as const,
    level: 5,
    stars: 2,
    score: 1100,
    maxCombo: 18,
    completionTime: 47,
    isLastLevel: false,
    onNext: () => {},
    onRetry: () => {},
  };

  it('显示通关标题', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/通关/)).toBeInTheDocument();
  });

  it('显示 2 颗亮星 + 1 颗暗星', () => {
    render(<QuestResultDialog {...passingProps} />);
    const stars = screen.getAllByText(/⭐|🌟/);
    expect(stars.length).toBeGreaterThanOrEqual(3);
  });

  it('显示得分', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/1100/)).toBeInTheDocument();
  });

  it('显示最高 combo', () => {
    render(<QuestResultDialog {...passingProps} />);
    expect(screen.getByText(/×18|18/)).toBeInTheDocument();
  });

  it('非最后一关时显示"下一关"按钮', () => {
    const onNext = vi.fn();
    render(<QuestResultDialog {...passingProps} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /下一关/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('最后一关时不显示"下一关"按钮', () => {
    render(<QuestResultDialog {...passingProps} isLastLevel={true} />);
    expect(screen.queryByRole('button', { name: /下一关/ })).not.toBeInTheDocument();
  });

  it('点击"重玩"触发 onRetry', () => {
    const onRetry = vi.fn();
    render(<QuestResultDialog {...passingProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /重玩/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('QuestResultDialog - 失败弹窗', () => {
  const failProps = {
    type: 'fail' as const,
    level: 5,
    stars: 0,
    score: 0,
    maxCombo: 6,
    completionTime: 23,
    progressText: '18/25',
    onRetry: () => {},
    onExit: () => {},
  };

  it('显示失败标题', () => {
    render(<QuestResultDialog {...failProps} />);
    expect(screen.getByText(/失败/)).toBeInTheDocument();
  });

  it('显示关卡进度', () => {
    render(<QuestResultDialog {...failProps} />);
    expect(screen.getByText(/18\/25/)).toBeInTheDocument();
  });

  it('点击"重试本关"触发 onRetry', () => {
    const onRetry = vi.fn();
    render(<QuestResultDialog {...failProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /重试本关/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('点击"退出"触发 onExit', () => {
    const onExit = vi.fn();
    render(<QuestResultDialog {...failProps} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /退出/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('QuestResultDialog - 全通关弹窗', () => {
  it('显示全通关标题', () => {
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/全部通关|全通关/)).toBeInTheDocument();
  });

  it('显示总星数', () => {
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });

  it('点击"重新挑战"触发 onRestart', () => {
    const onRestart = vi.fn();
    render(
      <QuestResultDialog
        type="completed"
        totalStars={28}
        totalTime={754}
        onRestart={onRestart}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /重新挑战/ }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
