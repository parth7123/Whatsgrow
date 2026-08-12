# Frontend Engineering Guidelines

This document outlines frontend architecture, component practices, and responsive design execution for the React + Vite dashboard.

---

## 🚀 Architecture & State Management

1. **Modular Page & Component Layout**
   - Each page component in `src/pages` is paired with its CSS stylesheet.
   - Global layout shell handled in `src/components/Layout.tsx` and `src/components/Layout.css`.
   - Reusable hooks for window sizing (`useIsMobile`), theme control (`useTheme`), and role-based permissions (`useRole`).

2. **Responsive Component Guidelines**
   - **Adaptive Layout Shell**: Supports desktop fixed sidebar (260px / collapsed 72px), tablet adaptive layout, and mobile header + mobile drawer + mobile bottom bar.
   - **Chats View Dual/Single Pane**: Dynamically switches between active conversation and conversation list on mobile width (<768px).
   - **Dashboard Stat Cards**: Flex / Grid layout switching: 1 column on mobile, 2 column on tablet, 4 column on desktop.
   - **Table Overflow**: Container divs around tables use `overflow-x: auto` with `-webkit-overflow-scrolling: touch` and responsive scroll indicators.

3. **Performance & Micro-Animations**
   - CSS variables for theme palette switching without re-rendering components.
   - Hardware-accelerated CSS transforms (`translate3d`, `scale`) for 60fps animations.
