import { storageGet, storageSet, KEYS, DEFAULT_SETTINGS } from './storage.js';

const modal        = document.getElementById('onboarding-modal');
const inputName    = document.getElementById('input-name');
const inputFile    = document.getElementById('input-wallpaper');
const fileLabel    = document.getElementById('wallpaper-upload-text');
const saveBtn      = document.getElementById('btn-onboarding-save');

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

export async function needsOnboarding() {
  const s = (await storageGet(KEYS.USER_SETTINGS))[KEYS.USER_SETTINGS];
  return !s?.name;
}

export function showOnboarding(onComplete) {
  modal.classList.remove('hidden');
  let wallpaper = null;

  inputFile.addEventListener('change', async () => {
    const f = inputFile.files[0];
    if (f) { fileLabel.textContent = f.name; wallpaper = await toBase64(f); }
  });

  saveBtn.addEventListener('click', async () => {
    const name = inputName.value.trim();
    if (!name) { inputName.focus(); inputName.style.borderColor = 'var(--clr-danger)'; return; }
    const settings = { ...DEFAULT_SETTINGS, name, wallpaper };
    await storageSet({ [KEYS.USER_SETTINGS]: settings });
    modal.classList.add('hidden');
    onComplete(settings);
  });

  inputName.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
}
