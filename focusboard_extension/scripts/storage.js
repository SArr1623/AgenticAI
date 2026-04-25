/** Chrome storage.local promise wrappers */

export const KEYS = {
  USER_SETTINGS:  'userSettings',
  DAILY_FOCUS:    'dailyFocus',
  FOCUS_DATE:     'focusDate',
  TASKS:          'tasks',
  FOCUS_MODE:     'focusMode',
  WEATHER_CACHE:  'weatherCache',
  STATS:          'stats',
  HISTORY:        'history',
  READING_LIST:   'readingList',
  QUICK_NOTES:    'quickNotes',
  SITE_TIME:      'siteTime',
};

export const DEFAULT_SETTINGS = {
  name:                  '',
  wallpaper:             null,
  blockedSites:          ['instagram.com', 'youtube.com', 'linkedin.com'],
  manifestationsEnabled: true,
  overlayIntensity:      0.4,
  progressIconEnabled:   true,
  progressAnimations:    true,
  progressFocusModeRing: true,
  reflectSettings: {
    autoTriggerOnFocusOff: true,
    lastQuizTimestamp: null
  }
};

export const DEFAULT_STATS = {
  daysWithFocusSet: 0,
  tasksCompleted: 0,
  blockedAttempts: 0
};

export const storageGet = (keys) =>
  new Promise((res, rej) =>
    chrome.storage.local.get(keys, (r) =>
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));

export const storageSet = (items) =>
  new Promise((res, rej) =>
    chrome.storage.local.set(items, () =>
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()));
