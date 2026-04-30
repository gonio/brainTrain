import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AvatarUploaderProps {
  currentAvatar?: string;
  onUpload: (base64Image: string) => void;
}

// 压缩图片
async function compressImage(file: File, maxWidth: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('无法创建 canvas 上下文'));
      return;
    }

    img.onload = () => {
      // 计算缩放后的尺寸
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // 绘制压缩后的图片
      ctx.drawImage(img, 0, 0, width, height);

      // 转换为 base64 (JPEG 格式，质量 0.8)
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(base64);
    };

    img.onerror = () => reject(new Error('图片加载失败'));

    // 读取文件
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUploader({ currentAvatar, onUpload }: AvatarUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustomImage = currentAvatar?.startsWith('data:image');
  const displayAvatar = preview || (isCustomImage ? currentAvatar : null);

  const handleFile = async (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      onUpload(compressed);
    } catch (error) {
      console.error('图片处理失败:', error);
      alert('图片处理失败，请重试');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* 预览区域 */}
      {displayAvatar && (
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <img
              src={displayAvatar}
              alt="头像预览"
              className="w-24 h-24 rounded-full object-cover border-4 border-primary"
            />
            <button
              onClick={() => {
                setPreview(null);
                onUpload('👤'); // 恢复默认
              }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}

      {/* 上传区域 */}
      <motion.div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="text-4xl mb-2">📷</div>
        <p className="text-sm font-medium text-foreground">
          {isDragging ? '松开以上传' : '点击或拖拽上传头像'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          支持 JPG、PNG 格式，最大 5MB
        </p>
      </motion.div>
    </div>
  );
}
