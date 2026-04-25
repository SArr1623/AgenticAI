import { storageGet, storageSet, KEYS } from './storage.js';

const triggerModal = document.getElementById('reflect-trigger-modal');
const btnStart = document.getElementById('btn-reflect-start');
const btnSkip = document.getElementById('btn-reflect-skip');
const btnNever = document.getElementById('btn-reflect-never');

const quizModal = document.getElementById('reflect-quiz-modal');
const textarea = document.getElementById('insight-textarea');
const wordCountEl = document.getElementById('word-count');
const btnFinish = document.getElementById('btn-quiz-next'); // Reusing existing ID for simplicity
const btnClose = document.getElementById('btn-quiz-close');

const MIN_WORDS = 150;

function updateWordCount() {
    const text = textarea.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wordCountEl.textContent = `${words} / ${MIN_WORDS} words`;
    
    if (words >= MIN_WORDS) {
        btnFinish.style.opacity = '1';
        btnFinish.style.pointerEvents = 'all';
        wordCountEl.style.color = 'var(--clr-cyan)';
    } else {
        btnFinish.style.opacity = '0.5';
        btnFinish.style.pointerEvents = 'none';
        wordCountEl.style.color = 'var(--clr-accent)';
    }
}

export async function checkAndShowReflectTrigger(durationMs, onComplete) {
  const data = await storageGet([KEYS.USER_SETTINGS]);
  const settings = data[KEYS.USER_SETTINGS];
  
  const reflectSettings = settings.reflectSettings || { autoTriggerOnFocusOff: true, lastQuizTimestamp: null };
  
  if (!reflectSettings.autoTriggerOnFocusOff || durationMs >= 3600000) {
      return onComplete(true);
  }
  
  if (reflectSettings.lastQuizTimestamp) {
      const last = new Date(reflectSettings.lastQuizTimestamp).getTime();
      if (Date.now() - last < 60000) { // 1 min cooldown for testing/demo
          return onComplete(true);
      }
  }
  
  triggerModal.classList.remove('hidden');
  
  const cleanup = () => { triggerModal.classList.add('hidden'); };
  
  btnSkip.onclick = () => { cleanup(); onComplete(true); };
  
  btnNever.onclick = async () => {
      cleanup();
      if (!settings.reflectSettings) settings.reflectSettings = {};
      settings.reflectSettings.autoTriggerOnFocusOff = false;
      await storageSet({ [KEYS.USER_SETTINGS]: settings });
      onComplete(true);
  };
  
  btnStart.onclick = () => {
      cleanup();
      startInsightSession(async () => {
          settings.reflectSettings.lastQuizTimestamp = new Date().toISOString();
          await storageSet({ [KEYS.USER_SETTINGS]: settings });
          onComplete(true);
      });
  };
}

function startInsightSession(onFinish) {
    quizModal.classList.remove('hidden');
    textarea.value = '';
    updateWordCount();
    
    textarea.addEventListener('input', updateWordCount);
    
    // Disable Copy/Paste as requested
    textarea.addEventListener('paste', (e) => {
        e.preventDefault();
        alert("Copy-pasting is disabled. Please type your insights to reinforce your learning.");
    });

    btnFinish.onclick = () => {
        quizModal.classList.add('hidden');
        onFinish();
    };
    
    btnClose.onclick = () => {
        quizModal.classList.add('hidden');
        // If they cancel, we don't complete the "turn off" action in focusMode.js
        // But in some flows we might want to just let them out.
        // For this PRD, reflection is the "gate".
    };
}
