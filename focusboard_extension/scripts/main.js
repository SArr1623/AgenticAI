/**
 * main.js — FocusBoard Orchestrator
 * Wires all modules together after DOMContentLoaded.
 */

import { storageGet, KEYS }                          from './storage.js';
import { needsOnboarding, showOnboarding }           from './onboarding.js';
import { initSettings, getCurrentSettings }          from './settings.js';
import { initFocusInput, checkAndShowFocusPrompt } from './focusInput.js';
import { startClock }                                from './clock.js';
import { initWeather }                               from './weather.js';
import { initTasks }                                 from './tasks.js';
import { initFocusMode }                             from './focusMode.js';
import { getDailyManifestation }                     from './manifestations.js';
import { initProgress }                              from './progress.js';
import { initReadingList }                           from './readingList.js';
import { initNotes }                                 from './notes.js';

const dashboard         = document.getElementById('dashboard');
const wallpaperBg       = document.getElementById('wallpaper-bg');
const manifestationDisp = document.getElementById('manifestation-display');
const manifestationTxt  = document.getElementById('manifestation-text');

function applyWallpaper(wp) {
  wallpaperBg.style.backgroundImage = wp ? `url(${wp})` : 'none';
}

function applyManifestations(enabled) {
  if (enabled !== false) {
    manifestationTxt.textContent = `"${getDailyManifestation()}"`;
    manifestationDisp.classList.remove('hidden');
  } else {
    manifestationDisp.classList.add('hidden');
  }
}

function applyOverlay(intensity) {
  const op = intensity !== undefined ? intensity : 0.4;
  const overlay = document.querySelector('.bg-overlay');
  if (overlay) {
    overlay.style.background = `rgba(0,0,0,${op})`;
  }
}

async function boot(settings) {
  dashboard.classList.remove('hidden');
  applyWallpaper(settings.wallpaper);
  applyOverlay(settings.overlayIntensity);
  applyManifestations(settings.manifestationsEnabled);
  startClock(settings.name);

  initFocusInput();
  initTasks();
  initReadingList();
  initNotes();
  
  document.getElementById('btn-tracker').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('summary.html') });
  });

  setTimeout(initWeather, 500); // lazy-load weather
  await initFocusMode();
  initProgress();

  await initSettings((updated) => {
    applyWallpaper(updated.wallpaper);
    applyOverlay(updated.overlayIntensity);
    applyManifestations(updated.manifestationsEnabled);
    startClock(updated.name);
  });

  await checkAndShowFocusPrompt();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (await needsOnboarding()) {
      showOnboarding(boot);
    } else {
      const settings = (await storageGet(KEYS.USER_SETTINGS))[KEYS.USER_SETTINGS];
      await boot(settings);
    }
  } catch (err) {
    console.error('[FocusBoard] Boot error:', err);
  }
});
