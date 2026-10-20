import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);

    const payload = { name, email };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const updated = await api.updateProfile(payload);
      setUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Alterações salvas com sucesso!');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Ajustes da conta</h1>
        <Link to="/boards" className="btn">Voltar às agendas</Link>
      </header>

      <form className="card max-w" onSubmit={handleSubmit}>
        <h2>Seus dados</h2>
        <p className="muted">
          Estes dados identificam a sua conta na família. As pessoas da rotina são cadastradas na
          aba Família.
        </p>
        {user?.family_name && (
          <p className="family-account-line">
            Família: <strong>{user.family_name}</strong> ·{' '}
            <Link to="/family">gerenciar família e convites</Link>
          </p>
        )}

        <label className="field">
          <span>Nome</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <hr />

        <label className="field">
          <span>Senha Atual</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Necessária para trocar a senha"
          />
        </label>

        <label className="field">
          <span>Nova Senha</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Deixe em branco para manter"
            minLength={6}
          />
        </label>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="row gap">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button type="button" className="btn danger" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </form>
    </div>
  );
}
