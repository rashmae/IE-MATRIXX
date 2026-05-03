# IE MATRIX Development Guidelines

You are an expert full-stack developer working on IE MATRIX, a React + TypeScript + Vite + Firebase + Tailwind CSS web portal for Industrial Engineering students at Cebu Technological University (CTU).

## Tech Stack
- React 18 + TypeScript + Vite
- Firebase (Firestore, Auth)
- Tailwind CSS with custom neumorphic design system
- Google Gemini API (`gemini-2.0-flash` model)
- `motion/react` for animations
- `react-markdown` for rendering AI responses
- `sonner` for toast notifications
- shadcn/ui components

## Brand & Design
- **Colors:** `ctu-gold` (accent), `ctu-maroon`, `navy-deep`
- **Design Classes:** `neumorphic-card`, `neumorphic-raised`, `neumorphic-pressed`, `frosted-header`, `tap-target` (44px min), `pb-safe`
- **Typography:** Headings use `text-3xl sm:text-5xl md:text-7xl lg:text-8xl`. Subtitles `text-base md:text-xl`.

## Mandatory Rules

### 1. AI Implementation
- **Model:** Always use `gemini-2.0-flash`.
- **API Key:** Use `import.meta.env.VITE_GEMINI_API_KEY`.
- **AI Advisor:** Must be multi-turn with curriculum + progress + roadmap context. Render with `ReactMarkdown`.

### 2. Grading System (CTU Scale)
- Grades are GWA (1.0–5.0), NOT percentage.
- **Labels:** ≤1.5 Excellent, ≤2.25 Good, ≤3.0 Passed, >3.0 Failed.
- **Inputs:** `step="0.25"`, `min="1.0"`, `max="5.0"`.

### 3. Responsiveness & UX
- **Mobile-First:** Use Tailwind prefixes (`sm:`, `md:`, `lg:`).
- **Tap Targets:** Elements must have `tap-target` class (44px min).
- **Safe Areas:** Main content padding `pb-36 lg:pb-10` to clear BottomNav. Page padding `p-4 sm:p-6 lg:p-10`.
- **Dialogs:** Use `h-[85dvh]`, `overflow-y-auto overscroll-contain`. Always use `asChild` on `DialogTrigger`.
- **Loading:** Use `SkeletonLoader.tsx` components. No raw spinners.

### 4. Performance
- Use `useMemo` for expensive filters/stats.
- Use `useDebounce` (300ms) for search inputs.
- Use `useLocalStorage` for syncing state.
- Debounce Firestore writes (800ms) using `useRef` timers.
- Use optimistic updates for UI responsiveness.

### 5. Firestore/Real-time
- Use `onSnapshot` for real-time updates (bulletin, resources, etc.).
- **Snapshot Merge:** Use `useRef` to store pieces (e.g. public/private) before merging/deduping to avoid stale closure bugs.

### 6. JSX & Code Quality
- Ensure all tags are closed.
- Use `import React from 'react'`.
- Use `cn()` for conditional classes.
- Use `shrink-0` on fixed-size elements in flex containers.
- Chat inputs: Use `shrink-0` with `border-t` (not `absolute bottom`) to avoid keyboard overlap.

## Navigation (BottomNav)
Must have 8 items: 
- Home (`/dashboard`)
- Catalog (`/catalog`)
- Study (`/study`)
- Progress (`/progress`)
- Bulletin (`/bulletin`)
- Calendar (`/calendar`)
- Notes (`/resources`)
- User (`/profile`)

Show labels only on active items.
