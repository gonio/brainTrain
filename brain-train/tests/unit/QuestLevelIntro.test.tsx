import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestLevelIntro } from '../../src/components/game/QuestLevelIntro';

describe('QuestLevelIntro', () => {
  it('显示关卡号', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/第\s*5\s*关/)).toBeInTheDocument();
  });

  it('显示网格规模', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/5×5/)).toBeInTheDocument();
  });

  it('显示方向（反向时显示 25→1）', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/反向/)).toBeInTheDocument();
  });

  it('显示时限（有时限时）', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/每数字\s*5\s*秒/)).toBeInTheDocument();
  });

  it('不显示时限（无时限关卡）', () => {
    render(<QuestLevelIntro level={1} onStart={() => {}} />);
    expect(screen.queryByText(/每数字/)).not.toBeInTheDocument();
  });

  it('显示命数', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/3\s*命/)).toBeInTheDocument();
  });

  it('显示 combo 目标', () => {
    render(<QuestLevelIntro level={5} onStart={() => {}} />);
    expect(screen.getByText(/combo.*18|18.*combo/i)).toBeInTheDocument();
  });

  it('点击开始按钮触发 onStart', () => {
    const onStart = vi.fn();
    render(<QuestLevelIntro level={1} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('显示星级目标三项', () => {
    render(<QuestLevelIntro level={1} onStart={() => {}} />);
    expect(screen.getByText(/通关/)).toBeInTheDocument();
    expect(screen.getByText(/零错误|完美/)).toBeInTheDocument();
  });

  it('交替关显示具体点击规则示例（1 → N → 2 …）', () => {
    // 第 6 关 direction=alternate, 5×5=25，序列前 5 步：1 → 25 → 2 → 24 → 3
    render(<QuestLevelIntro level={6} onStart={() => {}} />);
    expect(screen.getByText(/1\s*→\s*25\s*→\s*2/)).toBeInTheDocument();
  });
});
