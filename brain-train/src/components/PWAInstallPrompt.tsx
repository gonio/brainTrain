import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// PWA 安装提示组件
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // 检查提示是否过期（超过7天）
  const isPromptExpired = () => {
    const promptDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (!promptDismissed) return true;

    const dismissedTime = parseInt(promptDismissed, 10);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    return (now - dismissedTime) > sevenDays;
  };

  useEffect(() => {
    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // 阻止默认行为
      e.preventDefault();
      // 保存事件以便稍后使用
      setDeferredPrompt(e);
      // 显示安装提示
      // 延迟显示，避免页面加载时立即打扰用户
      setTimeout(() => {
        // 检查用户是否之前关闭过提示，如果超过7天则重新显示
        if (isPromptExpired()) {
          setShowPrompt(true);
        }
      }, 3000);
    };

    // 监听 appinstalled 事件
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setIsInstalled(true);
      localStorage.removeItem('pwa-prompt-dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 检查是否过期，如果过期则清除记录
    if (isPromptExpired()) {
      localStorage.removeItem('pwa-prompt-dismissed');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 处理安装
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // 显示安装提示
    deferredPrompt.prompt();

    // 等待用户响应
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('用户接受了 PWA 安装');
    } else {
      console.log('用户拒绝了 PWA 安装');
      // 7天内不再显示
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  // 关闭提示
  const handleDismiss = () => {
    setShowPrompt(false);
    // 24小时内不再显示
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // 如果已安装，不显示任何内容
  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="bg-surface-container/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
            {/* 应用图标 */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl flex-shrink-0">
              🧠
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">安装 BrainTrain</h3>
              <p className="text-xs text-muted-foreground truncate">
                添加到主屏幕，离线也能训练
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                稍后
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                安装
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 声明 BeforeInstallPromptEvent 类型（TypeScript 中没有内置此类型）
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}
