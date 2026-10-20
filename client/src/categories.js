export const CATEGORIES = [
  { value: 'compromisso', label: 'Compromisso', icon: '📌' },
  { value: 'escola', label: 'Escola', icon: '🎒' },
  { value: 'trabalho', label: 'Trabalho', icon: '💼' },
  { value: 'saude', label: 'Saúde', icon: '🩺' },
  { value: 'esporte', label: 'Esporte', icon: '⚽' },
  { value: 'lazer', label: 'Lazer', icon: '🎉' },
  { value: 'casa', label: 'Casa', icon: '🏠' },
  { value: 'viagem', label: 'Viagem', icon: '✈️' },
  { value: 'outro', label: 'Outro', icon: '📎' }
];

export function categoryOf(value) {
  return CATEGORIES.find((category) => category.value === value) || CATEGORIES[CATEGORIES.length - 1];
}
