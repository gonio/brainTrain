import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// 场景物品类型
interface SceneItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
}

// 场景类型
interface Scene {
  id: string;
  name: string;
  description: string;
  items: SceneItem[];
}

// 预定义场景
const SCENES: Scene[] = [
  {
    id: 'kitchen',
    name: '厨房',
    description: '一个充满生活气息的厨房...',
    items: [
      { id: 'k1', name: '冰箱', emoji: '🧊', category: '电器' },
      { id: 'k2', name: '微波炉', emoji: '📟', category: '电器' },
      { id: 'k3', name: '刀', emoji: '🔪', category: '厨具' },
      { id: 'k4', name: '锅', emoji: '🍳', category: '厨具' },
      { id: 'k5', name: '苹果', emoji: '🍎', category: '食材' },
      { id: 'k6', name: '面包', emoji: '🍞', category: '食材' },
      { id: 'k7', name: '牛奶', emoji: '🥛', category: '食材' },
    ],
  },
  {
    id: 'office',
    name: '办公室',
    description: '一个现代化的办公空间...',
    items: [
      { id: 'o1', name: '电脑', emoji: '💻', category: '设备' },
      { id: 'o2', name: '打印机', emoji: '🖨️', category: '设备' },
      { id: 'o3', name: '咖啡', emoji: '☕', category: '饮品' },
      { id: 'o4', name: '笔记本', emoji: '📓', category: '文具' },
      { id: 'o5', name: '笔', emoji: '✏️', category: '文具' },
      { id: 'o6', name: '电话', emoji: '📞', category: '设备' },
    ],
  },
  {
    id: 'park',
    name: '公园',
    description: '一个宁静的户外公园...',
    items: [
      { id: 'p1', name: '长椅', emoji: '🪑', category: '设施' },
      { id: 'p2', name: '树', emoji: '🌳', category: '自然' },
      { id: 'p3', name: '花', emoji: '🌸', category: '自然' },
      { id: 'p4', name: '狗', emoji: '🐕', category: '动物' },
      { id: 'p5', name: '自行车', emoji: '🚲', category: '物品' },
    ],
  },
];

interface StoryGameProps {
  isActive: boolean;
  onComplete: (result: {
    scene: Scene;
    recalledItems: string[];
    storyCompleteness: number;
    recallAccuracy: number;
  }) => void;
}

// 游戏阶段
type GamePhase = 'memorize' | 'recall' | 'story';

export function StoryGame({ isActive, onComplete }: StoryGameProps) {
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [phase, setPhase] = useState<GamePhase>('memorize');
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState(15);
  const [recalledItems, setRecalledItems] = useState<string[]>([]);
  const [userStory, setUserStory] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 随机选择场景
  const selectRandomScene = useCallback(() => {
    return SCENES[Math.floor(Math.random() * SCENES.length)];
  }, []);

  // 开始游戏
  useEffect(() => {
    if (!isActive) {
      setCurrentScene(null);
      setPhase('memorize');
      setMemorizeTimeLeft(15);
      setRecalledItems([]);
      setUserStory('');
      setSelectedItems(new Set());
      return;
    }

    const scene = selectRandomScene();
    setCurrentScene(scene);
    setPhase('memorize');
    setMemorizeTimeLeft(15);
  }, [isActive, selectRandomScene]);

  // 记忆阶段倒计时
  useEffect(() => {
    if (!isActive || phase !== 'memorize' || !currentScene) return;

    if (memorizeTimeLeft <= 0) {
      setPhase('recall');
      return;
    }

    const timer = setTimeout(() => {
      setMemorizeTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isActive, phase, memorizeTimeLeft, currentScene]);

  // 切换物品选择
  const toggleItem = useCallback((itemName: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  }, []);

  // 提交回忆结果
  const submitRecall = useCallback(() => {
    const recalled = Array.from(selectedItems);
    setRecalledItems(recalled);
    setPhase('story');
  }, [selectedItems]);

  // 提交故事
  const submitStory = useCallback(() => {
    if (!currentScene) return;

    // 计算回忆准确率
    const correctItems = recalledItems.filter(name =>
      currentScene.items.some(item => item.name === name)
    );
    const recallAccuracy = Math.round((correctItems.length / currentScene.items.length) * 100);

    // 计算故事完整度（基于回忆到的物品数量）
    const storyCompleteness = Math.round((recalledItems.length / currentScene.items.length) * 100);

    onComplete({
      scene: currentScene,
      recalledItems,
      storyCompleteness,
      recallAccuracy,
    });
  }, [currentScene, recalledItems, userStory, onComplete]);

  // 如果游戏不活跃
  if (!isActive) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-12">
        <div className="text-6xl mb-4">📖</div>
        <p className="text-muted-foreground">点击开始训练进入游戏</p>
      </div>
    );
  }

  if (!currentScene) return null;

  // 记忆阶段
  if (phase === 'memorize') {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* 倒计时 */}
        <div className="mb-6 text-center">
          <div className="text-sm text-muted-foreground mb-2">记忆时间</div>
          <div className={cn(
            "text-4xl font-bold font-headline",
            memorizeTimeLeft <= 5 ? "text-red-500 animate-pulse" : "text-primary"
          )}>
            {memorizeTimeLeft}s
          </div>
        </div>

        {/* 场景描述 */}
        <div className="mb-6 text-center">
          <h3 className="text-xl font-bold mb-2">{currentScene.name}</h3>
          <p className="text-sm text-muted-foreground">{currentScene.description}</p>
        </div>

        {/* 物品展示 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {currentScene.items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-square bg-surface-container rounded-xl flex flex-col items-center justify-center p-2"
            >
              <span className="text-3xl mb-1">{item.emoji}</span>
              <span className="text-xs text-center">{item.name}</span>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          记住这些物品，时间结束后会选择你记住的物品
        </p>
      </div>
    );
  }

  // 回忆阶段
  if (phase === 'recall') {
    // 所有可能的物品（包含一些干扰项）
    const allItems = [
      ...currentScene.items,
      { id: 'd1', name: '电话', emoji: '📞', category: '干扰' },
      { id: 'd2', name: '书', emoji: '📚', category: '干扰' },
      { id: 'd3', name: '球', emoji: '⚽', category: '干扰' },
      { id: 'd4', name: '伞', emoji: '☂️', category: '干扰' },
    ].sort(() => Math.random() - 0.5);

    return (
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6 text-center">
          <h3 className="text-lg font-bold mb-2">选择你记住的物品</h3>
          <p className="text-sm text-muted-foreground">
            已选择 {selectedItems.size} 个
          </p>
        </div>

        {/* 物品选择 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {allItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => toggleItem(item.name)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all",
                selectedItems.has(item.name)
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-surface-container hover:bg-surface-container-high"
              )}
            >
              <span className="text-3xl mb-1">{item.emoji}</span>
              <span className="text-xs text-center">{item.name}</span>
            </motion.button>
          ))}
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-center">
          <motion.button
            onClick={submitRecall}
            disabled={selectedItems.size === 0}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "px-8 py-3 rounded-xl font-semibold transition-all",
              selectedItems.size > 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            确认选择
          </motion.button>
        </div>
      </div>
    );
  }

  // 故事阶段
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold mb-2">编一个故事</h3>
        <p className="text-sm text-muted-foreground">
          用你记住的物品编一个简短的故事
        </p>
      </div>

      {/* 记住的物品 */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {recalledItems.map((name, index) => (
          <span
            key={index}
            className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
          >
            {name}
          </span>
        ))}
      </div>

      {/* 故事输入 */}
      <div className="mb-6">
        <textarea
          value={userStory}
          onChange={(e) => setUserStory(e.target.value)}
          placeholder={`在这个${currentScene.name}里，...`}
          className="w-full h-32 p-4 bg-surface-container rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-center">
        <motion.button
          onClick={submitStory}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg"
        >
          完成训练
        </motion.button>
      </div>
    </div>
  );
}

export { type Scene, type SceneItem };
