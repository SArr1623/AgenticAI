/**
 * background.js — FocusBoard Service Worker
 *
 * Responsibilities:
 *   - Listen for install/activation events
 *   - Handle declarativeNetRequest rule updates for Focus Mode
 *   - Listen for messages from the newtab page to toggle Focus Mode
 */

const EXTENSION_NAME = 'FocusBoard';

// ── Install & Activate ────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[${EXTENSION_NAME}] Service Worker installed.`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[${EXTENSION_NAME}] Service Worker activated.`);
  event.waitUntil(clients.claim());
});

// ── Focus Mode: Block / Unblock Sites ────────────────────────
/**
 * Enables Focus Mode by registering declarativeNetRequest dynamic rules
 * that redirect each blocked site to the custom Focus Screen.
 *
 * @param {string[]} blockedSites - Array of hostnames, e.g. ["instagram.com"]
 */
async function enableFocusMode(blockedSites) {
  // First, remove all previously registered dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  const newRules = blockedSites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/focus.html' },
    },
    condition: {
      urlFilter: `||${site}`,
      resourceTypes: ['main_frame'],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });

  console.log(`[${EXTENSION_NAME}] Focus Mode ON — blocking ${blockedSites.length} site(s).`);
}

/**
 * Disables Focus Mode by removing all dynamic blocking rules.
 */
async function disableFocusMode() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: [],
  });
  console.log(`[${EXTENSION_NAME}] Focus Mode OFF — all rules cleared.`);
}

// ── Message Listener ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'ENABLE_FOCUS_MODE') {
    enableFocusMode(payload.blockedSites)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (type === 'DISABLE_FOCUS_MODE') {
    disableFocusMode()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ── Site Time Tracker ────────────────────────────────────────

let activeTabId = null;
let activeDomain = null;
let activeStartTime = null;

async function flushActiveTime() {
  if (activeDomain && activeStartTime) {
    const duration = Date.now() - activeStartTime;
    if (duration > 1000) {
      const data = await chrome.storage.local.get(['siteTime']);
      const siteTime = data.siteTime || {};
      const today = new Date().toLocaleDateString('en-CA');
      
      if (!siteTime[today]) siteTime[today] = {};
      siteTime[today][activeDomain] = (siteTime[today][activeDomain] || 0) + duration;
      
      await chrome.storage.local.set({ siteTime });
    }
  }
  activeStartTime = null;
  activeDomain = null;
}

function getDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.hostname;
  } catch (e) {
    return null;
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await flushActiveTime();
  activeTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(activeTabId);
  if (tab && tab.url && !tab.url.startsWith('chrome://')) {
    activeDomain = getDomain(tab.url);
    if (activeDomain) activeStartTime = Date.now();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await flushActiveTime();
    if (!changeInfo.url.startsWith('chrome://')) {
      activeDomain = getDomain(changeInfo.url);
      if (activeDomain) activeStartTime = Date.now();
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushActiveTime();
  } else {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url && !tab.url.startsWith('chrome://')) {
        activeDomain = getDomain(tab.url);
        if (activeDomain) activeStartTime = Date.now();
      }
    }
  }
});

chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await flushActiveTime();
  } else if (state === 'active') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url && !tab.url.startsWith('chrome://')) {
        activeDomain = getDomain(tab.url);
        if (activeDomain) activeStartTime = Date.now();
      }
    }
  }
});

setInterval(async () => {
  if (activeDomain && activeStartTime) {
    const duration = Date.now() - activeStartTime;
    activeStartTime = Date.now();
    if (duration > 0) {
      const data = await chrome.storage.local.get(['siteTime']);
      const siteTime = data.siteTime || {};
      const today = new Date().toLocaleDateString('en-CA');
      if (!siteTime[today]) siteTime[today] = {};
      siteTime[today][activeDomain] = (siteTime[today][activeDomain] || 0) + duration;
      await chrome.storage.local.set({ siteTime });
    }
  }
}, 30000);
