// 多人对战 REST 客户端：封装 fetch，自动带 token 头
import type { AuthResult, VersusUser, LeaderboardResponse, MyStats } from '../types/versus';

// 开发环境连本地后端（3001），生产环境同源（Nginx 反代 /api）
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// 建匿名账号
export async function createAnonymous(): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/api/auth/anonymous`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`建号失败: ${res.status}`);
  return res.json();
}

// 查当前用户（用已有 token）
export async function getMe(token: string): Promise<VersusUser> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`token 校验失败: ${res.status}`);
  const data = await res.json();
  return data.user;
}

// 查排行榜（带 token）
export async function getLeaderboard(token: string, limit = 50): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_BASE}/api/leaderboard?mode=schulte&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`排行榜查询失败: ${res.status}`);
  return res.json();
}

// 查自己统计
export async function getMyStats(token: string): Promise<MyStats> {
  const res = await fetch(`${API_BASE}/api/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`统计查询失败: ${res.status}`);
  return res.json();
}

export const versusApi = { createAnonymous, getMe, getLeaderboard, getMyStats };
