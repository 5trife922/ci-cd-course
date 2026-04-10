const form = document.getElementById('form');
const input = document.getElementById('input');
const list = document.getElementById('list');
const empty = document.getElementById('empty');

/**
 * Форматирует дату для подписи задачи.
 * @param {string} iso Строка времени из БД.
 * @return {string}
 */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Запрос к JSON API.
 * @param {string} path Относительный URL.
 * @param {RequestInit=} options Аргументы fetch.
 * @return {!Promise<*>}
 */
async function api(path, options) {
  const res = await fetch(path, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data && data.error ? data.error : res.statusText;
    throw new Error(msg);
  }
  return data;
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
    if (!window.confirm('Удалить эту задачу?')) return;
    try {
      await api(`/api/todos/${todo.id}`, {method: 'DELETE'});
      li.remove();
      if (!list.children.length) setEmptyVisible(true);
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
 * Загружает список с сервера и отрисовывает.
 * @return {!Promise<void>}
 */
async function load() {
  const todos = await api('/api/todos');
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

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const title = input.value.trim();
  if (!title) return;
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
