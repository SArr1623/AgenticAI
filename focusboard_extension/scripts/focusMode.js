import { storageGet, storageSet, KEYS } from './storage.js';
import { getCurrentSettings } from './settings.js';
import { recordFocusSession } from './history.js';
import { checkAndShowReflectTrigger } from './reflectQuiz.js';

const toggleBtn = document.getElementById('btn-focus-mode');
const labelEl   = document.getElementById('focus-mode-label');

let _on = false;

function updateUI(on) {
  _on = on;
  toggleBtn.setAttribute('aria-pressed', String(on));
  labelEl.textContent = on ? 'Focus: On' : 'Focus: Off';
}

function msgBg(type, payload = {}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, payload }, res));
}

export async function initFocusMode() {
  const fmData = (await storageGet(KEYS.FOCUS_MODE))[KEYS.FOCUS_MODE];
  _on = (typeof fmData === 'object' && fmData !== null) ? fmData.enabled : !!fmData;
  updateUI(_on);

  if (_on) {
    const { blockedSites } = getCurrentSettings();
    await msgBg('ENABLE_FOCUS_MODE', { blockedSites: blockedSites || [] });
  }

  toggleBtn.addEventListener('click', async () => {
    const newState = !_on;
    const { blockedSites } = getCurrentSettings();

    const performDisable = async (fmData, start, end, duration) => {
      await msgBg('DISABLE_FOCUS_MODE');
      if (start && end && duration) {
        await recordFocusSession(fmData.lastToggledAt, end.toISOString(), duration);
      }
      await storageSet({ 
        [KEYS.FOCUS_MODE]: { enabled: false, lastToggledAt: fmData?.lastToggledAt } 
      });
      updateUI(false);
    };

    if (newState) {
      await msgBg('ENABLE_FOCUS_MODE', { blockedSites: blockedSites || [] });
      await storageSet({ 
        [KEYS.FOCUS_MODE]: { enabled: true, lastToggledAt: new Date().toISOString() } 
      });
      updateUI(true);
    } else {
      if (_on) {
        const fmData = (await storageGet(KEYS.FOCUS_MODE))[KEYS.FOCUS_MODE];
        if (fmData && fmData.lastToggledAt) {
          const start = new Date(fmData.lastToggledAt);
          const end = new Date();
          const duration = end.getTime() - start.getTime();
          
          checkAndShowReflectTrigger(duration, async (passed) => {
            if (passed) {
              await performDisable(fmData, start, end, duration);
            } else {
              updateUI(true); // Keep it ON visually
            }
          });
          return;
        }
      }
      await performDisable();
    }
  });
}
