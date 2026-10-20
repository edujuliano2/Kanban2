import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.login(email, password);
      setSession(data.token, data.user);
      navigate('/boards');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page center">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand" aria-hidden="true">📅</div>
        <h1 className="auth-title">Agenda da Família</h1>
        <p className="auth-subtitle">Organize a rotina de quem você ama</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            required
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="auth-link">
          Não tem uma conta? <Link to="/register">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
