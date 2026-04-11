const form = document.getElementById('form');
const input = document.getElementById('input');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const subtitle = document.getElementById('subtitle');
const confirmDialog = document.getElementById('confirmDialog');
const confirmMessage = document.getElementById('confirmMessage');

const STORAGE_KEY = 'sqlite-todo-local-v1';
let useLocalStorage = false;

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

function apiUrl(path) {
  const tail = path.startsWith('/') ? path.slice(1) : path;
  return new URL(tail, appBase()).href;
}

function setOfflineSubtitle(offline) {
  subtitle.textContent = offline ?
    'Мой список задач (сервер недоступен — данные в браузере)' :
    'Мой список задач';
}

/**
 * Модальное подтверждение (нативный dialog).
 * @param {string} message Текст под заголовком.
 * @return {!Promise<boolean>}
 */
function confirmModal(message) {
  confirmMessage.textContent = message;
  return new Promise((resolve) => {
    function onClose() {
      confirmDialog.removeEventListener('close', onClose);
      resolve(confirmDialog.returnValue === 'yes');
    }
    confirmDialog.addEventListener('close', onClose);
    confirmDialog.showModal();
  });
}

function readTodosFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeTodosToStorage(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function sortTodosNewestFirst(rows) {
  return rows.slice().sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function nextLocalId(rows) {
  return rows.reduce((m, r) => (r.id > m ? r.id : m), 0) + 1;
}

function parseBody(options) {
  if (!options || !options.body) {
    return {};
  }
  return JSON.parse(options.body);
}

async function requestLocal(path, options) {
  const method = (options && options.method) || 'GET';
  const rows = readTodosFromStorage();

  if (method === 'GET' && path === '/api/todos') {
    return sortTodosNewestFirst(rows);
  }

  if (method === 'POST' && path === '/api/todos') {
    const body = parseBody(options);
    const title = String(body.title || '').trim();
    if (!title) {
      throw new Error('Нужен непустой title');
    }
    const row = {
      id: nextLocalId(rows),
      title,
      completed: 0,
      created_at: new Date().toISOString(),
    };
    rows.push(row);
    writeTodosToStorage(rows);
    return row;
  }

  const match = path.match(/^\/api\/todos\/(\d+)$/);
  if (!match) {
    throw new Error('Not found');
  }
  const id = Number(match[1]);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error('Задача не найдена');
  }

  if (method === 'PATCH') {
    const body = parseBody(options);
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
    rows.splice(idx, 1);
    writeTodosToStorage(rows);
    return null;
  }

  throw new Error('Unsupported');
}

async function api(path, options) {
  if (useLocalStorage) {
    return requestLocal(path, options);
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

function setEmptyVisible(show) {
  empty.hidden = !show;
}

function applyTodos(todos) {
  list.replaceChildren();
  if (!todos.length) {
    setEmptyVisible(true);
    return;
  }
  setEmptyVisible(false);
  for (let i = 0; i < todos.length; i += 1) {
    list.appendChild(renderRow(todos[i]));
  }
}

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
  del.title = 'Удалить задачку';

  const todoPath = '/api/todos/' + todo.id;

  check.addEventListener('change', async () => {
    try {
      const updated = await api(todoPath, {
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
    const ok = await confirmModal(
        'Задача будет удалена. Это действие нельзя отменить.',
    );
    if (!ok) {
      return;
    }
    try {
      await api(todoPath, {method: 'DELETE'});
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

async function load() {
  try {
    const res = await fetch(apiUrl('/api/todos'), {
      headers: {'Accept': 'application/json'},
    });
    if (!res.ok) {
      throw new Error('bad status');
    }
    useLocalStorage = false;
    setOfflineSubtitle(false);
    applyTodos(await res.json());
  } catch (e) {
    useLocalStorage = true;
    setOfflineSubtitle(true);
    applyTodos(sortTodosNewestFirst(readTodosFromStorage()));
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
