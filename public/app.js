const form = document.getElementById('form');
const input = document.getElementById('input');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const subtitle = document.getElementById('subtitle');

/** Ключ в localStorage при недоступном API. */
const STORAGE_KEY = 'sqlite-todo-local-v1';

/** true — список хранится только в браузере. */
let useLocalStorage = false;

/**
 * Базовый URL каталога текущей страницы (со слэшем на конце).
 * @return {string}
 */
function appBase() {
  const path = window.location.pathname;
  if (path.endsWith('/')) {
    return window.location.origin + path;
  }
  const slash = path.lastIndexOf('/');
  if (slash <= 0) {
    return window.location.origin + '/';
  }
  return window.location.origin + path.slice(0, slash + 1);
}

/**
 * Абсолютный URL для fetch (/api/...), в т.ч. на GitHub Pages с подпутём.
 * @param {string} path Путь вида /api/todos.
 * @return {string}
 */
function apiUrl(path) {
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return new URL(tail, appBase()).href;
}

/**
 * Показать подпись про офлайн-режим.
 * @param {boolean} offline Сервер недоступен.
 */
function setOfflineSubtitle(offline) {
  if (!subtitle) {
    return;
  }
  subtitle.textContent = offline ?
    'Мой список задач (сервер недоступен — данные в браузере)' :
    'Мой список задач';
}

/**
 * @return {!Array<!Object>}
 */
function readTodosFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const arr = JSON.parse(raw);
    if (!arr || !arr.length) {
      return [];
    }
    const out = [];
    for (let i = 0; i < arr.length; i += 1) {
      out.push(arr[i]);
    }
    return out;
  } catch (e) {
    return [];
  }
}

/**
 * @param {!Array<!Object>} rows
 */
function writeTodosToStorage(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

/**
 * Сортировка как на сервере: новые сверху.
 * @param {!Array<!Object>} rows
 * @return {!Array<!Object>}
 */
function sortTodosNewestFirst(rows) {
  const copy = rows.slice();
  copy.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });
  return copy;
}

/**
 * @param {!Array<!Object>} rows
 * @return {number}
 */
function nextLocalId(rows) {
  let m = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].id > m) {
      m = rows[i].id;
    }
  }
  return m + 1;
}

/**
 * @return {string}
 */
function nowCreatedAt() {
  return new Date().toISOString();
}

/**
 * CRUD в localStorage с тем же контрактом, что API.
 * @param {string} path /api/todos или /api/todos/:id
 * @param {RequestInit=} options
 * @return {!Promise<*>}
 */
async function requestLocal(path, options) {
  const method = (options && options.method) || 'GET';
  const rows = readTodosFromStorage();

  if (method === 'GET' && path === '/api/todos') {
    return sortTodosNewestFirst(rows);
  }

  if (method === 'POST' && path === '/api/todos') {
    const body = options && options.body ? JSON.parse(options.body) : {};
    const title = String(body.title || '').trim();
    if (!title) {
      throw new Error('Нужен непустой title');
    }
    const row = {
      id: nextLocalId(rows),
      title,
      completed: 0,
      created_at: nowCreatedAt(),
    };
    rows.push(row);
    writeTodosToStorage(rows);
    return row;
  }

  const m = path.match(/^\/api\/todos\/(\d+)$/);
  if (!m) {
    throw new Error('Not found');
  }
  const id = Number(m[1]);

  if (method === 'PATCH') {
    const body = options && options.body ? JSON.parse(options.body) : {};
    let idx = -1;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      throw new Error('Задача не найдена');
    }
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      rows[idx].title = t || rows[idx].title;
    }
    if (body.completed !== undefined) {
      rows[idx].completed = body.completed ? 1 : 0;
    }
    writeTodosToStorage(rows);
    return rows[idx];
  }

  if (method === 'DELETE') {
    const next = [];
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].id !== id) {
        next.push(rows[i]);
      }
    }
    if (next.length === rows.length) {
      throw new Error('Задача не найдена');
    }
    writeTodosToStorage(next);
    return null;
  }

  throw new Error('Unsupported');
}

/**
 * Запрос к JSON API или эмуляция через localStorage.
 * @param {string} path Относительный URL.
 * @param {RequestInit=} options Аргументы fetch.
 * @return {!Promise<*>}
 */
async function api(path, options) {
  if (useLocalStorage) {
    const method = (options && options.method) || 'GET';
    const out = await requestLocal(path, options);
    if (method === 'DELETE') {
      return null;
    }
    return out;
  }

  const res = await fetch(apiUrl(path), {
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  if (res.status === 204) {
    return null;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data && data.error ? data.error : res.statusText;
    throw new Error(msg);
  }
  return data;
}

/**
 * Форматирует дату для подписи задачи.
 * @param {string} iso Строка времени из БД.
 * @return {string}
 */
function formatDate(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Показывает или скрывает подсказку «пусто».
 * @param {boolean} show Показать текст.
 */
function setEmptyVisible(show) {
  empty.hidden = !show;
}

/**
 * Создаёт DOM-элемент строки задачи.
 * @param {!Object} todo Поля id, title, completed, created_at.
 * @return {!HTMLLIElement}
 */
function renderRow(todo) {
  const li = document.createElement('li');
  li.className = 'item' + (todo.completed ? ' done' : '');
  li.dataset.id = String(todo.id);

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'check';
  check.checked = !!todo.completed;
  check.title = todo.completed ? 'Отметить невыполненной' : 'Выполнено';

  const body = document.createElement('div');
  body.className = 'item-body';

  const p = document.createElement('p');
  p.className = 'item-text';
  p.textContent = todo.title;

  const meta = document.createElement('p');
  meta.className = 'item-meta';
  meta.textContent = formatDate(todo.created_at);

  body.appendChild(p);
  body.appendChild(meta);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn btn-ghost';
  del.textContent = 'Удалить';
  del.title = 'Удалить задачу';

  check.addEventListener('change', async () => {
    try {
      const updated = await api(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({completed: check.checked}),
      });
      li.classList.toggle('done', !!updated.completed);
      check.title = updated.completed ? 'Отметить невыполненной' : 'Выполнено';
    } catch (e) {
      check.checked = !check.checked;
      alert(e.message);
    }
  });

  del.addEventListener('click', async () => {
    if (!window.confirm('Удалить эту задачу?')) {
      return;
    }
    try {
      await api(`/api/todos/${todo.id}`, {method: 'DELETE'});
      li.remove();
      if (!list.children.length) {
        setEmptyVisible(true);
      }
    } catch (e) {
      alert(e.message);
    }
  });

  li.appendChild(check);
  li.appendChild(body);
  li.appendChild(del);
  return li;
}

/**
 * Пробует GET /api/todos; при успехе — сервер, иначе localStorage.
 * @return {!Promise<void>}
 */
async function load() {
  list.replaceChildren();
  let todos;

  try {
    const res = await fetch(apiUrl('/api/todos'), {
      headers: {'Accept': 'application/json'},
    });
    if (!res.ok) {
      throw new Error('bad status');
    }
    todos = await res.json();
    useLocalStorage = false;
    setOfflineSubtitle(false);
  } catch (e) {
    useLocalStorage = true;
    setOfflineSubtitle(true);
    todos = sortTodosNewestFirst(readTodosFromStorage());
  }

  if (!todos.length) {
    setEmptyVisible(true);
    return;
  }
  setEmptyVisible(false);
  for (let i = 0; i < todos.length; i += 1) {
    list.appendChild(renderRow(todos[i]));
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const title = input.value.trim();
  if (!title) {
    return;
  }
  try {
    const created = await api('/api/todos', {
      method: 'POST',
      body: JSON.stringify({title}),
    });
    input.value = '';
    setEmptyVisible(false);
    list.insertBefore(renderRow(created), list.firstChild);
  } catch (e) {
    alert(e.message);
  }
});

load().catch((e) => {
  empty.textContent = 'Не удалось загрузить: ' + e.message;
  empty.hidden = false;
});
