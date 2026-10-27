import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Boards() {
  const [boards, setBoards] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getBoards()
      .then(setBoards)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, board) {
    e.stopPropagation();
    if (
      !window.confirm(
        `Excluir a agenda "${board.name}"? Todas as atividades dela serão apagadas.`
      )
    ) {
      return;
    }

    try {
      await api.deleteBoard(board.id);
      setBoards((prev) => prev.filter((item) => item.id !== board.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Agendas</h1>
          <p className="muted">Selecione uma agenda para abrir no calendário ou crie uma nova.</p>
        </div>
        <nav className="topbar-actions">
          <Link to="/create-board" className="btn primary">
            + Nova agenda
          </Link>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : boards.length === 0 ? (
        <div className="empty">
          <p>Você ainda não tem nenhuma agenda.</p>
          <Link to="/create-board" className="btn primary">
            Criar minha primeira agenda
          </Link>
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <div
              key={board.id}
              className="board-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/calendar?agenda=${board.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/calendar?agenda=${board.id}`);
              }}
            >
              <div className="board-card-top">
                <span className="board-card-icon" aria-hidden="true">
                  🗓️
                </span>
                <button
                  type="button"
                  className="board-delete"
                  title="Excluir agenda"
                  onClick={(e) => handleDelete(e, board)}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  Excluir
                </button>
              </div>

              <div className="board-card-text">
                <strong>{board.name}</strong>
                {board.description && <span>{board.description}</span>}
              </div>

              <span className="board-card-link">Abrir no calendário →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
