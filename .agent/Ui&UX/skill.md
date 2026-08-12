# UI & UX Design System & Guidelines

This document outlines the core UI/UX principles, design system tokens, and responsive mobile/tablet patterns used in the Cybergrow WhatsApp Automation platform.

---

## 🎨 Design Principles

1. **Alive & Dynamic Visuals**
   - Use soft glassmorphism (`backdrop-filter: blur(12px)`), vibrant gradients, subtle drop shadows, and lively micro-interactions.
   - Real-time status indicators with pulsing animations (e.g., connected/disconnected live state dots).
   - Smooth hover, focus, and active tap feedback (`transform: scale(0.98)` on touch devices).

2. **Mobile & Tablet First UX (Touch-Friendly)**
   - **Minimum Touch Target**: All clickable elements, buttons, nav items, and table action icons must be at least `44px x 44px` on mobile/tablet screens.
   - **Thumb-Zone Navigation**: Primary quick actions and section switching on mobile screens (<768px) should be reachable via an intuitive Mobile Bottom Bar.
   - **Single-Pane Mobile Views**: For dual-column complex components (like Chat inbox + thread), automatically collapse to single-pane navigation on mobile screens with a prominent back arrow.
   - **Responsive Data Views**: High-density tables must cleanly wrap horizontally with smooth touch-scrolling or switch to touch-friendly stacked cards on mobile views.

3. **Breakpoints Standard**
   - **Mobile (Small & Medium)**: `< 600px` (Full single-column, bottom nav active, full-bleed modals)
   - **Tablet (Portrait & Landscape)**: `600px - 1024px` (Adaptive 2-column grids, collapsible drawer, medium padding)
   - **Desktop**: `> 1024px` (Full sidebar layout, multi-column dashboard, split panes)

---

## 🛠️ Color Tokens & Glassmorphism

- **Primary Gradient**: `linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)`
- **Glass Card**: `background: var(--bg-white-translucent); backdrop-filter: blur(16px); border: 1px solid var(--border);`
- **Status Pulse**: `animation: statusPulse 2s infinite ease-in-out;`

---

## 📱 Responsive & Touch Rules

- **Inputs & Forms**: Font size on mobile inputs must be at least `16px` to prevent automatic iOS safari zooming.
- **Modals & Drawers**: Slide up from bottom on mobile with rounded top corners (`border-radius: 20px 20px 0 0`) and dark overlaybackdrop.
- **Scroll Containment**: Prevent background scrolling when mobile navigation drawer or full-screen modals are open.
