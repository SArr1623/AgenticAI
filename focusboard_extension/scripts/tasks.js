import { storageGet, storageSet, KEYS } from './storage.js';

const listEl  = document.getElementById('task-list');
const inputEl = document.getElementById('task-input');
const addBtn  = document.getElementById('btn-add-task');

let tasks = [];

function save() { return storageSet({ [KEYS.TASKS]: tasks }); }

function makeItem(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.completed ? ' completed' : '');
  if (task.activeStartTime) li.classList.add('is-active');
  li.dataset.id = task.id;

  // 1. Completion Checkbox
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'task-checkbox';
  cb.checked = task.completed;
  cb.addEventListener('change', async () => {
    // Stop timer if it was running
    if (task.activeStartTime) {
      const elapsed = Date.now() - task.activeStartTime;
      task.totalTimeMs = (task.totalTimeMs || 0) + elapsed;
      task.activeStartTime = null;
    }

    const isCompleted = !task.completed;
    tasks = tasks.map(t => t.id === task.id ? { ...t, completed: isCompleted, activeStartTime: task.activeStartTime, totalTimeMs: task.totalTimeMs } : t);
    
    if (isCompleted) {
      const s = await storageGet(KEYS.STATS);
      const stats = s[KEYS.STATS] || { daysWithFocusSet: 0, tasksCompleted: 0, blockedAttempts: 0 };
      stats.tasksCompleted += 1;
      await storageSet({ [KEYS.STATS]: stats });
    }

    await save();
    render();
  });

  // 2. Task Text & Timer Info
  const textContainer = document.createElement('div');
  textContainer.className = 'task-item-content';
  textContainer.style.flex = '1';
  textContainer.style.display = 'flex';
  textContainer.style.flexDirection = 'column';

  const txt = document.createElement('span');
  txt.className = 'task-item-text';
  txt.textContent = task.text;

  const timerInfo = document.createElement('span');
  timerInfo.className = 'task-timer-info';
  timerInfo.style.fontSize = '0.7rem';
  timerInfo.style.color = 'var(--clr-text-muted)';
  
  const updateTimerText = () => {
    let elapsed = task.totalTimeMs || 0;
    if (task.activeStartTime) {
      elapsed += (Date.now() - task.activeStartTime);
    }
    if (elapsed > 0) {
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      timerInfo.textContent = `⏱️ ${mins}m ${secs}s spent`;
    } else {
      timerInfo.textContent = '';
    }
  };
  updateTimerText();
  if (task.activeStartTime) {
    li._interval = setInterval(updateTimerText, 1000);
  }

  textContainer.append(txt, timerInfo);

  // 3. Play/Stop Toggle
  const playBtn = document.createElement('button');
  playBtn.className = 'task-action-btn';
  playBtn.innerHTML = task.activeStartTime ? '⏹️' : '▶️';
  playBtn.title = task.activeStartTime ? 'Stop tracking' : 'Start working';
  playBtn.disabled = task.completed;
  
  playBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const now = Date.now();
    
    if (task.activeStartTime) {
      // STOP
      const elapsed = now - task.activeStartTime;
      task.totalTimeMs = (task.totalTimeMs || 0) + elapsed;
      task.activeStartTime = null;
    } else {
      // START (Stop others first)
      tasks.forEach(t => {
        if (t.activeStartTime && t.id !== task.id) {
          t.totalTimeMs = (t.totalTimeMs || 0) + (now - t.activeStartTime);
          t.activeStartTime = null;
        }
      });
      task.activeStartTime = now;
    }
    
    await save();
    render();
  });

  // 4. Delete Button
  const del = document.createElement('button');
  del.className = 'task-delete-btn';
  del.textContent = '×';
  del.title = 'Remove';
  del.addEventListener('click', async () => {
    if (li._interval) clearInterval(li._interval);
    tasks = tasks.filter(t => t.id !== task.id);
    await save();
    render();
  });

  li.append(cb, textContainer, playBtn, del);
  return li;
}

function render() {
  // Clear any existing intervals before re-rendering
  Array.from(listEl.children).forEach(li => {
    if (li._interval) clearInterval(li._interval);
  });
  
  listEl.innerHTML = '';
  tasks.forEach(t => listEl.appendChild(makeItem(t)));
}

async function add(text) {
  if (!text.trim()) return;
  if (tasks.length >= 50) {
    alert("Task limit reached. Complete or delete some tasks to add more.");
    return;
  }
  tasks.push({ id: Date.now(), text: text.trim(), completed: false, totalTimeMs: 0, activeStartTime: null });
  await save();
  render();
}

export async function initTasks() {
  tasks = (await storageGet(KEYS.TASKS))[KEYS.TASKS] || [];
  render();
  addBtn.addEventListener('click', () => { add(inputEl.value); inputEl.value = ''; });
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') { add(inputEl.value); inputEl.value = ''; } });
}
