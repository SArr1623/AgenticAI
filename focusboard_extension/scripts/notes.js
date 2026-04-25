import { storageGet, storageSet, KEYS } from './storage.js';

const modal = document.getElementById('notes-modal');
const btnNotes = document.getElementById('btn-notes');
const btnClose = document.getElementById('btn-close-notes');
const textarea = document.getElementById('quick-notes-area');

let saveTimeout;

export async function initNotes() {
  const data = await storageGet(KEYS.QUICK_NOTES);
  textarea.value = data[KEYS.QUICK_NOTES] || '';

  btnNotes.addEventListener('click', () => {
    modal.classList.remove('hidden');
    textarea.focus();
  });

  btnClose.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Auto-save logic
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await storageSet({ [KEYS.QUICK_NOTES]: textarea.value });
    }, 500); // 500ms debounce
  });
}
