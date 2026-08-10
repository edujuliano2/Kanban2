import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');

  const [desc, setDesc] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);

  const [comment, setComment] = useState('');
  const [checkItem, setCheckItem] = useState('');

  async function loadCard() {
    try {
      const data = await api.getCard(id);
      setCard(data);
      setTitle(data.title);
      setDesc(data.description);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCard();
  }, [id]);

  async function saveTitle() {
    if (title.trim()) {
      setCard(await api.updateCard(id, { title }));
    }
    setEditingTitle(false);
  }

  async function saveDesc() {
    setCard(await api.updateCard(id, { description: desc }));
    setEditingDesc(false);
  }

  async function handleDelete() {
    if (!window.confirm('Excluir este cartão?')) return;
    const boardId = card.board_id;
    await api.deleteCard(id);
    navigate(`/board/${boardId}`);
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCard(await api.addComment(id, comment));
    setComment('');
  }

  async function handleAddCheck(e) {
    e.preventDefault();
    if (!checkItem.trim()) return;
    setCard(await api.addChecklistItem(id, checkItem));
    setCheckItem('');
  }

  async function toggleCheck(itemId, checked) {
    setCard(await api.updateChecklistItem(itemId, { checked: !checked }));
  }

  async function removeCheck(itemId) {
    setCard(await api.deleteChecklistItem(itemId));
  }

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!card) return <div className="page">Carregando...</div>;

  const doneCount = card.checklist.filter((i) => i.checked).length;

  return (
    <div className="page">
      <header className="topbar">
        <Link to={`/board/${card.board_id}`} className="btn">Fechar</Link>
        <button className="btn danger" onClick={handleDelete}>Excluir Cartão</button>
      </header>

      <div className="card-detail">
        {editingTitle ? (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveTitle();
            }}
          >
            <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="row gap">
              <button type="submit" className="btn primary small">Salvar</button>
              <button type="button" className="btn small" onClick={() => setEditingTitle(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="title-row">
            <h1>{card.title}</h1>
            <button className="btn small" onClick={() => setEditingTitle(true)}>
              Editar Título
            </button>
          </div>
        )}

        <section className="section">
          <h2>Descrição</h2>
          {editingDesc ? (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveDesc();
              }}
            >
              <textarea
                autoFocus
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="row gap">
                <button type="submit" className="btn primary small">Salvar</button>
                <button type="button" className="btn small" onClick={() => setEditingDesc(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <p className="prewrap" onClick={() => setEditingDesc(true)}>
              {card.description || <span className="muted">Sem descrição. Clique para adicionar.</span>}
            </p>
          )}
        </section>

        <section className="section">
          <h2>Checklist ({doneCount}/{card.checklist.length})</h2>
          <form className="inline-form row-gap" onSubmit={handleAddCheck}>
            <input
              type="text"
              value={checkItem}
              onChange={(e) => setCheckItem(e.target.value)}
              placeholder="Novo item do checklist"
            />
            <button type="submit" className="btn primary small">Adicionar</button>
          </form>

          <ul className="checklist">
            {card.checklist.map((item) => (
              <li key={item.id} className={item.checked ? 'checked' : ''}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    onChange={() => toggleCheck(item.id, item.checked)}
                  />
                  <span>{item.text}</span>
                </label>
                <button className="btn text small" onClick={() => removeCheck(item.id)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>Comentários</h2>
          <form className="inline-form row-gap" onSubmit={handleComment}>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva um comentário..."
            />
            <button type="submit" className="btn primary small">Enviar Comentário</button>
          </form>

          {card.comments.length === 0 ? (
            <p className="muted">Nenhum comentário ainda.</p>
          ) : (
            <ul className="comments">
              {card.comments.map((c) => (
                <li key={c.id}>
                  <p className="prewrap">{c.content}</p>
                  <span className="muted small">{formatDate(c.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  const isIso = /^\d{4}-\d{2}-\d{2}T/.test(value);
  const d = new Date(isIso ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
