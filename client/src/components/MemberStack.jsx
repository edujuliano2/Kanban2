import MemberAvatar from './MemberAvatar';

export default function MemberStack({ members = [], max = 3, size = 'small' }) {
  if (!members.length) {
    return <MemberAvatar member={null} size={size} />;
  }

  const visible = members.slice(0, max);
  const remaining = members.length - visible.length;

  return (
    <span className="member-stack" aria-label={members.map((member) => member.name).join(', ')}>
      {visible.map((member) => (
        <MemberAvatar key={member.id} member={member} size={size} />
      ))}
      {remaining > 0 && <span className="member-stack-more">+{remaining}</span>}
    </span>
  );
}
