// 逻辑门电路：生成 + 求值（纯逻辑，无 IO）

export type GateType = 'AND' | 'OR' | 'NOT' | 'XOR';

export interface Gate {
  id: number;          // 从 1 开始；0 保留为"外部输入位"
  type: GateType;
  inputA: number;      // 源 id（0 = 外部输入位）
  inputB: number;      // NOT 门忽略
  inputBitA?: number;  // inputA===0 时引用第几个外部输入位
  inputBitB?: number;  // 同上
}

export interface GatesCircuit {
  level: number;
  inputs: boolean[];
  gates: Gate[];
  outputGateId: number;
}

// 求单个门：valueOf(id) 返回某个源的真值
export function evaluateGate(gate: Gate, valueOf: (id: number) => boolean): boolean {
  const a = valueOf(gate.inputA);
  switch (gate.type) {
    case 'AND':
      return a && valueOf(gate.inputB);
    case 'OR':
      return a || valueOf(gate.inputB);
    case 'NOT':
      return !a;
    case 'XOR':
      return a !== valueOf(gate.inputB);
  }
}

// 求整个电路的输出
export function evaluateCircuit(circuit: GatesCircuit): boolean {
  const cache = new Map<number, boolean>();
  const valueOf = (id: number): boolean => {
    if (id === 0) throw new Error('inputA/inputB=0 必须配合 inputBitA/inputBitB');
    if (cache.has(id)) return cache.get(id)!;
    const gate = circuit.gates.find((g) => g.id === id);
    if (!gate) throw new Error(`未知门 id: ${id}`);
    const v = resolveGate(gate);
    cache.set(id, v);
    return v;
  };
  // 解析一个门，把对外部输入位的引用展开
  function resolveGate(gate: Gate): boolean {
    const srcA = (g: Gate): boolean =>
      g.inputA === 0 ? circuit.inputs[g.inputBitA ?? 0] : valueOf(g.inputA);
    const srcB = (g: Gate): boolean =>
      g.inputB === 0 ? circuit.inputs[g.inputBitB ?? 0] : valueOf(g.inputB);
    const a = srcA(gate);
    switch (gate.type) {
      case 'AND': return a && srcB(gate);
      case 'OR': return a || srcB(gate);
      case 'NOT': return !a;
      case 'XOR': return a !== srcB(gate);
    }
  }
  return valueOf(circuit.outputGateId);
}

// 生成器（反向生成：从输出门往回挂门。
// 保证每个门都参与最终输出、每个输入位都被引用——不允许存在冗余电路）
export function generateGatesCircuit(level: number, rng: () => number = Math.random): GatesCircuit {
  const n = Math.max(1, level);
  // level 1-2 只用 AND/OR，level 3+ 加入 NOT/XOR
  const allowed: GateType[] = n <= 2
    ? ['AND', 'OR']
    : ['AND', 'OR', 'NOT', 'XOR'];

  // 先定每个门的类型（id 1..n，id n 为输出门）
  const types: GateType[] = [];
  for (let id = 1; id <= n; id++) types[id] = pick(allowed, rng);

  // 门的输入槽位（A 必有，B 仅非 NOT 门）
  type Slot = { gate: number; port: 'A' | 'B' };
  const slotsOf = (id: number): Slot[] =>
    types[id] === 'NOT'
      ? [{ gate: id, port: 'A' }]
      : [{ gate: id, port: 'A' }, { gate: id, port: 'B' }];

  const gatesById = new Map<number, Gate>();
  gatesById.set(n, { id: n, type: types[n], inputA: 0, inputB: 0 });
  let open: Slot[] = slotsOf(n);

  // 反向挂门：每个门消耗一个开放槽位（被某个更靠后的门引用），再贡献自己的槽位
  for (let id = n - 1; id >= 1; id--) {
    const slot = open.splice(Math.floor(rng() * open.length), 1)[0];
    const consumer = gatesById.get(slot.gate)!;
    if (slot.port === 'A') consumer.inputA = id;
    else consumer.inputB = id;
    gatesById.set(id, { id, type: types[id], inputA: 0, inputB: 0 });
    open.push(...slotsOf(id));
  }

  // 剩余槽位接外部输入位。输入位数 level 1-2 固定 2，level 3+ 取 2~3，不超过槽位数
  const inputCount = Math.min(open.length, n <= 2 ? 2 : rng() < 0.5 ? 2 : 3);
  const inputs = Array.from({ length: inputCount }, () => rng() < 0.5);
  // 先洗牌出 inputCount 个不同位保证每个输入位至少被引用一次，剩余槽位随机
  const bits = Array.from({ length: inputCount }, (_, i) => i);
  for (let i = bits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bits[i], bits[j]] = [bits[j], bits[i]];
  }
  open.forEach((slot, i) => {
    const bit = i < inputCount ? bits[i] : Math.floor(rng() * inputCount);
    const g = gatesById.get(slot.gate)!;
    if (slot.port === 'A') {
      g.inputA = 0;
      g.inputBitA = bit;
    } else {
      g.inputB = 0;
      g.inputBitB = bit;
    }
  });

  return {
    level: n,
    inputs,
    gates: Array.from({ length: n }, (_, i) => gatesById.get(i + 1)!),
    outputGateId: n,
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
