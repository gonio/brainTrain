// 玩法说明配置类型
type TrainingMode = 'schulte' | 'stroop' | 'sequence';

export interface GameplayInstructionsConfig {
  mode: TrainingMode;
  title: string;
  description: string;
  objective: string;
  howToPlay: string[];
  scoringRules: string[];
  hardModeNote: string;
}

// 舒尔特表玩法说明
export const schulteInstructions: GameplayInstructionsConfig = {
  mode: 'schulte',
  title: '舒尔特表',
  description: '视觉搜索训练 - 提升视觉搜索速度和注意力集中度',
  objective: '尽快按顺序点击网格中的所有数字，训练视觉搜索效率与注意力集中度。',
  howToPlay: [
    '屏幕上显示 5×5 的随机数字网格（数字 1-25）',
    '训练开始后，按升序（1→25）依次点击数字',
    '点击正确数字后，该数字标记为已完成',
    '点击错误数字时，系统记录错误但不中断训练',
    '完成所有数字点击后训练结束，显示用时和准确率',
  ],
  scoringRules: [
    '满分 100 分',
    '准确度占 70%：无错误得满分，每次错误扣分',
    '速度占 30%：20 秒内完成得满分，每多 1 秒扣 2 分',
  ],
  hardModeNote:
    '固定使用 5×5 网格，按升序(1→25)完成。无提示，需独立完成。',
};

// 字色干扰玩法说明
export const stroopInstructions: GameplayInstructionsConfig = {
  mode: 'stroop',
  title: '字色干扰',
  description: '抑制语义干扰 - 提升抑制能力和前额叶皮层功能',
  objective:
    '选择文字的实际颜色而非文字本身的含义，通过抑制语义干扰激活前额叶皮层功能。',
  howToPlay: [
    '屏幕中央显示一个带颜色的文字（如用蓝色显示的"红色"二字）',
    '选择文字的实际颜色，而非文字本身的含义',
    '从下方颜色选项中选择正确答案',
    '每轮训练包含 15 道题目',
    '系统记录每题的反应时间和正确率',
  ],
  scoringRules: [
    '满分 100 分',
    '准确度占 70%：全部正确得满分',
    '速度占 30%：平均反应时间越短得分越高',
  ],
  hardModeNote: '固定 15 道题目，无时间限制。需要快速准确判断。',
};

// 序列记忆玩法说明
export const sequenceInstructions: GameplayInstructionsConfig = {
  mode: 'sequence',
  title: '序列记忆',
  description: '工作记忆训练 - 强化工作记忆和序列记忆能力',
  objective: '记忆物品及其出现的顺序，然后按顺序回忆，强化记忆编码与提取机制。',
  howToPlay: [
    '系统依次展示一组物品（emoji图标），每个物品显示约 1 秒',
    '物品展示完毕后进入回忆阶段',
    '按照刚才展示的顺序依次点击物品',
    '选择的物品会按点击顺序排列在上方',
    '完成选择后提交答案',
  ],
  scoringRules: [
    '满分 100 分',
    '位置准确率占 60%：物品在正确位置得满分',
    '物品准确率占 40%：物品正确但位置不对也得部分分',
  ],
  hardModeNote: '可选择不同难度（5/7/10个物品）。必须记住顺序，无提示。',
};

// 所有玩法说明配置映射
export const gameplayInstructionsMap: Record<string, GameplayInstructionsConfig> =
  {
    schulte: schulteInstructions,
    stroop: stroopInstructions,
    sequence: sequenceInstructions,
  };
