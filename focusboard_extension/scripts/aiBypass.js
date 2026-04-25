import { storageGet, KEYS } from './storage.js';

const modal = document.getElementById('ai-bypass-modal');
const container = document.getElementById('ai-questions-container');
const btnCancel = document.getElementById('btn-cancel-bypass');
const btnConfirm = document.getElementById('btn-confirm-bypass');

// Generates trending/reflective questions directly from reading list URLs & notes
function generateQuestions(readingList, notes) {
  let contextWords = [];

  // Extract keywords from Notes
  if (notes && typeof notes === 'string' && notes.trim().length > 0) {
    const words = notes.split(/[\s,.\n]+/).filter(w => w.length > 5);
    contextWords.push(...words);
  }

  // Extract context from Reading List URLs or text
  readingList.forEach(item => {
    try {
      const url = new URL(item.text);
      const pathSegments = url.pathname.split(/[\/-]/).filter(w => w.length > 4);
      contextWords.push(url.hostname.replace('www.', '').split('.')[0]);
      contextWords.push(...pathSegments);
    } catch {
      const words = item.text.split(/[\s,.\n]+/).filter(w => w.length > 4);
      contextWords.push(...words);
    }
  });

  // Clean up and unique
  contextWords = [...new Set(contextWords.map(w => w.toLowerCase()))].filter(Boolean);
  contextWords = contextWords.sort(() => 0.5 - Math.random());

  const questions = [];

  // Generate specific questions based on actual extracted context words
  for (let i = 0; i < contextWords.length && questions.length < 6; i++) {
    const word = contextWords[i];
    const templates = [
      `What did you learn regarding "${word}" from your recent reading or notes?`,
      `How are you planning to apply the concept of "${word}" today?`,
      `Reflect on the topic of "${word}" from your saved articles.`,
      `Can you summarize your thoughts on "${word}"?`
    ];
    questions.push(templates[Math.floor(Math.random() * templates.length)]);
  }

  // Generic reflective questions strictly about the user's reading list and notes
  const genericContextQuestions = [
    "Summarize the most important point from the last article in your reading list.",
    "What is the key takeaway from the notes you took today?",
    "Which article from your reading list are you most excited to finish, and why?",
    "Explain one concept you wrote down in your Quick Notes to a 5-year-old.",
    "How do the items in your reading list connect to your main focus for today?",
    "What action item can you create based on your recent notes?",
    "Is there anything in your reading list that you disagree with? Why?",
    "What is the underlying theme of the articles you've saved recently?",
    "If you had to delete all your notes except one sentence, what would it be?",
    "How will the reading material you've saved help you achieve your goals?"
  ];

  const shuffledGenerics = genericContextQuestions.sort(() => 0.5 - Math.random());
  
  while (questions.length < 10) {
    questions.push(shuffledGenerics.pop());
  }

  return questions.map((q, i) => `
    <div style="margin-bottom: 12px;">
      <label style="display: block; font-weight: 500; margin-bottom: 4px; color: var(--clr-text);">Q${i+1}: ${q}</label>
      <input type="text" class="form-input" style="font-size: 0.85rem; padding: 0.4rem;" placeholder="Your reflection..." />
    </div>
  `).join('');
}

export async function showAiBypassModal(onComplete) {
  const data = await storageGet([KEYS.READING_LIST, KEYS.QUICK_NOTES]);
  const readingList = data[KEYS.READING_LIST] || [];
  const notes = data[KEYS.QUICK_NOTES] || '';

  container.innerHTML = generateQuestions(readingList, notes);
  modal.classList.remove('hidden');

  const onCancel = () => {
    cleanup();
    onComplete(false);
  };

  const onConfirm = () => {
    // Check if they answered at least one
    const inputs = container.querySelectorAll('input');
    const hasAnswers = Array.from(inputs).some(input => input.value.trim().length > 0);
    if (!hasAnswers) {
      alert('Please reflect on at least one question to bypass Focus Mode.');
      return;
    }
    cleanup();
    onComplete(true);
  };

  const cleanup = () => {
    modal.classList.add('hidden');
    btnCancel.removeEventListener('click', onCancel);
    btnConfirm.removeEventListener('click', onConfirm);
  };

  btnCancel.addEventListener('click', onCancel);
  btnConfirm.addEventListener('click', onConfirm);
}
