import { storageGet, storageSet, KEYS } from './storage.js';

const input = document.getElementById('reading-input');
const btnAdd = document.getElementById('btn-add-reading');
const list = document.getElementById('reading-list');

let items = [];

export async function initReadingList() {
  const data = await storageGet(KEYS.READING_LIST);
  items = data[KEYS.READING_LIST] || [];
  
  render();

  btnAdd.addEventListener('click', addItem);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItem();
  });
}

function render() {
  list.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.checked = item.read;
    cb.addEventListener('change', async () => {
      items[i].read = cb.checked;
      await save();
      render();
    });

    const span = document.createElement('span');
    span.className = 'task-text';
    if (item.read) span.style.textDecoration = 'line-through';
    
    // Check if it's a URL
    try {
      const url = new URL(item.text);
      span.innerHTML = `<a href="${url.href}" target="_blank" style="color: inherit;">${item.text}</a>`;
    } catch {
      span.textContent = item.text;
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'task-delete';
    delBtn.innerHTML = '✕';
    delBtn.setAttribute('aria-label', 'Delete item');
    delBtn.addEventListener('click', async () => {
      items.splice(i, 1);
      await save();
      render();
    });

    li.append(cb, span, delBtn);
    list.appendChild(li);
  });
}

async function addItem() {
  const text = input.value.trim();
  if (!text) return;
  if (items.length >= 50) {
    alert('Reading list is full (50 items max). Please remove some first.');
    return;
  }
  items.push({ text, read: false, id: Date.now().toString() });
  input.value = '';
  await save();
  render();
}

async function save() {
  await storageSet({ [KEYS.READING_LIST]: items });
}
