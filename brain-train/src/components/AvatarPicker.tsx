import { useState } from 'react';
import { motion } from 'framer-motion';

// 预设头像列表（emoji）
const PRESET_AVATARS = [
  '👤', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐙',
  '🦊', '🐰', '🐹', '🐭', '🐱', '🐶', '🐺', '🐗',
  '🦄', '🐴', '🦓', '🦒', '🦌', '🦘', '🦬', '🐃',
  '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐',
  '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐇',
  '🦝', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
  '🎃', '🎄', '🎆', '🎇', '🧨', '✨', '🎈', '🎉',
  '🌟', '⭐', '💫', '🔥', '⚡', '🌈', '☀️', '🌙',
];

interface AvatarPickerProps {
  currentAvatar?: string;
  onSelect: (avatar: string) => void;
}

export function AvatarPicker({ currentAvatar, onSelect }: AvatarPickerProps) {
  const [selected, setSelected] = useState(currentAvatar || '👤');

  const handleSelect = (avatar: string) => {
    setSelected(avatar);
    onSelect(avatar);
  };

  return (
    <div className="grid grid-cols-8 gap-2 p-4">
      {PRESET_AVATARS.map((avatar, index) => (
        <motion.button
          key={index}
          onClick={() => handleSelect(avatar)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`
            aspect-square rounded-xl text-2xl flex items-center justify-center
            transition-all duration-200
            ${selected === avatar
              ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
              : 'bg-accent hover:bg-accent/80'
            }
          `}
        >
          {avatar}
        </motion.button>
      ))}
    </div>
  );
}
