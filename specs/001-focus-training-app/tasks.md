# Implementation Tasks: 专注力训练Web应用

**Feature Branch**: `001-focus-training-app`
**Generated**: 2026-03-29 (Updated)
**Tech Stack**: React 19 + TypeScript 5.x + Vite + Tailwind CSS + shadcn/ui + Zustand + Dexie.js

---

## Phase 1: Project Setup

**Goal**: Initialize the React project with all necessary dependencies and configurations

**Independent Test**: Project can be started with `pnpm dev` and shows default Vite + React welcome page

- [X] T001 Initialize Vite + React + TypeScript project using `pnpm create vite@latest brain-train --template react-ts`
- [X] T002 Install and configure Tailwind CSS 4 with Vite plugin
- [X] T003 Initialize shadcn/ui
- [X] T004 Install core dependencies: `zustand dexie framer-motion howler js @types/howler`
- [X] T005 Install dev dependencies: `vitest @testing-library/react @testing-library/jest-dom jsdom @vite-pwa/assets-generator`
- [X] T006 Configure Vite PWA plugin with manifest and Workbox options
- [X] T007 Set up project folder structure (src/{components,pages,hooks,stores,db,types,lib,styles})
- [X] T008 Create `tsconfig.json` path aliases for clean imports (`@/components`, `@/pages`, etc.)
- [X] T009 Set up Vitest configuration
- [X] T010 Create `.gitignore` with standard Node.js/React exclusions

---

## Phase 2: Foundational Architecture

**Goal**: Build the core infrastructure that all user stories depend on

**Independent Test**: Database operations work in browser DevTools console; stores can be inspected with React DevTools

### Database Layer
- [X] T011 [P] Create Dexie.js database schema in `src/db/index.ts` with tables: userProfile, trainingRecords, dailyGoals
- [X] T012 [P] Implement DAL queries in `src/db/queries.ts`: getUserProfile, updateUserProfile, saveTrainingRecord, getTrainingRecords, getDailyGoal, updateDailyGoal
- [X] T013 Create TypeScript type definitions in `src/types/index.ts` for all entities (UserProfile, TrainingRecord, TrainingDetails variants, DailyGoal, Statistics)

### State Management
- [X] T014 [P] Create Zustand user store in `src/stores/userStore.ts` with profile state and actions
- [X] T015 [P] Create Zustand game store in `src/stores/gameStore.ts` with game session state management and gameplay instructions control
- [X] T016 Create Zustand settings store in `src/stores/settingsStore.ts` with theme (auto/light/dark), sound, TTS preferences

### Custom Hooks
- [X] T017 [P] Implement `useTimer` hook in `src/hooks/useTimer.ts` with start/pause/reset and elapsed time
- [X] T018 [P] Implement `useAudio` hook in `src/hooks/useAudio.ts` using Howler.js for effects and TTS
- [X] T019 Implement `useStats` hook in `src/hooks/useStats.ts` for computing statistics from records

### UI Components (shadcn/ui)
- [X] T020 [P] Install shadcn components: button, card, dialog, tabs, toggle, tooltip
- [X] T021 [P] Create layout components: `AppLayout.tsx`, `NavBar.tsx` in `src/components/layout/`
- [X] T022 Create game shared components: `GameCard.tsx`, `ScoreBoard.tsx`, `Timer.tsx`, `GameplayInstructions.tsx` in `src/components/game/`

### Utilities
- [X] T023 [P] Create utility functions in `src/lib/utils.ts` (cn helper, formatters, validators)
- [X] T024 Create statistics computation utilities in `src/lib/stats.ts`

---

## Phase 3: User Story 1 - 舒尔特表视觉训练 (P1)

**Goal**: Implement Schulte table game with fixed hard mode (5x5 grid, descending order)

**Independent Test**: User can start Schulte game, click numbers 25→1 in order, see completion time and accuracy

- [X] T025 [US1] Create `Schulte.tsx` page component in `src/pages/games/`
- [X] T026 [US1] Create `SchulteGrid` component with 5x5 clickable number cells (fixed hard mode)
- [X] T027 [US1] Implement descending order gameplay (25→1) with visual feedback
- [X] T028 [US1] Add click handling with correct/wrong feedback and progress tracking
- [X] T029 [US1] Add timer integration and completion detection
- [X] T030 [US1] Create result calculation (time, errors, score) with hard mode multiplier (1.2x)
- [X] T031 [US1] Add gameplay instructions modal for Schulte (目标、玩法、评分规则)
- [X] T032 [US1] Add route for `/games/schulte` in `App.tsx`
- [X] T033 [US1] Add game card to Home page with icon and description

---

## Phase 4: User Story 2 - 字色干扰抑制训练 (P1)

**Goal**: Implement Stroop effect game with fixed hard mode (20 questions, 1.5s time limit)

**Independent Test**: User sees colored words, selects color name within 1.5s, gets feedback, sees accuracy and reaction time stats

- [X] T034 [US2] Create `Stroop.tsx` page component in `src/pages/games/`
- [X] T035 [US2] Implement word-color pair generation with incongruent conditions
- [X] T036 [US2] Create color option buttons with accessibility support (shapes/icons for colorblind users)
- [X] T037 [US2] Implement reaction time tracking per question with 1.5s hard mode limit
- [X] T038 [US2] Add question sequence management (fixed 20 questions per session)
- [X] T039 [US2] Create result calculation (accuracy, avg reaction time, score with speed bonus)
- [X] T040 [US2] Add gameplay instructions modal for Stroop (目标、玩法、评分规则)
- [X] T041 [US2] Add route for `/games/stroop` in `App.tsx`
- [X] T042 [US2] Add game card to Home page

---

## Phase 5: User Story 3 - 序列工作记忆训练 (P2)

**Goal**: Implement sequence memory game with fixed hard mode (10 items)

**Independent Test**: User sees sequence of 10 items, recalls them in order, sees position and item accuracy

- [X] T043 [US3] Create `Sequence.tsx` page component in `src/pages/games/`
- [X] T044 [US3] Create `SequenceGame` component with 10-item sequence generation (fixed hard mode)
- [X] T045 [US3] Implement memorize phase with animated item display
- [X] T046 [US3] Implement recall phase with selectable items
- [X] T047 [US3] Add sequence comparison logic for scoring (position + item accuracy)
- [X] T048 [US3] Add gameplay instructions modal for Sequence (目标、玩法、评分规则)
- [X] T049 [US3] Add route for `/games/sequence` in `App.tsx`
- [X] T050 [US3] Add game card to Home page

---

## Phase 6: User Story 4 - 听觉选择性注意训练 (P2)

**Goal**: Implement auditory attention game with fixed hard mode (7 digits)

**Independent Test**: User hears 7-digit sequence, inputs what they heard, optionally with background noise

- [X] T051 [US4] Create `Auditory.tsx` page component in `src/pages/games/`
- [X] T052 [US4] Implement 7-digit sequence generation (fixed hard mode)
- [X] T053 [US4] Create audio playback using Web Speech API TTS
- [X] T054 [US4] Implement background noise generation option (white/pink noise)
- [X] T055 [US4] Create digit input interface (numpad or number buttons)
- [X] T056 [US4] Add audio replay functionality (limited uses)
- [X] T057 [US4] Create result calculation (correct digits, sequence accuracy, score with noise bonus)
- [X] T058 [US4] Add gameplay instructions modal for Auditory (目标、玩法、评分规则)
- [X] T059 [US4] Add route for `/games/auditory` in `App.tsx`
- [X] T060 [US4] Add game card to Home page

---

## Phase 7: User Story 5 - 双侧肢体镜像协调训练 (P3)

**Goal**: Implement mirror drawing game with fixed hard mode (triangle shape, 30s limit)

**Independent Test**: User draws triangle on left canvas, right canvas mirrors in real-time, system scores symmetry and completeness

- [X] T061 [US5] Create `Mirror.tsx` page component in `src/pages/games/`
- [X] T062 [US5] Implement dual canvas setup with HTML5 Canvas API
- [X] T063 [US5] Create drawing engine with touch and mouse support
- [X] T064 [US5] Implement real-time mirroring (horizontal flip) on right canvas
- [X] T065 [US5] Create fixed triangle target shape display (hard mode)
- [X] T066 [US5] Implement 30-second time limit for drawing
- [X] T067 [US5] Implement path recording and symmetry scoring algorithm (60% weight)
- [X] T068 [US5] Create result calculation (symmetry score 60%, completeness 40%)
- [X] T069 [US5] Add gameplay instructions modal for Mirror (目标、玩法、评分规则)
- [X] T070 [US5] Add route for `/games/mirror` in `App.tsx`
- [X] T071 [US5] Add game card to Home page

---

## Phase 8: User Story 6 - 规则导向分类逻辑训练 (P3)

**Goal**: Implement classification game with fixed hard mode (15 items, rule switches every 3-5 items)

**Independent Test**: User sorts 15 items by current rule, adapts when rule changes, gets adaptation bonus

- [X] T072 [US6] Create `Classify.tsx` page component in `src/pages/games/`
- [X] T073 [US6] Implement item generation with multiple attributes (color, shape, size)
- [X] T074 [US6] Create classification rules engine (color/shape/size)
- [X] T075 [US6] Implement rule switching logic (every 3-5 items, fixed hard mode)
- [X] T076 [US6] Create button-based classification UI
- [X] T077 [US6] Implement reaction time tracking with 1.5s speed bonus threshold
- [X] T078 [US6] Create result calculation (accuracy, avg reaction time, rule adaptation bonus, score)
- [X] T079 [US6] Add gameplay instructions modal for Classify (目标、玩法、评分规则)
- [X] T080 [US6] Add route for `/games/classify` in `App.tsx`
- [X] T081 [US6] Add game card to Home page

---

## Phase 9: User Story 7 - 情景联想记忆训练 (P3)

**Goal**: Implement story-based memory game with fixed hard mode (7 items, 10s memorize time)

**Independent Test**: User sees 7 items for 10s, creates story, recalls items, sees story completeness and accuracy

- [X] T082 [US7] Create `Story.tsx` page component in `src/pages/games/`
- [X] T083 [US7] Implement random scene selection with 7 items (fixed hard mode)
- [X] T084 [US7] Create 10-second memorize countdown with item display
- [X] T085 [US7] Create item recall selection interface
- [X] T086 [US7] Create story composition interface (textarea with prompts)
- [X] T087 [US7] Implement story saving to training record
- [X] T088 [US7] Create result calculation (recall accuracy, story completeness, score)
- [X] T089 [US7] Add gameplay instructions modal for Story (目标、玩法、评分规则)
- [X] T090 [US7] Add route for `/games/story` in `App.tsx`
- [X] T091 [US7] Add game card to Home page

---

## Phase 10: Cross-Cutting Features & Polish

**Goal**: Implement statistics, settings, PWA assets, and overall polish

**Independent Test**: User can view stats, change settings, install PWA, use daily goals

### Statistics & Progress
- [X] T092 [P] Create `Stats.tsx` page with overall and per-mode statistics
- [X] T093 [P] Implement progress charts (recharts or chart.js integration)
- [X] T094 [P] Add trend visualization (7/30/90 day views)
- [X] T095 [P] Create personal best and streak displays

### Settings
- [X] T096 [P] Create `Settings.tsx` page with preferences form
- [X] T097 [P] Implement theme switching (light/dark/auto) with system preference default
- [X] T098 [P] Add sound and TTS toggle controls
- [X] T099 [P] Create daily goal settings (no difficulty setting - fixed hard mode)

### PWA & Assets
- [X] T100 [P] Generate PWA icons (192x192, 512x512, maskable variants)
- [X] T101 [P] Create `manifest.json` with app metadata
- [X] T102 [P] Add PWA install prompt component
- [X] T103 [P] Test offline functionality with Service Worker

### Daily Goals
- [X] T104 [P] Implement daily goal tracking and completion detection
- [X] T105 [P] Create streak calculation and display
- [X] T106 [P] Add goal progress indicator in NavBar

### UI/UX Polish
- [X] T107 [P] Add Framer Motion page transitions
- [X] T108 [P] Implement loading states and skeletons
- [X] T109 [P] Add error boundaries for crash recovery
- [X] T110 [P] Create onboarding/tutorial for first-time users
- [X] T111 [P] Implement responsive design refinements for mobile
- [X] T112 [P] Ensure WCAG AA contrast ratio (4.5:1) for all text in both themes

### Performance & Quality
- [X] T113 [P] Optimize bundle size with lazy loading for game pages
- [X] T114 [P] Add performance monitoring (Web Vitals)
- [X] T115 [P] Run Lighthouse audit and address issues
- [X] T116 [P] Final cross-browser and device testing

---

## Task Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundation)
    ├── Database (T011-T013)
    ├── Stores (T014-T016)
    ├── Hooks (T017-T019)
    ├── UI Components (T020-T022)
    └── Utils (T023-T024)
    ↓
Phase 3-9 (User Stories - PARALLEL after foundation)
    ├── US1 (Schulte) - T025-T033
    ├── US2 (Stroop) - T034-T042
    ├── US3 (Sequence) - T043-T050
    ├── US4 (Auditory) - T051-T060
    ├── US5 (Mirror) - T061-T071
    ├── US6 (Classify) - T072-T081
    └── US7 (Story) - T082-T091
    ↓
Phase 10 (Polish - some parallel with late stories)
    ├── Stats (T092-T095)
    ├── Settings (T096-T099)
    ├── PWA (T100-T103)
    ├── Daily Goals (T104-T106)
    ├── UI Polish (T107-T112)
    └── Performance (T113-T116)
```

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundation)
- T011, T014, T017, T020, T023 can be done in parallel
- T012, T015, T018, T021, T024 can be done in parallel (after above)
- T013, T016, T019, T022 depend on their parallel groups

### User Stories (After Phase 2)
All 7 user stories (Phase 3-9) can be developed in parallel by different developers:
- Developer A: US1 (Schulte) + US2 (Stroop)
- Developer B: US3 (Sequence) + US4 (Auditory)
- Developer C: US5 (Mirror) + US6 (Classify)
- Developer D: US7 (Story) + Cross-cutting features

### Phase 10 (Polish)
Most polish tasks marked with [P] can be done in parallel:
- Stats, Settings, PWA assets can be done simultaneously
- Daily goals and UI polish can be done in parallel

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
Complete **Phase 1-3 only**:
- Project setup (T001-T010)
- Foundation (T011-T024)
- US1: 舒尔特表 (T025-T033)

This gives a fully functional single-game app that demonstrates all technical patterns.

### Recommended Delivery Phases

**Sprint 1**: Foundation + US1 (Schulte)
- Tasks: T001-T033
- Deliverable: Working Schulte game with stats tracking

**Sprint 2**: Core Games
- Tasks: T034-T060 (US2 Stroop + US3 Sequence + US4 Auditory)
- Deliverable: 4 complete training modes

**Sprint 3**: Advanced Games + Polish
- Tasks: T061-T095 (US5-7) + T092-T099 (Stats + Settings)
- Deliverable: All 7 games with stats and settings

**Sprint 4**: PWA + Final Polish
- Tasks: T100-T116
- Deliverable: Production-ready PWA with offline support

---

## Key Design Decisions (Post-Clarification)

### Fixed Hard Mode
All training modes use fixed hard mode parameters:
- **舒尔特表**: 5x5网格，降序(25→1)
- **字色干扰**: 20题，1.5秒限时
- **序列记忆**: 10个物品
- **听觉注意**: 7位数字
- **镜像协调**: 三角形，30秒限时
- **分类逻辑**: 15题，3-5题切换规则
- **情景联想**: 7个物品，10秒记忆时间

### Gameplay Instructions
Each game must display detailed instructions before starting:
- 训练目标
- 操作方式
- 评分规则
- 困难模式说明

### Theme System
- Default: `auto` (follows system preference)
- Options: `light`, `dark`, `auto`
- WCAG AA compliance: 4.5:1 contrast ratio

### No Operational Hints
- Training provides NO hints about "what to click next"
- Users must complete levels independently
- System only provides game rules and final feedback

---

## Task Statistics

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1: Setup | 10 | - |
| Phase 2: Foundation | 14 | - |
| Phase 3: US1 (Schulte) | 9 | P1 |
| Phase 4: US2 (Stroop) | 9 | P1 |
| Phase 5: US3 (Sequence) | 8 | P2 |
| Phase 6: US4 (Auditory) | 10 | P2 |
| Phase 7: US5 (Mirror) | 11 | P3 |
| Phase 8: US6 (Classify) | 10 | P3 |
| Phase 9: US7 (Story) | 10 | P3 |
| Phase 10: Polish | 25 | - |
| **Total** | **116** | - |

---

## Next Steps

1. Run `/speckit.implement` to start implementing tasks
2. Or manually begin with T001 (project setup)
3. Consider creating a git commit after each phase completion
