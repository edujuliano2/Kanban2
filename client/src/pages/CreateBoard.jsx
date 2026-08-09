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
      await api.createBoard(name, description);
      navigate('/boards');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page center">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Criar Quadro</h1>

        <label className="field">
          <span>Nome do Quadro</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Trabalho, Compras, Projetos"
            required
          />
        </label>

        <label className="field">
          <span>Descrição</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o objetivo deste quadro (opcional)"
            rows={3}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row gap">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/boards')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
