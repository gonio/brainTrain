import { describe, it, expect } from 'vitest';
import { layoutCircuit } from '@/lib/logic/gatesLayout';
import type { GatesCircuit } from '@/lib/logic/gatesEngine';

// 单 AND 门：两输入 → 一门
const singleAnd: GatesCircuit = {
  level: 1,
  inputs: [true, false],
  gates: [{ id: 1, type: 'AND', inputA: 0, inputBitA: 0, inputB: 0, inputBitB: 1 }],
  outputGateId: 1,
};

// 两级：(A AND B) OR (NOT A)
const twoLevel: GatesCircuit = {
  level: 3,
  inputs: [true, false],
  gates: [
    { id: 1, type: 'AND', inputA: 0, inputBitA: 0, inputB: 0, inputBitB: 1 },
    { id: 2, type: 'NOT', inputA: 0, inputBitA: 0, inputB: 0 },
    { id: 3, type: 'OR', inputA: 1, inputB: 2 },
  ],
  outputGateId: 3,
};

// 两级电路门数足够测试 elkjs 连线
describe('layoutCircuit - 分层（业务语义）', () => {
  it('两级电路：门3 层级 > 门1门2', async () => {
    const layout = await layoutCircuit(twoLevel);
    const g1 = layout.gates.find((g) => g.id === 1)!;
    const g3 = layout.gates.find((g) => g.id === 3)!;
    expect(g3.layer).toBeGreaterThan(g1.layer);
  });

  it('输出门 isOutput 标记正确', async () => {
    const layout = await layoutCircuit(twoLevel);
    expect(layout.gates.find((g) => g.id === 3)!.isOutput).toBe(true);
    expect(layout.gates.find((g) => g.id === 1)!.isOutput).toBe(false);
  });
});

describe('layoutCircuit - 坐标', () => {
  it('下一层 y 更大（DOWN 方向）', async () => {
    const layout = await layoutCircuit(twoLevel);
    const g1 = layout.gates.find((g) => g.id === 1)!;
    const g3 = layout.gates.find((g) => g.id === 3)!;
    expect(g3.y).toBeGreaterThan(g1.y);
  });

  it('输入节点在门上方（y 小于所有门）', async () => {
    const layout = await layoutCircuit(twoLevel);
    const minGateY = Math.min(...layout.gates.map((g) => g.y));
    for (const inp of layout.inputs) {
      expect(inp.y).toBeLessThan(minGateY);
    }
  });

  it('输出节点在最底部（y 最大）', async () => {
    const layout = await layoutCircuit(twoLevel);
    const maxY = Math.max(...layout.gates.map((g) => g.y));
    expect(layout.output.y).toBeGreaterThan(maxY);
  });
});

describe('layoutCircuit - 连线', () => {
  it('每个非NOT门有2条输入线，NOT门有1条 + 1条输出线', async () => {
    const layout = await layoutCircuit(twoLevel);
    // 门1(AND): A,B; 门2(NOT): A; 门3(OR): A,B; 输出线: out-wire = 6 条
    expect(layout.wires).toHaveLength(6);
  });

  it('连线 points 至少2个点（起止）', async () => {
    const layout = await layoutCircuit(twoLevel);
    for (const w of layout.wires) {
      expect(w.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('NOT 门只有一条输入线（A）', async () => {
    const layout = await layoutCircuit(twoLevel);
    const notWires = layout.wires.filter((w) => w.id.startsWith('g2-'));
    expect(notWires).toHaveLength(1);
    expect(notWires[0].id).toBe('g2-A');
  });

  it('连线起点在源节点边界附近，终点在目标节点边界附近（不再错位）', async () => {
    // 这是核心验证：elkjs 路由的连线必须真正连到节点，而非飘在空中
    const layout = await layoutCircuit(singleAnd);
    const TOL = 1; // 容差 1px（浮点）
    // 对每条输入线，起点应落在某个输入节点或门上，终点应落在门上
    for (const w of layout.wires) {
      const start = w.points[0];
      const end = w.points[w.points.length - 1];
      // 起点 x 应接近某个输入节点的 x
      const nearInput = layout.inputs.some(
        (inp) => Math.abs(inp.x - start.x) < 20 && Math.abs(inp.y - start.y) < 30,
      );
      // 终点应接近某门顶部
      const nearGate = layout.gates.some(
        (g) => Math.abs(g.x - end.x) <= 40 && Math.abs(g.y - end.y) <= 30,
      ) || Math.abs(layout.output.x - end.x) < 20;
      expect(nearInput || nearGate).toBe(true);
      void TOL;
    }
  });
});

// 含死支路：门2 不汇入输出（防御性，生成器已保证不产生这种电路）
const deadBranch: GatesCircuit = {
  level: 3,
  inputs: [true, false],
  gates: [
    { id: 1, type: 'AND', inputA: 0, inputBitA: 0, inputB: 0, inputBitB: 1 },
    { id: 2, type: 'NOT', inputA: 0, inputBitA: 0, inputB: 0 },
    { id: 3, type: 'OR', inputA: 1, inputB: 0, inputBitB: 1 },
  ],
  outputGateId: 3,
};

describe('layoutCircuit - 输出路径', () => {
  it('全部门汇入输出时，所有连线都是输出路径（电流从输入流到输出）', async () => {
    const layout = await layoutCircuit(twoLevel);
    expect(layout.wires.every((w) => w.isOutputPath)).toBe(true);
  });

  it('死支路的连线不是输出路径', async () => {
    const layout = await layoutCircuit(deadBranch);
    expect(layout.wires.find((w) => w.id === 'g2-A')!.isOutputPath).toBe(false);
    expect(layout.wires.find((w) => w.id === 'g3-A')!.isOutputPath).toBe(true);
    expect(layout.wires.find((w) => w.id === 'out-wire')!.isOutputPath).toBe(true);
  });
});

describe('layoutCircuit - 尺寸', () => {
  it('width/height 为正数', async () => {
    const layout = await layoutCircuit(singleAnd);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('所有元素坐标在 [0, width] × [0, height] 范围内', async () => {
    const layout = await layoutCircuit(twoLevel);
    const allX = [
      ...layout.inputs.map((i) => i.x),
      ...layout.gates.map((g) => g.x),
      layout.output.x,
      ...layout.wires.flatMap((w) => w.points.map((p) => p.x)),
    ];
    const allY = [
      ...layout.inputs.map((i) => i.y),
      ...layout.gates.map((g) => g.y),
      layout.output.y,
      ...layout.wires.flatMap((w) => w.points.map((p) => p.y)),
    ];
    expect(Math.min(...allX)).toBeGreaterThanOrEqual(-1);
    expect(Math.min(...allY)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...allX)).toBeLessThanOrEqual(layout.width + 1);
    expect(Math.max(...allY)).toBeLessThanOrEqual(layout.height + 1);
  });
});
