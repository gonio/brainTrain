import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { PathData } from '@/types';

// 目标形状类型
type TargetShape = 'line' | 'circle' | 'square' | 'triangle';

interface MirrorGameProps {
  targetShape: TargetShape;
  isActive: boolean;
  onComplete: (result: {
    symmetryScore: number;
    completeness: number;
    leftPath: PathData;
    rightPath: PathData;
  }) => void;
}

interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export function MirrorGame({
  targetShape,
  isActive,
  onComplete
}: MirrorGameProps) {
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30秒绘制时间

  const pathRef = useRef<Point[]>([]);

  // 获取 Canvas 上下文
  const getContext = (canvas: HTMLCanvasElement) => {
    return canvas.getContext('2d');
  };

  // 初始化 Canvas
  const initCanvas = useCallback(() => {
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (!leftCanvas || !rightCanvas) return;

    // 设置画布大小
    const size = Math.min(leftCanvas.parentElement?.clientWidth || 300, 300);
    const dpr = window.devicePixelRatio || 1;

    [leftCanvas, rightCanvas].forEach(canvas => {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const ctx = getContext(canvas);
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4f46e5';
      }
    });

    // 绘制目标形状提示
    drawTargetShape(leftCanvas, targetShape);
  }, [targetShape]);

  // 绘制目标形状（半透明提示）
  const drawTargetShape = (canvas: HTMLCanvasElement, shape: TargetShape) => {
    const ctx = getContext(canvas);
    if (!ctx) return;

    const size = canvas.width / (window.devicePixelRatio || 1);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    switch (shape) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'square':
        ctx.strokeRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX + radius, centerY + radius);
        ctx.lineTo(centerX - radius, centerY + radius);
        ctx.closePath();
        ctx.stroke();
        break;
    }

    ctx.restore();
  };

  // 开始绘制
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return;

    const canvas = leftCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const point = getPointFromEvent(canvas, e);
    pathRef.current = [point];

    const ctx = getContext(canvas);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  }, [isActive]);

  // 绘制中
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isActive) return;

    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (!leftCanvas || !rightCanvas) return;

    const point = getPointFromEvent(leftCanvas, e);
    pathRef.current.push(point);

    // 绘制左侧
    const leftCtx = getContext(leftCanvas);
    if (leftCtx) {
      leftCtx.lineTo(point.x, point.y);
      leftCtx.stroke();
    }

    // 绘制右侧（镜像）
    const rightCtx = getContext(rightCanvas);
    if (rightCtx) {
      const size = leftCanvas.width / (window.devicePixelRatio || 1);
      const mirrorX = size - point.x;

      if (pathRef.current.length === 1) {
        rightCtx.beginPath();
        rightCtx.moveTo(mirrorX, point.y);
      } else {
        rightCtx.lineTo(mirrorX, point.y);
      }
      rightCtx.stroke();
    }
  }, [isDrawing, isActive]);

  // 结束绘制
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    setHasDrawn(true);
  }, [isDrawing]);

  // 从事件获取坐标
  const getPointFromEvent = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr,
      timestamp: Date.now()
    };
  };

  // 清除画布
  const clearCanvas = useCallback(() => {
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (!leftCanvas || !rightCanvas) return;

    [leftCanvas, rightCanvas].forEach(canvas => {
      const ctx = getContext(canvas);
      if (ctx) {
        const size = canvas.width / (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, size, size);
      }
    });

    pathRef.current = [];
    setHasDrawn(false);

    // 重新初始化画布设置并绘制目标形状
    initCanvas();
  }, [initCanvas]);

  // 提交结果
  const submitResult = useCallback(() => {
    const size = (leftCanvasRef.current?.width || 300) / (window.devicePixelRatio || 1);

    // 计算对称性分数
    const leftPoints = pathRef.current;
    const rightPoints = leftPoints.map(p => ({
      x: size - p.x,
      y: p.y,
      timestamp: p.timestamp
    }));

    const symmetryScore = calculateSymmetryScore(leftPoints, rightPoints, size);
    const completeness = calculateCompleteness(leftPoints, targetShape, size);

    onComplete({
      symmetryScore,
      completeness,
      leftPath: { points: leftPoints },
      rightPath: { points: rightPoints }
    });
  }, [onComplete, targetShape]);

  // 计算对称性分数
  const calculateSymmetryScore = (left: Point[], right: Point[], size: number): number => {
    if (left.length === 0) return 0;

    // 简化：计算左侧点与右侧镜像点的匹配度
    let totalDiff = 0;
    let compareCount = 0;

    // 每5个点采样一次
    for (let i = 0; i < left.length; i += 5) {
      const leftPoint = left[i];
      const mirrorX = size - leftPoint.x;

      // 找到右侧最近的点
      let minDiff = Infinity;
      for (const rightPoint of right) {
        const dx = rightPoint.x - mirrorX;
        const dy = rightPoint.y - leftPoint.y;
        const diff = Math.sqrt(dx * dx + dy * dy);
        minDiff = Math.min(minDiff, diff);
      }

      totalDiff += minDiff;
      compareCount++;
    }

    const avgDiff = totalDiff / compareCount;
    // 转换为分数（越接近0越高分）
    const score = Math.max(0, 100 - avgDiff * 2);
    return Math.round(score);
  };

  // 计算完整性分数（相对于目标形状）
  const calculateCompleteness = (points: Point[], shape: TargetShape, size: number): number => {
    if (points.length < 10) return 0;

    // 计算点的覆盖范围
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height;
    const expectedArea = (size * 0.7) * (size * 0.7);

    // 根据形状类型评估
    let shapeScore = 0;
    switch (shape) {
      case 'line':
        // 线条应该是扁平的
        shapeScore = height < width * 0.3 ? 100 : 50;
        break;
      case 'circle':
      case 'square':
        // 应该有合理的宽高比
        const ratio = Math.min(width, height) / Math.max(width, height);
        shapeScore = ratio * 100;
        break;
      case 'triangle':
        // 三角形底部宽，顶部窄
        shapeScore = width > height * 0.5 ? 80 : 60;
        break;
    }

    // 覆盖范围分数
    const coverageScore = Math.min(100, (area / expectedArea) * 100);

    return Math.round((shapeScore + coverageScore) / 2);
  };

  // 倒计时
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(30);
      clearCanvas();
      return;
    }

    initCanvas();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          submitResult();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, initCanvas, clearCanvas, submitResult]);

  // 如果游戏不活跃
  if (!isActive) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">✋</div>
        <p className="text-muted-foreground">点击开始训练进入游戏</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 倒计时 */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          目标形状: <span className="font-bold text-foreground capitalize">{targetShape}</span>
        </div>
        <div className={cn(
          "text-2xl font-bold font-headline",
          timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-foreground"
        )}>
          {timeLeft}s
        </div>
      </div>

      {/* 双画布区域 */}
      <div className="flex justify-center gap-4 mb-6">
        {/* 左侧：绘制区域 */}
        <div className="relative">
          <div className="absolute -top-6 left-0 text-xs text-muted-foreground">左侧绘制</div>
          <canvas
            ref={leftCanvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={cn(
              "border-2 rounded-xl touch-none cursor-crosshair",
              isDrawing ? "border-primary" : "border-border"
            )}
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
        </div>

        {/* 分割线 */}
        <div className="w-px bg-border" />

        {/* 右侧：镜像显示 */}
        <div className="relative">
          <div className="absolute -top-6 left-0 text-xs text-muted-foreground">实时镜像</div>
          <canvas
            ref={rightCanvasRef}
            className="border-2 border-border rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center gap-4">
        <button
          onClick={clearCanvas}
          className="px-6 py-2 rounded-lg bg-accent hover:bg-accent/80 text-sm font-medium transition-all"
        >
          清除重画
        </button>
        <button
          onClick={submitResult}
          disabled={!hasDrawn}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-medium transition-all",
            hasDrawn
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          提交
        </button>
      </div>

      {/* 提示 */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        在左侧画布上沿虚线绘制目标形状，右侧会实时显示镜像效果
      </p>
    </div>
  );
}

export { type TargetShape };
