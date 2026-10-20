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
  register: (name, email, password, inviteCode) =>
    request('/auth/register', {
      method: 'POST',
      body: { name, email, password, inviteCode }
    }),

  getMe: () => request('/settings/me'),
  updateProfile: (payload) => request('/settings/profile', { method: 'PUT', body: payload }),

  getFamily: () => request('/family'),
  updateFamily: (payload) => request('/family', { method: 'PUT', body: payload }),
  regenerateInviteCode: () => request('/family/invite-code', { method: 'POST' }),
  joinFamily: (code) => request('/family/join', { method: 'POST', body: { code } }),

  getBoards: () => request('/boards'),
  createBoard: (name, description) =>
    request('/boards', { method: 'POST', body: { name, description } }),
  getBoard: (id) => request(`/boards/${id}`),
  updateBoard: (id, payload) => request(`/boards/${id}`, { method: 'PUT', body: payload }),
  deleteBoard: (id) => request(`/boards/${id}`, { method: 'DELETE' }),
  createCard: (boardId, payload) =>
    request(`/boards/${boardId}/cards`, { method: 'POST', body: payload }),

  getAgenda: (from, to) => {
    const params = new URLSearchParams({ from, to });
    return request(`/agenda?${params.toString()}`);
  },

  getMembers: () => request('/members'),
  createMember: (payload) => request('/members', { method: 'POST', body: payload }),
  updateMember: (id, payload) => request(`/members/${id}`, { method: 'PUT', body: payload }),
  deleteMember: (id) => request(`/members/${id}`, { method: 'DELETE' }),

  getCard: (id) => request(`/cards/${id}`),
  getReminders: () => request('/cards/reminders'),
  updateCard: (id, payload) => request(`/cards/${id}`, { method: 'PUT', body: payload }),
  deleteCard: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
  addComment: (id, content) =>
    request(`/cards/${id}/comments`, { method: 'POST', body: { content } }),
  addChecklistItem: (id, text) =>
    request(`/cards/${id}/checklist`, { method: 'POST', body: { text } }),
  updateChecklistItem: (itemId, payload) =>
    request(`/cards/checklist/${itemId}`, { method: 'PUT', body: payload }),
  deleteChecklistItem: (itemId) =>
    request(`/cards/checklist/${itemId}`, { method: 'DELETE' })
};
