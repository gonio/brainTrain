import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/userStore';
import { AvatarPicker } from '../components/AvatarPicker';
import { AvatarUploader } from '../components/AvatarUploader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getTrainingRecords } from '../db/queries';
import type { TrainingRecord } from '../types';

// 计算训练统计
function calculateStats(records: TrainingRecord[]) {
  const totalSessions = records.length;
  const totalTime = records.reduce((sum, r) => sum + r.duration, 0);
  const avgScore = totalSessions > 0
    ? records.reduce((sum, r) => sum + r.score, 0) / totalSessions
    : 0;
  const avgAccuracy = totalSessions > 0
    ? records.reduce((sum, r) => sum + r.accuracy, 0) / totalSessions
    : 0;

  return {
    totalSessions,
    totalTime: Math.round(totalTime / 60), // 转换为分钟
    avgScore: Math.round(avgScore),
    avgAccuracy: Math.round(avgAccuracy),
  };
}

export default function Profile() {
  const { profile, loadProfile, updateProfile } = useUserStore();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string>('👤');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载用户资料
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 同步本地状态
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setAvatar(profile.avatar || '👤');
    }
  }, [profile]);

  // 加载训练记录
  useEffect(() => {
    getTrainingRecords().then(setRecords);
  }, []);

  const stats = calculateStats(records);

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert('请输入昵称');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatar,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setDisplayName(profile.displayName);
      setAvatar(profile.avatar || '👤');
    }
    setIsEditing(false);
  };

  const isCustomImage = avatar?.startsWith('data:image');

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 头部 */}
      <div className="bg-gradient-to-b from-primary/10 to-background pt-8 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative inline-block"
          >
            {isCustomImage ? (
              <img
                src={avatar}
                alt="头像"
                className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground text-5xl flex items-center justify-center border-4 border-background shadow-lg">
                {avatar || '👤'}
              </div>
            )}

            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                📷
              </button>
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-2xl font-bold"
          >
            {profile?.displayName || '用户'}
          </motion.h1>

          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-sm mt-1"
          >
            加入于 {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('zh-CN')
              : new Date().toLocaleDateString('zh-CN')
            }
          </motion.p>

          {!isEditing && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="mt-4"
              >
                编辑资料
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-2xl mx-auto px-4 -mt-6">
        {/* 统计卡片 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">训练统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-accent/50 rounded-xl">
                  <div className="text-2xl font-bold text-primary">{stats.totalSessions}</div>
                  <div className="text-xs text-muted-foreground mt-1">总训练次数</div>
                </div>
                <div className="text-center p-3 bg-accent/50 rounded-xl">
                  <div className="text-2xl font-bold text-primary">{stats.totalTime}</div>
                  <div className="text-xs text-muted-foreground mt-1">总训练分钟</div>
                </div>
                <div className="text-center p-3 bg-accent/50 rounded-xl">
                  <div className="text-2xl font-bold text-primary">{stats.avgScore}</div>
                  <div className="text-xs text-muted-foreground mt-1">平均分数</div>
                </div>
                <div className="text-center p-3 bg-accent/50 rounded-xl">
                  <div className="text-2xl font-bold text-primary">{stats.avgAccuracy}%</div>
                  <div className="text-xs text-muted-foreground mt-1">平均准确率</div>
                </div>
              </div>

              {/* 连续训练天数 */}
              <div className="mt-6 flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
                <div>
                  <div className="text-sm font-medium">当前连续训练</div>
                  <div className="text-xs text-muted-foreground">保持好习惯，继续加油！</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    {profile?.currentStreak || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">天</div>
                </div>
              </div>

              {/* 最长连续记录 */}
              <div className="mt-4 flex items-center justify-between p-4 bg-accent/50 rounded-xl">
                <div className="text-sm font-medium">最长连续记录</div>
                <div className="text-right">
                  <span className="text-xl font-bold">{profile?.longestStreak || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1">天</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 编辑资料 */}
        {isEditing && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">编辑资料</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 昵称输入 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">昵称</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="请输入昵称"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    {displayName.length}/20 字符
                  </p>
                </div>

                {/* 头像选择 */}
                <Tabs defaultValue={isCustomImage ? "upload" : "preset"}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preset">预设头像</TabsTrigger>
                    <TabsTrigger value="upload">上传图片</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preset">
                    <AvatarPicker
                      currentAvatar={isCustomImage ? '👤' : avatar}
                      onSelect={setAvatar}
                    />
                  </TabsContent>

                  <TabsContent value="upload">
                    <AvatarUploader
                      currentAvatar={isCustomImage ? avatar : undefined}
                      onUpload={setAvatar}
                    />
                  </TabsContent>
                </Tabs>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="flex-1"
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
