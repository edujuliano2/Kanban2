export const PALETTE = [
  { value: '', label: 'Sem cor', swatch: '#ffffff' },
  { value: '#ffeb3b', label: 'Amarelo', swatch: '#ffeb3b' },
  { value: '#ff9800', label: 'Laranja', swatch: '#ff9800' },
  { value: '#ff5252', label: 'Vermelho', swatch: '#ff5252' },
  { value: '#e91e63', label: 'Rosa', swatch: '#e91e63' },
  { value: '#9c27b0', label: 'Roxo', swatch: '#9c27b0' },
  { value: '#3f51b5', label: 'Índigo', swatch: '#3f51b5' },
  { value: '#2196f3', label: 'Azul', swatch: '#2196f3' },
  { value: '#009688', label: 'Verde-água', swatch: '#009688' },
  { value: '#4caf50', label: 'Verde', swatch: '#4caf50' },
  { value: '#795548', label: 'Marrom', swatch: '#795548' },
  { value: '#607d8b', label: 'Azul-cinza', swatch: '#607d8b' }
];

export const MEMBER_COLORS = [
  '#3b6cf6',
  '#e91e63',
  '#009688',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#10b981',
  '#0ea5e9',
  '#ec4899',
  '#64748b'
];

export const MEMBER_EMOJIS = ['🧑', '👩', '👨', '👧', '👦', '👶', '👵', '👴', '🐶', '🌟'];

export function contrastColor(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#172b4d' : '#ffffff';
}

export function memberColor(color) {
  return color || '#8a94a6';
}
