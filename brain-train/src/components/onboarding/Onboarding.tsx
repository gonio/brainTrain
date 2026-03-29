import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../stores/userStore';

// 引导步骤
const onboardingSteps = [
  {
    id: 'welcome',
    title: '欢迎来到 BrainTrain',
    description: '科学有效的专注力训练应用，帮助你提升认知能力和专注水平。',
    icon: '🧠',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    id: 'training',
    title: '多种训练模式',
    description: '7 种科学设计的训练模式，从视觉搜索到工作记忆，全面提升大脑能力。',
    icon: '🎯',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'progress',
    title: '追踪你的进步',
    description: '详细的统计和洞察，让你清楚了解自己的训练成果和进步趋势。',
    icon: '📊',
    color: 'from-pink-500 to-orange-500'
  },
  {
    id: 'daily',
    title: '养成训练习惯',
    description: '设置每日目标，保持连胜记录，让大脑训练成为日常习惯。',
    icon: '🔥',
    color: 'from-orange-500 to-amber-500'
  },
  {
    id: 'ready',
    title: '准备好了吗？',
    description: '开始你的第一堂训练课，体验专注带来的清晰与高效。',
    icon: '🚀',
    color: 'from-amber-500 to-green-500'
  }
];

// 新用户引导组件
export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { profile, updateProfile } = useUserStore();

  // 检查是否是新用户
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding-completed');
    const hasSeenOnboarding = profile?.preferences?.hasSeenOnboarding;

    if (!hasCompletedOnboarding && !hasSeenOnboarding) {
      // 延迟显示，让用户先看到首页
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsOpen(false);
    localStorage.setItem('onboarding-completed', 'true');

    // 更新用户配置
    if (profile) {
      updateProfile({
        preferences: {
          ...profile.preferences,
          hasSeenOnboarding: true
        }
      });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = onboardingSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleSkip();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-surface-container rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* 进度条 */}
          <div className="h-1 bg-accent">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* 内容区域 */}
          <div className="p-8 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 图标 */}
                <motion.div
                  className={`w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center text-5xl shadow-lg`}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
                >
                  {step.icon}
                </motion.div>

                {/* 标题和描述 */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold font-headline">{step.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 底部操作 */}
          <div className="p-6 pt-0 space-y-4">
            {/* 步骤指示器 */}
            <div className="flex justify-center gap-2">
              {onboardingSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-primary w-6'
                      : 'bg-accent hover:bg-accent/80'
                  }`}
                />
              ))}
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="flex-1 px-4 py-3 rounded-xl bg-accent text-accent-foreground font-medium hover:bg-accent/80 transition-colors"
                >
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                className={`px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors ${
                  isFirstStep ? 'flex-1' : 'flex-[2]'
                }`}
              >
                {isLastStep ? '开始训练' : '下一步'}
              </button>
            </div>

            {/* 跳过按钮 */}
            {!isLastStep && (
              <button
                onClick={handleSkip}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                跳过引导
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// 简单的首次使用提示
export function FirstTimeTip({
  tip,
  onDismiss
}: {
  tip: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">{tip}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </motion.div>
  );
}

// 引导覆盖层 - 高亮特定元素
export function Spotlight({
  title,
  description,
  onNext,
  onSkip
}: {
  title: string;
  description: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] pointer-events-none"
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 提示卡片 */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute bottom-24 left-4 right-4 max-w-sm mx-auto bg-surface-container rounded-2xl p-6 shadow-2xl pointer-events-auto"
      >
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 rounded-xl bg-accent text-accent-foreground font-medium"
          >
            跳过
          </button>
          <button
            onClick={onNext}
            className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold"
          >
            知道了
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
