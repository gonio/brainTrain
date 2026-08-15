// 逻辑门电路图（纯展示，移植自 BrainLogic GatesDiagram 并换皮 Stitch 浅色体系）：
// elkjs 异步布局；走线 stroke=currentColor（容器 text-muted-foreground），
// 通电（输出路径）线 text-primary；门体 surface 填充 + border 描边 + font-headline 标签；
// 输入位 true=fill-primary、false=fill-muted；输出端未作答=中性，
// 答对=text-success 脉冲、答错=text-red-500 脉冲（Tailwind animate-pulse，无 BrainLogic keyframes）。
import { useEffect, useState } from 'react';
import {
  layoutCircuit,
  GATE_W,
  GATE_H,
  INPUT_NODE_R,
  type GatesLayout,
} from '../../lib/logic/gatesLayout';
import type { GatesCircuit, Gate } from '../../lib/logic/gatesEngine';

// 类名必须是完整字面量，Tailwind 才能扫描到
const GATE_LABEL: Record<Gate['type'], string> = {
  AND: '与',
  OR: '或',
  NOT: '非',
  XOR: '异或',
};

const TIP_TEXT: Record<Gate['type'], string> = {
  AND: '两个都为 1，结果才是 1',
  OR: '至少一个为 1，结果就是 1',
  NOT: '取反：1 变 0，0 变 1',
  XOR: '两个不同时为 1，相同时为 0',
};

export type GatesVerdict = 'correct' | 'wrong' | null;

export function GatesDiagram({ circuit, verdict, answer }: {
  circuit: GatesCircuit;
  /** 本题结算结果（null=作答中）：答对输出端 success 脉冲，答错 red-500 脉冲 */
  verdict: GatesVerdict;
  /** 电路真实输出：结算后揭示在输出端（作答中显示「?」） */
  answer: boolean;
}) {
  // elkjs 布局是异步的，用 state + effect 获取
  const [layout, setLayout] = useState<GatesLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutCircuit(circuit)
      .then((l) => { if (!cancelled) setLayout(l); })
      .catch(() => { if (!cancelled) setLayout(null); });
    return () => { cancelled = true; };
  }, [circuit]);

  const usedTypes = Array.from(new Set(circuit.gates.map((g) => g.type)));
  // 保持稳定的显示顺序
  const typeOrder: Gate['type'][] = ['AND', 'OR', 'NOT', 'XOR'];
  const orderedTypes = typeOrder.filter((t) => usedTypes.includes(t));

  if (!layout) {
    return <div className="text-center text-muted-foreground text-sm py-8">布局中…</div>;
  }

  const revealed = verdict !== null;
  // 输出端配色：未结算=中性；答对=success；答错=red-500（currentColor 传给 stroke/fill）
  const outputColor =
    verdict === 'correct' ? 'text-success' : verdict === 'wrong' ? 'text-red-500' : 'text-muted-foreground';
  // 输出端圆（r=INPUT_NODE_R+6）比布局节点大 6px，viewBox 四周留 8px 防裁切
  const PAD = 8;

  return (
    <div>
      {/* 本电路用到的门类型含义（flex-wrap，不截断） */}
      {orderedTypes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 justify-center">
          {orderedTypes.map((t) => (
            <div
              key={t}
              className="flex items-center gap-1.5 bg-surface-container-low border border-border rounded-full px-3 py-1"
            >
              <span className="text-xs font-semibold text-foreground">{GATE_LABEL[t]}门</span>
              <span className="text-xs text-muted-foreground">{TIP_TEXT[t]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <svg
          viewBox={`${-PAD} ${-PAD} ${layout.width + PAD * 2} ${layout.height + PAD * 2}`}
          width="100%"
          style={{ maxWidth: Math.max(layout.width + PAD * 2, 300), maxHeight: '70vh' }}
          preserveAspectRatio="xMidYMid meet"
          className="mx-auto block text-muted-foreground"
        >
          {/* 连线（先画，在底层）：stroke=currentColor，通电线 text-primary */}
          {layout.wires.map((w) => (
            <polyline
              key={w.id}
              points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              className={w.isOutputPath ? 'text-primary' : undefined}
              strokeWidth={w.isOutputPath ? 3 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* 输入位：true=primary 实心圆点，false=muted 圆点 */}
          {layout.inputs.map((inp) => (
            <g key={`in-${inp.index}`}>
              <circle
                cx={inp.x}
                cy={inp.y}
                r={INPUT_NODE_R}
                className={inp.value ? 'fill-primary' : 'fill-muted stroke-border'}
                strokeWidth={1.5}
              />
              <text
                x={inp.x}
                y={inp.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight={700}
                className={inp.value ? 'fill-primary-foreground' : 'fill-muted-foreground'}
              >
                {inp.value ? '1' : '0'}
              </text>
            </g>
          ))}

          {/* 门体：surface 填充 + border 描边，类型文字 foreground */}
          {layout.gates.map((g) => (
            <g key={`gate-${g.id}`}>
              <rect
                x={g.x - GATE_W / 2}
                y={g.y - GATE_H / 2}
                width={GATE_W}
                height={GATE_H}
                rx={8}
                className="fill-surface stroke-border"
                strokeWidth={g.isOutput ? 3 : 2}
              />
              <text
                x={g.x}
                y={g.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15}
                fontWeight={700}
                className="fill-foreground font-headline"
              >
                {GATE_LABEL[g.type]}
              </text>
            </g>
          ))}

          {/* 输出端：未作答=中性「?」；结算后揭示正确输出并按对错脉冲 */}
          <g className={`${outputColor} ${revealed ? 'animate-pulse' : ''}`}>
            <circle
              cx={layout.output.x}
              cy={layout.output.y}
              r={INPUT_NODE_R + 6}
              className="fill-surface"
              stroke="currentColor"
              strokeWidth={3}
            />
            <text
              x={layout.output.x}
              y={layout.output.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={18}
              fontWeight={700}
              fill="currentColor"
            >
              {revealed ? (answer ? '1' : '0') : '?'}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// 默认导出供 GatesGame 的 React.lazy 使用
export default GatesDiagram;
