const clockEl    = document.getElementById('clock');
const greetingEl = document.getElementById('greeting');

function greeting(name) {
  const h = new Date().getHours();
  let salutation = 'Good evening';
  if (h >= 5 && h < 12) salutation = 'Good morning';
  else if (h >= 12 && h < 18) salutation = 'Good afternoon';
  
  if (name) {
    return `${salutation}, ${name} ✨`;
  } else {
    return `${salutation} ✨ <button id="btn-add-name-greeting" class="btn-link" style="font-size: 0.8rem; margin-left: 8px;">Add your name in Settings</button>`;
  }
}

function tick(name) {
  clockEl.textContent    = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  greetingEl.innerHTML = greeting(name);
  
  const addNameBtn = document.getElementById('btn-add-name-greeting');
  if (addNameBtn) {
    addNameBtn.addEventListener('click', () => {
      document.getElementById('btn-settings').click();
    });
  }
}

let _interval = null;

export function startClock(name) {
  if (_interval) clearInterval(_interval);
  tick(name);
  _interval = setInterval(() => tick(name), 1000);
}
