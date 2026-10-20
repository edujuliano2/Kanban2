import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function CreateBoard() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const board = await api.createBoard(name, description);
      navigate(`/board/${board.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page center">
      <form className="card max-w" onSubmit={handleSubmit}>
        <h1>Nova agenda</h1>
        <p className="muted">
          Use uma agenda para a rotina da família e outras para projetos ou compromissos específicos.
        </p>

        <label className="field">
          <span>Nome da agenda</span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Rotina da família, Escola das meninas, Trabalho"
            required
          />
        </label>

        <label className="field">
          <span>Descrição</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Para que serve esta agenda? (opcional)"
            rows={3}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row gap">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Criando...' : 'Criar agenda'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/boards')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
