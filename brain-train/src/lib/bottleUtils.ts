// 暗瓶排列游戏的纯逻辑工具函数。独立成文件，避免组件文件混入非组件导出
// 触发 react-refresh/only-export-components。

// Fisher-Yates 洗牌（随机，每局不同）
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 计算两序列中位置相同且元素相同的个数（已匹配数）
export function countMatches(target: string[], player: string[]): number {
  return target.reduce((acc, color, i) => acc + (color === player[i] ? 1 : 0), 0);
}

// 计算最优交换次数 = n - 环数。
// 将 player 视为目标排列的置换，分解为若干不相交环，每个 k-环需 k-1 次交换。
export function computeOptimalSwaps(target: string[], player: string[]): number {
  const n = target.length;
  const targetPos = new Map<string, number>();
  target.forEach((color, i) => targetPos.set(color, i));

  const perm = player.map(color => targetPos.get(color)!);
  const visited = new Set<number>();
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    let j = i;
    while (!visited.has(j)) {
      visited.add(j);
      j = perm[j];
    }
    cycles++;
  }
  return n - cycles;
}
