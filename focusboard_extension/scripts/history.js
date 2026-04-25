import { storageGet, storageSet, KEYS } from './storage.js';

const todayStr = () => new Date().toLocaleDateString('en-CA');

export async function recordFocusSession(startIso, endIso, durationMs) {
  const data = await storageGet(KEYS.HISTORY);
  const history = data[KEYS.HISTORY] || {};
  const dateKey = new Date(startIso).toLocaleDateString('en-CA');
  
  if (!history[dateKey]) {
    history[dateKey] = { focusSessions: [], tasksCompleted: 0, blockedAttempts: 0 };
  }
  
  if (!history[dateKey].focusSessions) {
    history[dateKey].focusSessions = [];
  }
  
  history[dateKey].focusSessions.push({ startTime: startIso, endTime: endIso, durationMs });
  
  await storageSet({ [KEYS.HISTORY]: history });
}

export async function incrementHistoryStat(statName) {
  const data = await storageGet(KEYS.HISTORY);
  const history = data[KEYS.HISTORY] || {};
  const dateKey = todayStr();
  
  if (!history[dateKey]) {
    history[dateKey] = { focusSessions: [], tasksCompleted: 0, blockedAttempts: 0 };
  }
  history[dateKey][statName] = (history[dateKey][statName] || 0) + 1;
  
  await storageSet({ [KEYS.HISTORY]: history });
}

export function formatDuration(ms) {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
