// 找谬误引擎：谬误类型枚举、材料类型、判分（纯逻辑，无 IO）

// 8 种核心谬误类型
export const FALLACY_TYPES = [
  '偷换概念',
  '滑坡',
  '稻草人',
  '诉诸权威',
  '诉诸情感',
  '虚假二分',
  '幸存者偏差',
  '循环论证',
] as const;
export type FallacyType = (typeof FALLACY_TYPES)[number];

// 材料按句切分，每句标注是否含谬误
export interface MaterialSentence {
  id: number;
  text: string;
  isFallacy: boolean;
}

// 一道找谬误题
export interface FallacyQuestion {
  id: string;
  material: MaterialSentence[];
  fallacyType: FallacyType;
  title: string;
  difficulty: number;
  explanation: string;
}

// 判分结果
export interface FallacyJudgeResult {
  /** 定位正确（选对了含谬误的句子） */
  locatedCorrectly: boolean;
  /** 分类正确（选对了谬误类型） */
  classifiedCorrectly: boolean;
  /** 经验奖励：定位+分类全对=满分(difficulty*12)，仅定位对=半分，定位错=0 */
  awardedXp: number;
  /** 该题正确答案的句子 id */
  correctSentenceId: number;
  /** 该题正确谬误类型 */
  correctFallacyType: FallacyType;
}

// 判分：用户选了哪句、归为哪种谬误，对照题库正确答案
export function judgeFallacy(
  question: FallacyQuestion,
  pickedSentenceId: number,
  pickedFallacyType: string,
): FallacyJudgeResult {
  // 找到正确句子（material 里 isFallacy=true 的那句）
  const correctSentence = question.material.find((s) => s.isFallacy);
  const correctSentenceId = correctSentence!.id;
  const correctFallacyType = question.fallacyType;

  const locatedCorrectly = pickedSentenceId === correctSentenceId;
  const classifiedCorrectly = locatedCorrectly && pickedFallacyType === correctFallacyType;

  // 经验：全对=difficulty*12，仅定位对=difficulty*6，定位错=0
  let awardedXp = 0;
  if (classifiedCorrectly) awardedXp = question.difficulty * 12;
  else if (locatedCorrectly) awardedXp = question.difficulty * 6;

  return {
    locatedCorrectly,
    classifiedCorrectly,
    awardedXp,
    correctSentenceId,
    correctFallacyType,
  };
}
