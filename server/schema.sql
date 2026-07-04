-- 多人对战 schema
-- 注意：matches / user_stats 表在计划四加，本计划只建 users

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT NOT NULL,
  avatar      TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

-- 每局战绩（房间 finished 时写入）
CREATE TABLE IF NOT EXISTS matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,
  game_mode   TEXT NOT NULL DEFAULT 'schulte',
  winner_id   UUID,             -- 平局为 NULL
  played_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  players     JSONB NOT NULL    -- [{ playerId, name, avatar, found, errors, accuracy, timeMs, done, won }]
);

-- 用户统计（聚合缓存，每局后增量更新）
CREATE TABLE IF NOT EXISTS user_stats (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  matches_played INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  losses         INT NOT NULL DEFAULT 0,
  draws          INT NOT NULL DEFAULT 0,
  total_correct  INT NOT NULL DEFAULT 0,
  total_errors   INT NOT NULL DEFAULT 0,
  total_time_ms  BIGINT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 排行榜查询：按平均正确率降序、平均时间升序
CREATE INDEX IF NOT EXISTS idx_user_stats_accuracy_time ON user_stats (total_correct, total_errors, total_time_ms);
