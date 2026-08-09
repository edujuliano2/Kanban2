const API_BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('kanban_token');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || 'Erro na requisição');
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),

  getMe: () => request('/settings/me'),
  updateProfile: (payload) => request('/settings/profile', { method: 'PUT', body: payload }),

  getBoards: () => request('/boards'),
  createBoard: (name, description) =>
    request('/boards', { method: 'POST', body: { name, description } }),
  getBoard: (id) => request(`/boards/${id}`),
  deleteBoard: (id) => request(`/boards/${id}`, { method: 'DELETE' }),

  addList: (boardId, title) =>
    request(`/boards/${boardId}/lists`, { method: 'POST', body: { title } }),
  deleteList: (id) => request(`/lists/${id}`, { method: 'DELETE' }),
  addCard: (listId, title) =>
    request(`/lists/${listId}/cards`, { method: 'POST', body: { title } }),

  getCard: (id) => request(`/cards/${id}`),
  updateCard: (id, payload) => request(`/cards/${id}`, { method: 'PUT', body: payload }),
  deleteCard: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
  moveCard: (cardId, toListId, toIndex) =>
    request('/cards/move', { method: 'POST', body: { cardId, toListId, toIndex } }),
  addComment: (id, content) =>
    request(`/cards/${id}/comments`, { method: 'POST', body: { content } }),
  addChecklistItem: (id, text) =>
    request(`/cards/${id}/checklist`, { method: 'POST', body: { text } }),
  updateChecklistItem: (itemId, payload) =>
    request(`/cards/checklist/${itemId}`, { method: 'PUT', body: payload }),
  deleteChecklistItem: (itemId) =>
    request(`/cards/checklist/${itemId}`, { method: 'DELETE' })
};
