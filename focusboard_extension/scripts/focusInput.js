import { storageGet, storageSet, KEYS } from './storage.js';

const modal        = document.getElementById('focus-modal');
const inputEl      = document.getElementById('input-focus');
const saveBtn      = document.getElementById('btn-focus-save');
const skipBtn      = document.getElementById('btn-focus-skip');
const display      = document.getElementById('daily-focus-display');
const focusInputEl = document.getElementById('focus-text-input');
const setNowBtn    = document.getElementById('btn-set-now');

const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

function showDisplay(focus) {
  focusInputEl.value = focus || '';
  if (!focus) {
    setNowBtn.classList.remove('hidden');
    focusInputEl.classList.add('hidden');
  } else {
    setNowBtn.classList.add('hidden');
    focusInputEl.classList.remove('hidden');
  }
  display.classList.remove('hidden');
  modal.classList.add('hidden');
}

function showModal(current = '') {
  inputEl.value = current;
  inputEl.style.borderColor = '';
  modal.classList.remove('hidden');
  setTimeout(() => inputEl.focus(), 80);
}

async function saveFocusText(focus) {
  if (!focus) {
    // Treat empty as skip
    await storageSet({ [KEYS.DAILY_FOCUS]: '', [KEYS.FOCUS_DATE]: todayStr() });
    showDisplay('');
    return;
  }
  
  const s = await storageGet(KEYS.STATS);
  const stats = s[KEYS.STATS] || { daysWithFocusSet: 0, tasksCompleted: 0, blockedAttempts: 0 };
  stats.daysWithFocusSet += 1;
  await storageSet({ [KEYS.STATS]: stats });

  await storageSet({ [KEYS.DAILY_FOCUS]: focus, [KEYS.FOCUS_DATE]: todayStr() });
  showDisplay(focus);
}

async function save() {
  const focus = inputEl.value.trim();
  await saveFocusText(focus);
}

export async function checkAndShowFocusPrompt() {
  const s = await storageGet([KEYS.DAILY_FOCUS, KEYS.FOCUS_DATE]);
  if (s[KEYS.FOCUS_DATE] === todayStr()) {
    showDisplay(s[KEYS.DAILY_FOCUS]);
  } else {
    showModal();
  }
}

export function initFocusInput() {
  saveBtn.addEventListener('click', save);
  skipBtn.addEventListener('click', () => saveFocusText(''));
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  
  setNowBtn.addEventListener('click', async () => {
    const s = await storageGet(KEYS.DAILY_FOCUS);
    showModal(s[KEYS.DAILY_FOCUS] || '');
  });

  focusInputEl.addEventListener('blur', async () => {
    await saveFocusText(focusInputEl.value.trim());
  });

  focusInputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      focusInputEl.blur(); // will trigger the blur event to save
    }
  });
}
