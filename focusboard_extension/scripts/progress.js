import { storageGet, KEYS, DEFAULT_SETTINGS } from './storage.js';

const widget = document.getElementById('progress-widget');
const ringTasks = document.getElementById('ring-tasks');
const ringFocus = document.getElementById('ring-focus');
const ringFocusMode = document.getElementById('ring-focus-mode');
const bgFocusMode = document.getElementById('progress-bg-focus-mode');

const ttTasks = document.getElementById('tt-tasks');
const ttFocus = document.getElementById('tt-focus');
const ttFmContainer = document.getElementById('tt-fm-container');
const ttFm = document.getElementById('tt-fm');

// Circumferences for circles based on radius
const C_TASKS = 2 * Math.PI * 40; // ~251.2
const C_FOCUS = 2 * Math.PI * 28; // ~175.9
const C_FM    = 2 * Math.PI * 16; // ~100.5

const todayStr = () => new Date().toLocaleDateString('en-CA');

function setProgress(circle, circumference, percent) {
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

export async function updateProgress() {
  const data = await storageGet([KEYS.TASKS, KEYS.DAILY_FOCUS, KEYS.FOCUS_DATE, KEYS.FOCUS_MODE, KEYS.USER_SETTINGS]);
  const settings = data[KEYS.USER_SETTINGS] || DEFAULT_SETTINGS;
  
  if (settings.progressIconEnabled === false) {
    widget.classList.add('hidden');
    return;
  } else {
    widget.classList.remove('hidden');
  }

  // Handle animations setting
  const rings = [ringTasks, ringFocus, ringFocusMode];
  if (settings.progressAnimations === false) {
    rings.forEach(r => r.classList.add('no-anim'));
  } else {
    rings.forEach(r => r.classList.remove('no-anim'));
  }

  // Handle focus mode ring visibility
  if (settings.progressFocusModeRing === false) {
    ringFocusMode.style.display = 'none';
    bgFocusMode.style.display = 'none';
    ttFmContainer.style.display = 'none';
  } else {
    ringFocusMode.style.display = 'block';
    bgFocusMode.style.display = 'block';
    ttFmContainer.style.display = 'block';
  }

  // 1. Task Completion
  const tasks = data[KEYS.TASKS] || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const taskPercent = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
  
  setProgress(ringTasks, C_TASKS, taskPercent);
  if (totalTasks === 0) {
    ttTasks.textContent = 'No tasks added';
  } else {
    ttTasks.textContent = `${completedTasks}/${totalTasks} completed`;
  }

  // 2. Daily Focus
  const focusText = data[KEYS.DAILY_FOCUS];
  const focusDate = data[KEYS.FOCUS_DATE];
  const isFocusSet = focusDate === todayStr() && !!focusText;
  
  setProgress(ringFocus, C_FOCUS, isFocusSet ? 100 : 0);
  ttFocus.textContent = isFocusSet ? 'Set' : 'Not set';

  // 3. Focus Mode
  const fmState = data[KEYS.FOCUS_MODE] || {};
  let fmUsed = false;
  
  if (fmState.enabled) {
    fmUsed = true;
  } else if (fmState.lastToggledAt) {
    // check if it was toggled today
    if (fmState.lastToggledAt.startsWith(todayStr())) {
      fmUsed = true;
    }
  }

  setProgress(ringFocusMode, C_FM, fmUsed ? 100 : 0);
  ttFm.textContent = fmUsed ? 'Used today' : 'Not used';
}

export function initProgress() {
  updateProgress();
  // Listen for changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      const relevantKeys = [KEYS.TASKS, KEYS.DAILY_FOCUS, KEYS.FOCUS_MODE, KEYS.USER_SETTINGS];
      if (relevantKeys.some(k => changes[k])) {
        updateProgress();
      }
    }
  });
}
