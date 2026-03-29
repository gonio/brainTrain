// 玩法说明配置类型
type TrainingMode = 'schulte' | 'stroop' | 'sequence' | 'auditory' | 'mirror' | 'classify' | 'story';

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
  objective: '在30秒内按降序(25→1)依次点击网格中的数字，训练视觉搜索效率与注意力集中度。',
  howToPlay: [
    '屏幕上显示 5×5 的随机数字网格（数字 1-25）',
    '训练开始后，按降序（25→1）依次点击数字',
    '点击正确数字后，该数字标记为已完成',
    '点击错误数字时，系统记录错误但不中断训练，给予视觉反馈',
    '完成所有数字点击后训练结束，显示用时和准确率',
  ],
  scoringRules: [
    '基础分：500分',
    '时间奖励：完成越快得分越高',
    '错误扣分：每次错误扣10分',
    '困难系数：降序模式 ×1.2',
  ],
  hardModeNote:
    '固定使用 5×5 网格，必须按降序(25→1)完成。无提示，需独立完成。',
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
    '每轮训练包含20道题目，每题限时1.5秒',
    '系统记录每题的反应时间和正确率',
  ],
  scoringRules: [
    '基础分：每题50分',
    '速度奖励：反应时间<1秒额外+20分',
    '连续正确奖励：连续答对3题以上额外加分',
    '总分 = 正确题数 × 基础分 + 速度奖励 + 连续奖励',
  ],
  hardModeNote: '固定20道题目，每题限时1.5秒。必须快速判断，无额外提示。',
};

// 序列记忆玩法说明
export const sequenceInstructions: GameplayInstructionsConfig = {
  mode: 'sequence',
  title: '序列记忆',
  description: '工作记忆训练 - 强化工作记忆和序列记忆能力',
  objective: '记忆物品及其出现的顺序，然后按顺序回忆，强化记忆编码与提取机制。',
  howToPlay: [
    '系统依次展示10个物品（emoji图标），每个物品显示1秒',
    '物品展示完毕后进入回忆阶段',
    '按照刚才展示的顺序依次点击物品',
    '选择的物品会按点击顺序排列在上方',
    '完成选择后提交答案',
  ],
  scoringRules: [
    '位置准确率：物品在正确位置得满分',
    '物品准确率：物品正确但位置错误得半分',
    '基础分：500分',
    '困难系数：1.5x（10个物品）',
  ],
  hardModeNote: '固定10个物品序列，必须记住顺序。无提示，需独立完成。',
};

// 听觉注意玩法说明
export const auditoryInstructions: GameplayInstructionsConfig = {
  mode: 'auditory',
  title: '听觉注意',
  description: '听觉选择性注意 - 提升听觉注意力和抗干扰能力',
  objective:
    '专注听取数字序列并记忆其出现顺序，锻炼听觉皮层与前额叶皮层功能。',
  howToPlay: [
    '系统通过语音播放一串7位数字序列（如：3-7-1-9-5-2-8）',
    '仔细聆听并记忆数字顺序',
    '播放完毕后，按顺序输入听到的数字',
    '可选择开启背景白噪音增加难度（获得额外奖励）',
    '提供2次重播机会',
  ],
  scoringRules: [
    '基础分：300分',
    '正确率奖励：每正确一个数字+100分',
    '干扰奖励：开启白噪音额外×1.2倍',
    '困难系数：1.6x（7位数字）',
  ],
  hardModeNote:
    '固定7位数字序列。可选择开启背景白噪音增加难度，获得额外分数奖励。',
};

// 镜像协调玩法说明
export const mirrorInstructions: GameplayInstructionsConfig = {
  mode: 'mirror',
  title: '镜像协调',
  description: '双侧肢体协调 - 提升双侧肢体协调性和空间感知能力',
  objective: '双手同步绘制镜像图形，通过运动皮层与小脑的协同训练提高肢体协调性。',
  howToPlay: [
    '屏幕分为左右两个画布区域',
    '左侧显示目标形状（三角形）',
    '在左侧画布上沿虚线描绘目标形状',
    '右侧画布实时显示用户的镜像绘制轨迹',
    '绘制时间限制30秒，完成后提交',
  ],
  scoringRules: [
    '对称性分数（60%权重）：左右轨迹的匹配度',
    '完整性分数（40%权重）：对目标形状的覆盖程度',
    '总分 = 对称性得分 × 0.6 + 完整性得分 × 0.4',
  ],
  hardModeNote: '固定三角形目标，限时30秒。需要双手协调控制，无操作提示。',
};

// 分类逻辑玩法说明
export const classifyInstructions: GameplayInstructionsConfig = {
  mode: 'classify',
  title: '分类逻辑',
  description: '规则导向分类 - 提升认知灵活性和快速决策能力',
  objective: '依据属性对物品进行分类判断，优化逻辑思维与信息整合效率。',
  howToPlay: [
    '屏幕中央展示一个物品（具有颜色、形状、大小三个属性）',
    '上方显示当前分类规则（按颜色/形状/大小）',
    '根据当前规则判断该物品属于哪一类',
    '点击下方三个分类按钮之一（颜色/形状/大小）',
    '规则会随机切换（每3-5题），需要快速适应',
  ],
  scoringRules: [
    '基础分：每题40分',
    '速度奖励：反应时间<1.5秒额外+20分',
    '规则适应奖励：规则切换后首次答对额外+30分',
    '总分 = 正确数 × 基础分 + 速度奖励 + 适应奖励',
  ],
  hardModeNote:
    '固定15个物品，每3-5题随机切换规则。需要快速适应新规则，无额外提示。',
};

// 情景联想玩法说明
export const storyInstructions: GameplayInstructionsConfig = {
  mode: 'story',
  title: '情景联想',
  description: '场景记忆联想 - 提升联想记忆和创造性记忆能力',
  objective: '利用物品构建连贯的场景故事，强化记忆存储与关联能力。',
  howToPlay: [
    '系统展示一个场景（厨房/办公室/公园）和该场景中的7个物品',
    '有10秒时间记忆这些物品',
    '记忆阶段结束后，选择记住的物品',
    '用选中的物品编一个连贯的场景故事',
    '系统评估回忆准确率和故事完整度',
  ],
  scoringRules: [
    '回忆准确率：正确回忆的物品占总物品的比例',
    '故事完整度：故事包含的回忆物品数量',
    '基础分：300分',
    '回忆奖励：准确率 × 4分',
    '故事奖励：完整度 × 3分',
  ],
  hardModeNote:
    '固定7个物品，仅10秒记忆时间。需要快速记忆并构建联想故事，无提示。',
};

// 所有玩法说明配置映射
export const gameplayInstructionsMap: Record<string, GameplayInstructionsConfig> =
  {
    schulte: schulteInstructions,
    stroop: stroopInstructions,
    sequence: sequenceInstructions,
    auditory: auditoryInstructions,
    mirror: mirrorInstructions,
    classify: classifyInstructions,
    story: storyInstructions,
  };
