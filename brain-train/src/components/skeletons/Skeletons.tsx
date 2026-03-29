// 骨架屏组件 - 用于加载状态

import { motion } from 'framer-motion';

// 基础骨架元素
export function Skeleton({
  className = '',
  animated = true,
  style
}: {
  className?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`
        bg-accent rounded-md
        ${animated ? 'animate-pulse' : ''}
        ${className}
      `}
      style={style}
    />
  );
}

// 文本骨架
export function TextSkeleton({
  lines = 1,
  className = ''
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

// 卡片骨架
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

// 游戏卡片骨架
export function GameCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container rounded-2xl p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-12 h-5 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-4" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

// 统计卡片骨架
export function StatCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container p-5 rounded-2xl ${className}`}>
      <Skeleton className="h-3 w-16 mb-1" />
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

// 列表项骨架
export function ListItemSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

// 图表骨架
export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container p-5 rounded-2xl ${className}`}>
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="flex items-end justify-between h-32 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-full rounded-t-lg"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// 头像骨架
export function AvatarSkeleton({
  size = 'md',
  className = ''
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  return (
    <Skeleton className={`${sizeClasses[size]} rounded-full ${className}`} />
  );
}

// 按钮骨架
export function ButtonSkeleton({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />;
}

// 页面骨架布局 - 首页
export function HomePageSkeleton() {
  return (
    <div className="space-y-8 py-8">
      {/* 标题区域 */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* 游戏网格 */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>

      {/* 洞察卡片 */}
      <ChartSkeleton />
    </div>
  );
}

// 页面骨架布局 - 统计页
export function StatsPageSkeleton() {
  return (
    <div className="space-y-6 py-8">
      <Skeleton className="h-8 w-24 mb-6" />

      {/* 统计卡片网格 */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* 连续训练卡片 */}
      <Skeleton className="h-24 rounded-2xl" />

      {/* 今日目标 */}
      <Skeleton className="h-32 rounded-2xl" />

      {/* 模式统计列表 */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// 页面骨架布局 - 设置页
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 py-8">
      <Skeleton className="h-8 w-16 mb-6" />

      {/* 设置分组 */}
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="bg-surface-container rounded-2xl p-4 space-y-4">
            {Array.from({ length: 2 + groupIndex }).map((_, itemIndex) => (
              <div key={itemIndex} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 游戏页面骨架
export function GamePageSkeleton() {
  return (
    <div className="space-y-6 py-8">
      {/* 游戏头部 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* 游戏区域 */}
      <Skeleton className="h-96 rounded-2xl" />

      {/* 控制按钮 */}
      <div className="flex justify-center gap-4">
        <ButtonSkeleton />
        <ButtonSkeleton />
      </div>
    </div>
  );
}

// 脉冲动画容器
export function PulseContainer({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        repeatType: 'reverse'
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
