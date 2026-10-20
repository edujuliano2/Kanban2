import { memberColor } from '../colors';
import MemberAvatar from './MemberAvatar';

export default function MemberPicker({ members = [], selected = [], onToggle }) {
  if (!members.length) {
    return <span className="muted small">Cadastre a família para marcar pessoas.</span>;
  }

  return (
    <div className="member-picker">
      {members.map((member) => {
        const active = selected.includes(member.id);
        const color = memberColor(member.color);
        return (
          <button
            key={member.id}
            type="button"
            className={`member-pick${active ? ' active' : ''}${member.email ? '' : ' no-email'}`}
            style={active ? { borderColor: color, backgroundColor: `${color}1a` } : undefined}
            title={member.email || 'Sem e-mail cadastrado para convites'}
            onClick={() => onToggle(member.id)}
          >
            <MemberAvatar member={member} size="small" />
            <span>{member.name}</span>
            {active && <span className="member-pick-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
