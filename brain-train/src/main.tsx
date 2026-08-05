import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

// 自托管字体（@fontsource-variable），打包进产物，不依赖 Google Fonts CDN，
// 避免网络受限时字体/图标加载失败。先于 globals.css 引入。
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import '@fontsource-variable/material-symbols-outlined'

import './styles/globals.css'
import { router } from './App.tsx'

// PWA service worker 注册：检测到新版本立即刷新（确保用户始终用最新代码）
import { registerSW } from 'virtual:pwa-register'
registerSW({
  onNeedRefresh() {
    window.location.reload()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
