# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目章程 (Project Constitution)

本项目遵循 `.specify/memory/constitution.md` 中定义的章程，核心原则包括：

- **中文优先**: 所有文档、代码注释、UI 文本、提交信息必须使用中文
- **代码清晰**: 简洁、可读、自解释的代码
- **渐进交付**: 迭代式开发，每个用户故事独立可交付
- **独立可测**: 每个功能可独立测试验证
- **设计驱动**: 通过 Stitch MCP 生成 UI 设计确保视觉一致性

> **注意**: 编码时所有注释必须使用中文，技术术语和标识符保留英文。

## Project Context

This is a **BrainTrain** workspace configured for Google Cloud Stitch MCP integration. The workspace is set up to interact with the Stitch API via MCP (Model Context Protocol).

## Environment Configuration

- **Google Cloud Project**: `stich-brain`
- **MCP Server**: `stitch` (HTTP transport to `https://stitch.googleapis.com/mcp`)
- **Auth**: Bearer token-based authentication via `Authorization` header

## Available MCP Tools

The Stitch MCP server is configured in `.mcp.json` with the following headers:
- `Authorization: Bearer <token>`
- `X-Goog-User-Project: stich-brain`

## Development Notes

- Credentials are stored in `.env` (gitignored)
- MCP configuration is in `.mcp.json` (gitignored)
- Personal Claude settings are in `.claude/settings.local.json`

## Common Commands

```bash
# MCP server is managed via Claude Code - no manual start required
# To check MCP server status:
claude mcp list

# To re-add the Stitch MCP server if needed:
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp \
  --header "Authorization: Bearer $STITCH_ACCESS_TOKEN" \
  --header "X-Goog-User-Project: stich-brain" \
  -s user
```

## Recent Changes
- 002-app-bugfix-polish: Added TypeScript 5.x + React 19 + Vite 8, Tailwind CSS 4, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js, React Router v6 (data router)
- 002-app-bugfix-polish: Added TypeScript 5.x + React 19 + React, Vite, Tailwind CSS, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js
- 001-focus-training-app: Added TypeScript 5.x + React 19 + React, Vite, Tailwind CSS, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js

## Active Technologies
- TypeScript 5.x + React 19 + Vite 8, Tailwind CSS 4, shadcn/ui, Zustand, Dexie.js, Framer Motion, Howler.js, React Router v6 (data router) (002-app-bugfix-polish)
- IndexedDB via Dexie.js (3张表: userProfile, trainingRecords, dailyGoals) (002-app-bugfix-polish)
