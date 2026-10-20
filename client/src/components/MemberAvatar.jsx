import { memberColor } from '../colors';

export default function MemberAvatar({ member, size = 'normal' }) {
  if (!member) {
    return (
      <span className={`member-avatar ${size} guest`} title="Sem pessoa definida">
        ?
      </span>
    );
  }

  return (
    <span
      className={`member-avatar ${size}`}
      style={{ backgroundColor: memberColor(member.color) }}
      title={member.name}
    >
      {member.emoji || '🙂'}
    </span>
  );
}
