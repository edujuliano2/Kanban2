import { PALETTE } from '../colors';

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker" role="group" aria-label="Escolher cor">
      {PALETTE.map((c) => (
        <button
          key={c.value || 'none'}
          type="button"
          className={`color-swatch${value === c.value ? ' selected' : ''}`}
          style={{ backgroundColor: c.swatch }}
          title={c.label}
          onClick={() => onChange(c.value)}
        />
      ))}
    </div>
  );
}
