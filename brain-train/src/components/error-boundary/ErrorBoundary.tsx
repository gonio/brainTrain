import { Component, type ReactNode, type ErrorInfo } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// 错误边界组件 - 捕获子组件树中的 JavaScript 错误
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态以便下次渲染时显示备用 UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误详情
    this.setState({
      error,
      errorInfo
    });

    // 调用外部错误处理回调
    this.props.onError?.(error, errorInfo);

    // 可以在这里添加错误上报逻辑
    console.error('ErrorBoundary 捕获到错误:', error);
    console.error('错误详情:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return <DefaultErrorFallback onReset={this.handleReset} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

// 默认错误 fallback UI
function DefaultErrorFallback({
  onReset,
  onReload
}: {
  onReset: () => void;
  onReload: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen flex items-center justify-center p-6 bg-background"
    >
      <div className="max-w-md w-full text-center space-y-6">
        {/* 错误图标 */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-24 h-24 mx-auto bg-destructive/10 rounded-full flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-5xl text-destructive">
            error_outline
          </span>
        </motion.div>

        {/* 错误信息 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-bold font-headline">出错了</h1>
          <p className="text-muted-foreground">
            应用遇到了意外问题，请尝试刷新页面或返回首页
          </p>
        </motion.div>

        {/* 操作按钮 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 justify-center"
        >
          <button
            onClick={onReset}
            className="px-6 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors"
          >
            重试
          </button>
          <button
            onClick={onReload}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            刷新页面
          </button>
        </motion.div>

        {/* 返回首页链接 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            返回首页
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}

// 小型错误边界 - 用于局部错误处理
export class SmallErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SmallErrorBoundary 捕获到错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 text-center bg-destructive/10 rounded-xl">
          <span className="material-symbols-outlined text-destructive text-2xl">
            error
          </span>
          <p className="text-sm text-destructive mt-1">加载失败</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// 异步错误处理 Hook
export function useAsyncError() {
  const [, setError] = useState<Error | null>(null);

  return useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// 从 react 导入 useState 和 useCallback
import { useState, useCallback } from 'react';
