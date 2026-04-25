# FocusBoard Extension Implementation Tasks

This document outlines the atomic-level tasks required to build the Personal Productivity Dashboard Chrome Extension, broken down into interdependent phases.

## Phase 1: Project Scaffolding & Configuration
*Dependency: None*
- [x] Create `manifest.json` (v3) with necessary permissions (`storage`, `declarativeNetRequest`, `geolocation`, `tabs`).
- [x] Set up project directory structure (`/src`, `/assets`, `/css`, `/js`).
- [x] Create `newtab.html` as the default override page.
- [x] Create `background.js` for service worker tasks.
- [x] Create foundational CSS (`style.css`) with basic reset and design tokens.

## Phase 2: Storage & Settings Core
*Dependency: Phase 1*
- [x] Implement storage wrapper utility for `chrome.storage.local`.
- [x] Create First-Time Onboarding UI (Name input, optional wallpaper upload).
- [x] Implement image to base64 encoding/storage for user-uploaded wallpaper.
- [x] Create Settings Panel UI (hidden by default, toggleable).
- [x] Implement save/load for User Settings (`name`, `wallpaper`, `blockedSites`, `manifestationsEnabled`).

## Phase 3: Daily Focus System
*Dependency: Phase 2*
- [x] Create Daily Focus prompt UI.
- [x] Implement logic to check if a focus is already set for the current day.
- [x] Implement midnight reset logic for the Daily Focus.
- [x] Display the saved Daily Focus persistently on the dashboard.

## Phase 4: Dashboard UI & Elements
*Dependency: Phase 2, Phase 3*
- [x] Implement Live Clock component that updates every second.
- [x] Implement Greeting Message logic ("Good morning/afternoon/evening, [Name]").
- [x] Apply user-uploaded wallpaper to the dashboard background.
- [x] Implement Manifestation message component (display if enabled in settings).

## Phase 5: Weather Integration
*Dependency: Phase 4*
- [x] Set up Open-Meteo API (free, no key needed) with geolocation.
- [x] Implement browser geolocation prompt to get user coordinates.
- [x] Create API fetch function for current weather data.
- [x] Design and implement the Weather UI component on the dashboard.
- [x] Implement weather data caching (30 min TTL) to avoid excessive API calls.

## Phase 6: Task List (Lightweight)
*Dependency: Phase 2*
- [x] Create Task List UI (input field, list container).
- [x] Implement "Add Task" functionality and DOM rendering.
- [x] Implement "Mark Task Complete" toggle.
- [x] Implement "Delete Task" functionality.
- [x] Bind task CRUD operations to `chrome.storage.local` for persistence.

## Phase 7: Focus Mode & Website Blocking
*Dependency: Phase 2, Phase 3*
- [x] Create "Focus Mode" toggle switch on the dashboard.
- [x] Implement dynamic rule updates using `chrome.declarativeNetRequest.updateDynamicRules` based on user's `blockedSites` list.
- [x] Create a custom "Focus Screen" HTML/JS page (to replace blocked sites).
- [x] Implement redirection logic to the custom "Focus Screen" when a blocked site is accessed.
- [x] Pass the current "Daily Focus" and "Motivational Message" to the custom Focus Screen.

## Phase 8: Refinement & Testing
*Dependency: All previous phases*
- [x] Refine CSS styling for a minimal, calming, and non-intrusive UI.
- [ ] Test the first-time user flow (fresh install scenario).
- [ ] Test the daily midnight reset functionality.
- [ ] Verify website blocking works consistently when Focus Mode is ON.
- [ ] Check performance and responsiveness.
