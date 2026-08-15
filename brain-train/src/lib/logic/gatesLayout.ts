// 电路图布局：用 elkjs（Eclipse Layout Kernel）做分层布局 + 连线路由。
// elkjs 把连线精确路由到节点边界，从根本上避免手工算坐标的错位问题。
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GatesCircuit, Gate } from './gatesEngine';

// 布局常量（GatesDiagram 渲染时复用，保证门框/圆点尺寸与布局一致）
export const GATE_W = 56;
export const GATE_H = 36;
export const INPUT_NODE_R = 14; // 输入圆点半径

export interface PlacedInput {
  index: number;
  value: boolean;
  x: number;
  y: number;
}
export interface PlacedGate {
  id: number;
  type: Gate['type'];
  x: number;
  y: number;
  layer: number;
  isOutput: boolean;
}
export interface Wire {
  id: string;
  points: { x: number; y: number }[];
  isOutputPath: boolean;
}
export interface OutputNode {
  x: number;
  y: number;
}
export interface GatesLayout {
  inputs: PlacedInput[];
  gates: PlacedGate[];
  wires: Wire[];
  output: OutputNode;
  width: number;
  height: number;
}

// elkjs 单例（主线程版，浏览器与 node 通用；电路很小，无需 worker）
const elk = new ELK();

// 输入信号节点 id 前缀，避免与门 id 冲突
const inputId = (i: number) => `in${i}`;
const gateId = (id: number) => `g${id}`;
const OUTPUT_NODE_ID = 'out';

// 用手写分层（保持与业务语义一致，elkjs 的 layer 不直接暴露层级编号）
function computeLayers(circuit: GatesCircuit): Map<number, number> {
  const layers = new Map<number, number>();
  const resolve = (gid: number): number => {
    if (layers.has(gid)) return layers.get(gid)!;
    const g = circuit.gates.find((x) => x.id === gid)!;
    const srcA = g.inputA === 0 ? 0 : resolve(g.inputA);
    const srcB = g.type === 'NOT' ? 0 : g.inputB === 0 ? 0 : resolve(g.inputB);
    const layer = Math.max(srcA, srcB) + 1;
    layers.set(gid, layer);
    return layer;
  };
  for (const g of circuit.gates) resolve(g.id);
  return layers;
}

// 把电路转成 elkjs 的输入图
function buildElkGraph(circuit: GatesCircuit): ElkNode {
  const children: ElkNode[] = [];

  // 输入信号节点
  for (let i = 0; i < circuit.inputs.length; i++) {
    children.push({
      id: inputId(i),
      width: INPUT_NODE_R * 2,
      height: INPUT_NODE_R * 2,
    });
  }

  // 门节点
  for (const g of circuit.gates) {
    children.push({
      id: gateId(g.id),
      width: GATE_W,
      height: GATE_H,
    });
  }

  // 最终输出节点
  children.push({
    id: OUTPUT_NODE_ID,
    width: INPUT_NODE_R * 2,
    height: INPUT_NODE_R * 2,
  });

  // 边
  const edges: ElkExtendedEdge[] = [];
  for (const g of circuit.gates) {
    const gid = gateId(g.id);
    // inputA
    const srcA = g.inputA === 0 ? inputId(g.inputBitA ?? 0) : gateId(g.inputA);
    edges.push({ id: `${gid}-A`, sources: [srcA], targets: [gid] });
    // inputB（NOT 无）
    if (g.type !== 'NOT') {
      const srcB = g.inputB === 0 ? inputId(g.inputBitB ?? 0) : gateId(g.inputB);
      edges.push({ id: `${gid}-B`, sources: [srcB], targets: [gid] });
    }
  }
  // 输出门 → 输出节点
  edges.push({
    id: `${gateId(circuit.outputGateId)}-out`,
    sources: [gateId(circuit.outputGateId)],
    targets: [OUTPUT_NODE_ID],
  });

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      // 层间距、同层节点间距
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
      'elk.spacing.nodeNode': '40',
      // 居中对齐，减少视觉错落
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      // 输入信号放最上层、输出放最下层（按拓扑约束，elkjs 会尊重）
    },
    children,
    edges,
  };
}

// 输出路径：从输出门反向可达的所有门（生成器保证无冗余时即全部连线，
// 黄色电流从输入一路流到输出，而不是只亮最后一截）
function computeLiveGates(circuit: GatesCircuit): Set<number> {
  const live = new Set<number>();
  const walk = (gid: number) => {
    if (live.has(gid)) return;
    live.add(gid);
    const g = circuit.gates.find((x) => x.id === gid);
    if (!g) return;
    if (g.inputA !== 0) walk(g.inputA);
    if (g.type !== 'NOT' && g.inputB !== 0) walk(g.inputB);
  };
  walk(circuit.outputGateId);
  return live;
}

// 解析 elkjs 返回结果，转成 GatesLayout
function parseResult(
  result: ElkNode,
  circuit: GatesCircuit,
): GatesLayout {
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const n of result.children ?? []) {
    nodeMap.set(n.id, { x: n.x!, y: n.y!, width: n.width!, height: n.height! });
  }

  const layers = computeLayers(circuit);

  const inputs: PlacedInput[] = circuit.inputs.map((value, i) => {
    const n = nodeMap.get(inputId(i))!;
    // 圆心 = 节点左上 + 半径
    return { index: i, value, x: n.x + INPUT_NODE_R, y: n.y + INPUT_NODE_R };
  });

  const gates: PlacedGate[] = circuit.gates.map((g) => {
    const n = nodeMap.get(gateId(g.id))!;
    return {
      id: g.id,
      type: g.type,
      x: n.x + GATE_W / 2,
      y: n.y + GATE_H / 2,
      layer: layers.get(g.id) ?? 0,
      isOutput: g.id === circuit.outputGateId,
    };
  });

  const outNode = nodeMap.get(OUTPUT_NODE_ID)!;
  const output: OutputNode = {
    x: outNode.x + INPUT_NODE_R,
    y: outNode.y + INPUT_NODE_R,
  };

  // 解析边：elkjs 的 section 含 startPoint / endPoint / bendPoints
  const live = computeLiveGates(circuit);
  const wireMap = new Map<string, { points: { x: number; y: number }[]; isOutputPath: boolean }>();
  for (const e of result.edges ?? []) {
    const sec = e.sections?.[0];
    if (!sec) continue;
    const points: { x: number; y: number }[] = [
      { x: sec.startPoint.x, y: sec.startPoint.y },
      ...(sec.bendPoints ?? []).map((b) => ({ x: b.x, y: b.y })),
      { x: sec.endPoint.x, y: sec.endPoint.y },
    ];
    // 输出路径 = 目标门在输出门的反向可达集内，或是输出门→输出节点的线
    const targetGateId = e.targets?.[0]?.startsWith('g') ? Number(e.targets[0].slice(1)) : NaN;
    const isOutputToNode = e.id === `${gateId(circuit.outputGateId)}-out`;
    wireMap.set(e.id, { points, isOutputPath: live.has(targetGateId) || isOutputToNode });
  }

  // 按业务顺序组织 wires（先各门的输入线 A/B，再输出线）
  const wires: Wire[] = [];
  for (const g of circuit.gates) {
    const gid = gateId(g.id);
    const wA = wireMap.get(`${gid}-A`);
    if (wA) wires.push({ id: `g${g.id}-A`, points: wA.points, isOutputPath: wA.isOutputPath });
    if (g.type !== 'NOT') {
      const wB = wireMap.get(`${gid}-B`);
      if (wB) wires.push({ id: `g${g.id}-B`, points: wB.points, isOutputPath: wB.isOutputPath });
    }
  }
  const wOut = wireMap.get(`${gateId(circuit.outputGateId)}-out`);
  if (wOut) wires.push({ id: 'out-wire', points: wOut.points, isOutputPath: true });

  return {
    inputs,
    gates,
    wires,
    output,
    width: result.width!,
    height: result.height!,
  };
}

// 布局电路（异步：elkjs 是异步的）
export async function layoutCircuit(circuit: GatesCircuit): Promise<GatesLayout> {
  const graph = buildElkGraph(circuit);
  const result = await elk.layout(graph);
  return parseResult(result, circuit);
}
