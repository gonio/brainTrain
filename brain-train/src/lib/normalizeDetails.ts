import type { SchulteDetails } from '../types';

// 兜底处理旧训练记录（没有 mode 字段）
// 详见 spec §6.1
export function normalizeSchulteDetails(raw: any): SchulteDetails {
  if (raw && raw.mode) return raw as SchulteDetails;
  return {
    ...raw,
    mode: 'free' as const,
    maxCombo: 0,
  };
}
