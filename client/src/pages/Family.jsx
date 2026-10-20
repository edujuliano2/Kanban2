import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { MEMBER_COLORS, MEMBER_EMOJIS, memberColor } from '../colors';

const EMPTY_FORM = {
  name: '',
  relationship: '',
  email: '',
  color: MEMBER_COLORS[0],
  emoji: '🙂'
};

export default function Family() {
  const { setUser } = useAuth();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [editingFamilyName, setEditingFamilyName] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinMessage, setJoinMessage] = useState('');

  const navigate = useNavigate();
  const members = family?.members || [];
  const isNew = editingId === 'new' || members.length === 0;

  async function loadFamily() {
    try {
      const data = await api.getFamily();
      setFamily(data);
      setFamilyName(data.name);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFamily();
  }, []);

  useEffect(() => {
    if (editingId !== null) {
      document.querySelector('.member-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [editingId]);

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  }

  function startNew() {
    setEditingId('new');
    setForm({
      ...EMPTY_FORM,
      color: MEMBER_COLORS[members.length % MEMBER_COLORS.length]
    });
    setError('');
  }

  function startEdit(member) {
    setEditingId(member.id);
    setForm({
      name: member.name,
      relationship: member.relationship || '',
      email: member.email || '',
      color: memberColor(member.color),
      emoji: member.emoji || '🙂'
    });
    setError('');
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome da pessoa.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (isNew) {
        const created = await api.createMember(form);
        setFamily((prev) => ({ ...prev, members: [...prev.members, created] }));
        flash(`${created.name} foi adicionado(a) à família.`);
      } else {
        const updated = await api.updateMember(editingId, form);
        setFamily((prev) => ({
          ...prev,
          members: prev.members.map((member) =>
            member.id === updated.id ? updated : member
          )
        }));
        flash('Dados da pessoa atualizados.');
      }
      cancel();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(member) {
    if (
      !window.confirm(
        `Remover ${member.name} da família? As atividades continuam na agenda, mas ficarão sem essa pessoa.`
      )
    ) {
      return;
    }
    try {
      await api.deleteMember(member.id);
      setFamily((prev) => ({
        ...prev,
        members: prev.members.filter((item) => item.id !== member.id)
      }));
      if (editingId === member.id) cancel();
      flash(`${member.name} foi removido(a) da família.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(family.invite_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar o código. Selecione e copie manualmente.');
    }
  }

  async function handleFamilyName(e) {
    e.preventDefault();
    if (!familyName.trim()) return;
    setSavingFamily(true);
    try {
      const updated = await api.updateFamily({ name: familyName });
      setFamily(updated);
      setUser((prev) => (prev ? { ...prev, family_name: updated.name } : prev));
      setEditingFamilyName(false);
      flash('Nome da família atualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFamily(false);
    }
  }

  async function handleRegenerateCode() {
    if (!window.confirm('Gerar um novo código? O código atual deixará de funcionar.')) {
      return;
    }
    try {
      const updated = await api.regenerateInviteCode();
      setFamily(updated);
      flash('Novo código de convite gerado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setJoinError('');
    setJoinMessage('');
    try {
      const data = await api.joinFamily(joinCode);
      setFamily(data.family);
      setFamilyName(data.family.name);
      setUser(data.user);
      setJoinCode('');
      setJoinMessage(
        data.joined
          ? `Você entrou na ${data.family.name}.`
          : `Você já faz parte da ${data.family.name}.`
      );
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>{family?.name || 'Nossa família'}</h1>
          <p className="muted">
            Cada pessoa pode ter o próprio login, e todas compartilham as mesmas agendas.
          </p>
        </div>
        <nav className="topbar-actions">
          <button type="button" className="btn" onClick={() => navigate('/boards')}>
            Voltar às agendas
          </button>
          <button type="button" className="btn primary" onClick={startNew}>
            + Adicionar pessoa
          </button>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : !family ? null : (
        <>
          <section className="family-invite-card">
            <div className="family-invite-main">
              <div>
                <span className="eyebrow">Código de convite</span>
                <div className="invite-code-row">
                  <strong className="invite-code">{family.invite_code}</strong>
                  <button type="button" className="btn small" onClick={copyInviteCode}>
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button type="button" className="btn text small" onClick={handleRegenerateCode}>
                    Gerar novo
                  </button>
                </div>
                <p className="muted small">
                  Compartilhe com a esposa, filhas ou outros familiares. Eles criam a própria conta
                  em “Criar conta” e informam este código para entrar na mesma família. Dica:
                  cadastre o e-mail da pessoa antes de convidar para vincular o login ao cadastro
                  que já existe.
                </p>
              </div>

              <div className="family-name-box">
                {editingFamilyName ? (
                  <form className="family-name-form" onSubmit={handleFamilyName}>
                    <label className="field">
                      <span>Nome da família</span>
                      <input
                        autoFocus
                        type="text"
                        value={familyName}
                        onChange={(e) => setFamilyName(e.target.value)}
                        required
                      />
                    </label>
                    <div className="row gap">
                      <button type="submit" className="btn primary small" disabled={savingFamily}>
                        {savingFamily ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setFamilyName(family.name);
                          setEditingFamilyName(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="family-name-view">
                    <span className="muted small">Nome exibido para a família</span>
                    <strong>{family.name}</strong>
                    <button
                      type="button"
                      className="btn text small"
                      onClick={() => setEditingFamilyName(true)}
                    >
                      Editar nome
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {(editingId === 'new' || members.length === 0) && (
            <form className="card member-form" onSubmit={handleSubmit}>
              <h2>{members.length === 0 ? 'Comece pela sua família' : 'Nova pessoa'}</h2>
              <p className="muted">
                Cadastre quem participa da rotina. O e-mail é usado para enviar os convites de
                calendário.
              </p>

              <div className="form-grid">
                <label className="field">
                  <span>Nome</span>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Ana, Sofia, Lucas"
                    required
                  />
                </label>

                <label className="field">
                  <span>Papel na família</span>
                  <input
                    type="text"
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    placeholder="Ex: Mãe, Filha, Pai"
                  />
                </label>

                <label className="field">
                  <span>E-mail para convites</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="pessoa@exemplo.com (opcional)"
                  />
                </label>
              </div>

              <div className="field">
                <span>Emoji</span>
                <div className="emoji-picker">
                  {MEMBER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`emoji-option${form.emoji === emoji ? ' selected' : ''}`}
                      onClick={() => setForm({ ...form, emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                  <input
                    type="text"
                    className="emoji-input"
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value.slice(0, 4) })}
                    aria-label="Outro emoji"
                  />
                </div>
              </div>

              <div className="field">
                <span>Cor</span>
                <div className="color-picker">
                  {MEMBER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch${form.color === color ? ' selected' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                      onClick={() => setForm({ ...form, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="row gap">
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Salvando...' : 'Salvar pessoa'}
                </button>
                {members.length > 0 && (
                  <button type="button" className="btn" onClick={cancel}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="member-grid">
            {members.map((member) => (
              <div
                key={member.id}
                className="member-card"
                style={{ borderTopColor: memberColor(member.color) }}
              >
                <div className="member-card-head">
                  <span
                    className="member-avatar large"
                    style={{ backgroundColor: memberColor(member.color) }}
                  >
                    {member.emoji || '🙂'}
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <span className="muted">{member.relationship || 'Família'}</span>
                  </div>
                </div>

                <div className="member-card-info">
                  <span className={member.email ? '' : 'muted'}>
                    {member.email || 'Sem e-mail para convites'}
                  </span>
                  {member.linked_user_id ? (
                    <span className="access-badge">Login próprio</span>
                  ) : (
                    <span className="access-badge guest">Sem login</span>
                  )}
                </div>

                <div className="member-card-actions">
                  <button type="button" className="btn text small" onClick={() => startEdit(member)}>
                    Editar
                  </button>
                  {!member.linked_user_id && (
                    <button
                      type="button"
                      className="btn text small danger-text"
                      onClick={() => handleDelete(member)}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {members.length > 0 && editingId !== 'new' && editingId !== null && (
            <form className="card member-form" onSubmit={handleSubmit}>
              <h2>Editar pessoa</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Nome</span>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Papel na família</span>
                  <input
                    type="text"
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    placeholder="Ex: Mãe, Filha, Pai"
                  />
                </label>
                <label className="field">
                  <span>E-mail para convites</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={Boolean(members.find((m) => m.id === editingId)?.linked_user_id)}
                  />
                  {Boolean(members.find((m) => m.id === editingId)?.linked_user_id) && (
                    <small className="field-hint">
                      Este é o e-mail da conta de login. Para alterar, use Ajustes da conta.
                    </small>
                  )}
                </label>
              </div>
              <div className="field">
                <span>Emoji</span>
                <div className="emoji-picker">
                  {MEMBER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`emoji-option${form.emoji === emoji ? ' selected' : ''}`}
                      onClick={() => setForm({ ...form, emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                  <input
                    type="text"
                    className="emoji-input"
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value.slice(0, 4) })}
                    aria-label="Outro emoji"
                  />
                </div>
              </div>
              <div className="field">
                <span>Cor</span>
                <div className="color-picker">
                  {MEMBER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch${form.color === color ? ' selected' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                      onClick={() => setForm({ ...form, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="row gap">
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button type="button" className="btn" onClick={cancel}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <p className="muted family-hint">
            As cores aparecem nas atividades da agenda. Quem tem login próprio entra com o próprio
            e-mail e senha e vê a mesma família.
          </p>

          <details className="family-join-section">
            <summary>Já tem uma conta e quer entrar em outra família?</summary>
            <form className="family-join-form" onSubmit={handleJoin}>
              <p className="muted small">
                Informe o código da outra família. Isso só funciona se a sua conta atual ainda não
                tiver agendas ou outras pessoas cadastradas.
              </p>
              <div className="row gap">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código de convite"
                />
                <button type="submit" className="btn primary" disabled={joining}>
                  {joining ? 'Entrando...' : 'Entrar na família'}
                </button>
              </div>
              {joinError && <p className="error">{joinError}</p>}
              {joinMessage && <p className="success">{joinMessage}</p>}
            </form>
          </details>

          <p className="muted small family-id-note">
            {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'} na família · Todas
            compartilham as mesmas agendas.
          </p>
        </>
      )}
    </div>
  );
}
