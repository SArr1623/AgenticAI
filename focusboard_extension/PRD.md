# FocusBoard - Product Requirements Document (PRD)

## 1. Project Vision
FocusBoard is a high-performance productivity suite designed to transform the "New Tab" into a deep-work cockpit. It combines distraction blocking, active learning reinforcement, and sophisticated analytics to help users reclaim their attention and build consistent productivity habits.

---

## 2. Core Functionalities

### 2.1 Onboarding & Personalization
- **First-Time Setup**: Prompt user for their name and preferred wallpaper.
- **Dynamic Greeting**: Personalized greeting (e.g., "Good morning, Alex") with a real-time clock and manifestation messages.
- **Glassmorphism Design**: A premium, modern UI with HSL-tailored colors and transparent cards.

### 2.2 Task & Reading Management
- **Task List**: 
  - Add, complete, and delete daily tasks.
  - **Per-Task Time Tracking**: Play/Stop controls for every task.
  - **Mutual Exclusion**: Starting a new task automatically pauses the active one for accurate time tracking.
- **Reading List**: Save article URLs to a dedicated "Read Later" section to prevent tab clutter.

### 2.3 Focus Mode (The Deep Work Engine)
- **Site Blocking**: Uses high-performance `declarativeNetRequest` (MV3) to block distracting domains (Instagram, YouTube, LinkedIn, etc.).
- **Focus Screen Redirect**: Redirects blocked attempts to a custom "Focus Screen" displaying:
  - The user's Daily Focus statement.
  - A motivational quote.
  - Encouragement to return to work.
- **Reflect & Recalibrate (The Writing Gate)**:
  - If Focus Mode is turned OFF in less than 1 hour, a mandatory reflection session is triggered.
  - **150-Word Requirement**: User must type at least 150 words about their accomplishments/learning.
  - **Anti-Cheat**: Copy-pasting is strictly disabled to ensure active recall.

### 2.4 Productivity Insights Dashboard
- **Daily Momentum (Line Graph)**:
  - Visualizes focus time across the last 8 days.
  - Full X-axis (Dates) and Y-axis (Minutes) scaling.
  - Interactive data points with duration tooltips.
- **Peak Activity (Hourly Chart)**:
  - Visualizes focus distribution across 24 hours.
  - **Day Filter**: Dropdown to view average activity or a specific day's performance.
- **Analytics Metrics**:
  - Total Focus Time & % Change vs. Yesterday.
  - Current Streak & Consistency Score.
  - Tasks Completed.
- **Most Visited Sites**: Breakdown of time spent per domain with percentage distribution.

### 2.5 Quick Notes & Manifestations
- **Quick Notes**: A slide-out modal for scratch thoughts that auto-saves to local storage.
- **Manifestations**: Rotating motivational messages that can be toggled in settings.

---

## 3. Technical Concepts & Architecture

### 3.1 Browser Extension (Manifest V3)
- **Background Service Worker**: Handles tab tracking, site time accumulation, and storage flushing.
- **ES Modules**: Modularized logic across `storage.js`, `history.js`, `tasks.js`, and `focusMode.js`.
- **DeclarativeNetRequest**: Efficient, browser-level blocking of domains.

### 3.2 Data Management
- **Local Persistence**: `chrome.storage.local` is used for all user data (Settings, Tasks, History).
- **History Engine**: Aggregates data by local date string (`en-CA`) to prevent timezone drifting issues.

### 3.3 UI Component Logic
- **Vanilla JS Visuals**: SVG-based line graphs and bar charts built from scratch without external libraries.
- **Responsive Layouts**: Flexible glassmorphic cards that adapt to different browser resolutions.

---

## 4. User Flow
1. **Setup**: User opens a new tab and completes onboarding.
2. **Focus**: User sets their "Daily Focus" and begins tasks.
3. **Deep Work**: User toggles "Focus Mode" to block distractions.
4. **Reflection**: If the session ends early, the user writes their 150-word insight.
5. **Analyze**: User reviews the Insights dashboard to identify peak productivity windows.

---

## 5. Success Metrics
- Increase in total focus duration per user.
- High consistency scores (low day-to-day variation).
- Completion of the 150-word reflection (active learning reinforcement).