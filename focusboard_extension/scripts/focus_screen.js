import { storageGet, storageSet, KEYS } from './storage.js';
import { recordFocusSession } from './history.js';
import { checkAndShowReflectTrigger } from './reflectQuiz.js';

const MANIFESTATIONS = [
  "Your focus determines your reality.",
  "Deep work is a superpower in our distracted world.",
  "The results you want are on the other side of the focus you're avoiding.",
  "Small steps taken consistently lead to extraordinary results.",
  "You have the power to create the life you envision.",
  "Stay focused. Stay relentless. The results will come.",
  "Clarity of purpose brings mastery of action.",
  "Be the master of your time, not the slave of your notifications.",
  "Energy flows where attention goes.",
  "Focus is about saying no to a thousand things.",
  "Don't trade what you want most for what you want now.",
  "Work hard in silence, let your success be your noise.",
];

function getDailyManifestation() {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return MANIFESTATIONS[day % MANIFESTATIONS.length];
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['dailyFocus', 'focusDate', 'stats'], (data) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const focusEl  = document.getElementById('focus-message');
    const quoteEl  = document.getElementById('quote-text');

    if (data.focusDate === todayStr && data.dailyFocus) {
      focusEl.textContent = data.dailyFocus;
    } else {
      focusEl.textContent = 'No focus set yet — open a new tab to set one!';
    }

    quoteEl.textContent = `"${getDailyManifestation()}"`;

    // Increment blocked attempts
    const stats = data.stats || { daysWithFocusSet: 0, tasksCompleted: 0, blockedAttempts: 0 };
    stats.blockedAttempts += 1;
    chrome.storage.local.set({ stats });
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://newtab/' });
  });

  document.getElementById('btn-turn-off').addEventListener('click', async () => {
    const fmData = (await storageGet(KEYS.FOCUS_MODE))[KEYS.FOCUS_MODE];

    const performDisable = async (start, end, duration) => {
      if (start && end && duration) {
        await recordFocusSession(fmData.lastToggledAt, end.toISOString(), duration);
      }
      chrome.runtime.sendMessage({ type: 'DISABLE_FOCUS_MODE' }, () => {
        chrome.storage.local.set({ focusMode: { enabled: false, lastToggledAt: fmData?.lastToggledAt } }, () => {
          alert('Focus mode turned off. You can now reload your site.');
        });
      });
    };

    if (fmData && fmData.lastToggledAt) {
      const start = new Date(fmData.lastToggledAt);
      const end = new Date();
      const duration = end.getTime() - start.getTime();
      
      checkAndShowReflectTrigger(duration, async (passed) => {
        if (passed) {
          await performDisable(start, end, duration);
        }
      });
      return;
    }
    
    await performDisable();
  });
});
