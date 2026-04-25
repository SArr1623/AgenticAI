import { storageGet, storageSet, KEYS, DEFAULT_SETTINGS, DEFAULT_STATS } from './storage.js';
import { formatDuration, formatTime } from './history.js';

const panel          = document.getElementById('settings-panel');
const backdrop       = document.getElementById('settings-backdrop');
const openBtn        = document.getElementById('btn-settings');
const closeBtn       = document.getElementById('btn-close-settings');
const saveBtn        = document.getElementById('btn-save-settings');
const nameInput      = document.getElementById('settings-name');
const wallpaperInput = document.getElementById('settings-wallpaper');
const wallpaperText  = document.getElementById('settings-wallpaper-text');
const manifestToggle = document.getElementById('settings-manifestations');
const blockedInput   = document.getElementById('settings-blocked-input');
const addBlockedBtn  = document.getElementById('btn-add-blocked');
const blockedList    = document.getElementById('blocked-sites-list');
const overlayInput   = document.getElementById('settings-overlay');
const resetWallBtn   = document.getElementById('btn-reset-wallpaper');

const progIconToggle = document.getElementById('settings-progress-icon');
const progAnimToggle = document.getElementById('settings-progress-anim');
const progFmToggle   = document.getElementById('settings-progress-fm');

const reflectAutoToggle = document.getElementById('settings-reflect-auto');
const btnViewNotes = document.getElementById('btn-view-notes');
const btnClearNotes = document.getElementById('btn-clear-notes');

const statDaysFocus = document.getElementById('stat-days-focus');
const statTasksDone = document.getElementById('stat-tasks-done');
const statBlocked   = document.getElementById('stat-blocked');

let _settings = { ...DEFAULT_SETTINGS };
let _onSaved  = null;
let _newWallpaper = null;

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
});

function renderChips(sites) {
  blockedList.innerHTML = '';
  (sites || []).forEach(site => {
    const chip = document.createElement('span');
    chip.className = 'blocked-site-chip';
    chip.innerHTML = `${site} <span class="chip-remove" role="button" aria-label="Remove ${site}">✕</span>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => {
      _settings.blockedSites = _settings.blockedSites.filter(s => s !== site);
      renderChips(_settings.blockedSites);
    });
    blockedList.appendChild(chip);
  });
}

function open() {
  nameInput.value = _settings.name || '';
  manifestToggle.checked = _settings.manifestationsEnabled !== false;
  progIconToggle.checked = _settings.progressIconEnabled !== false;
  progAnimToggle.checked = _settings.progressAnimations !== false;
  progFmToggle.checked   = _settings.progressFocusModeRing !== false;
  
  const refSet = _settings.reflectSettings || {};
  reflectAutoToggle.checked = refSet.autoTriggerOnFocusOff !== false;

  overlayInput.value = _settings.overlayIntensity !== undefined ? _settings.overlayIntensity : 0.4;
  renderChips(_settings.blockedSites);
  
  storageGet(KEYS.STATS).then(s => {
    const stats = s[KEYS.STATS] || DEFAULT_STATS;
    statDaysFocus.textContent = stats.daysWithFocusSet || 0;
    statTasksDone.textContent = stats.tasksCompleted || 0;
    statBlocked.textContent   = stats.blockedAttempts || 0;
  });

  storageGet(KEYS.HISTORY).then(d => {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    const history = d[KEYS.HISTORY] || {};
    
    const dates = Object.keys(history).sort((a,b) => b.localeCompare(a)).slice(0, 7); // Last 7 days
    
    if (dates.length === 0) {
      historyList.innerHTML = '<i>No focus sessions recorded yet.</i>';
      return;
    }
    
    for (const date of dates) {
      const dayData = history[date];
      const sessions = dayData.focusSessions || [];
      if (sessions.length === 0) continue;
      
      const totalMs = sessions.reduce((acc, s) => acc + s.durationMs, 0);
      
      const dayEl = document.createElement('div');
      dayEl.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      dayEl.style.paddingBottom = '4px';
      
      let html = `<div style="display:flex; justify-content:space-between; font-weight:600; color:var(--clr-text);">
        <span>${date}</span>
        <span>Total: ${formatDuration(totalMs)}</span>
      </div>`;
      
      sessions.forEach(s => {
        html += `<div style="display:flex; justify-content:space-between; padding-left:8px; margin-top:2px;">
          <span>${formatTime(s.startTime)} - ${formatTime(s.endTime)}</span>
          <span>${formatDuration(s.durationMs)}</span>
        </div>`;
      });
      
      dayEl.innerHTML = html;
      historyList.appendChild(dayEl);
    }
    
    if (historyList.innerHTML === '') {
       historyList.innerHTML = '<i>No focus sessions recorded yet.</i>';
    }
  });

  btnViewNotes.addEventListener('click', () => {
    panel.classList.remove('is-open');
    backdrop.classList.add('hidden');
    document.getElementById('btn-notes').click();
  });

  btnClearNotes.addEventListener('click', async () => {
    if (confirm('Clear all learning notes?')) {
      await storageSet({ [KEYS.QUICK_NOTES]: '' });
      alert('Notes cleared.');
    }
  });

  panel.classList.add('is-open');
  backdrop.classList.remove('hidden');
}

function close() {
  panel.classList.remove('is-open');
  backdrop.classList.add('hidden');
}

export function getCurrentSettings() { return _settings; }

export async function initSettings(onSaved) {
  _onSaved  = onSaved;
  const stored = (await storageGet(KEYS.USER_SETTINGS))[KEYS.USER_SETTINGS];
  _settings = { ...DEFAULT_SETTINGS, ...stored };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  resetWallBtn.addEventListener('click', () => {
    _settings.wallpaper = null;
    _newWallpaper = null;
    wallpaperText.textContent = 'Choose an image…';
  });

  wallpaperInput.addEventListener('change', async () => {
    const f = wallpaperInput.files[0];
    if (f) {
      if (f.size > 5 * 1024 * 1024) {
        alert('File is too large. Max 5MB allowed.');
        wallpaperInput.value = '';
        return;
      }
      wallpaperText.textContent = f.name; 
      _newWallpaper = await toBase64(f); 
    }
  });

  function addBlocked() {
    let site = blockedInput.value.trim();
    site = site.replace(/^https?:\/\//, '').split('/')[0];
    if (site && !_settings.blockedSites.includes(site)) {
      _settings.blockedSites = [..._settings.blockedSites, site];
      renderChips(_settings.blockedSites);
    }
    blockedInput.value = '';
  }

  addBlockedBtn.addEventListener('click', addBlocked);
  blockedInput.addEventListener('keydown', e => { if (e.key === 'Enter') addBlocked(); });

  saveBtn.addEventListener('click', async () => {
    _settings = { 
      ..._settings, 
      name: nameInput.value.trim() || _settings.name, 
      manifestationsEnabled: manifestToggle.checked,
      progressIconEnabled: progIconToggle.checked,
      progressAnimations: progAnimToggle.checked,
      progressFocusModeRing: progFmToggle.checked,
      reflectSettings: {
        autoTriggerOnFocusOff: reflectAutoToggle.checked,
        lastQuizTimestamp: _settings.reflectSettings ? _settings.reflectSettings.lastQuizTimestamp : null
      },
      overlayIntensity: parseFloat(overlayInput.value)
    };
    if (_newWallpaper) { _settings.wallpaper = _newWallpaper; _newWallpaper = null; }
    await storageSet({ [KEYS.USER_SETTINGS]: _settings });
    close();
    if (_onSaved) _onSaved(_settings);
  });
}
