import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('工具函数测试', () => {
  describe('cn 函数', () => {
    it('应该合并多个 className', () => {
      const result = cn('class1', 'class2')
      expect(result).toBe('class1 class2')
    })

    it('应该处理条件 className', () => {
      const result = cn('base', false && 'hidden', true && 'visible')
      expect(result).toBe('base visible')
    })

    it('应该处理对象形式的 className', () => {
      const result = cn({ active: true, disabled: false })
      expect(result).toBe('active')
    })

    it('应该正确处理 tailwind 冲突类', () => {
      const result = cn('px-2 py-1', 'px-4')
      // tailwind-merge 应该保留后面的 px-4
      expect(result).toBe('py-1 px-4')
    })
  })
})
