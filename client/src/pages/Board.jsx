import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';
import { contrastColor } from '../colors';
import { formatDateTime, isOverdue } from '../datetime';
import ColorPicker from '../components/ColorPicker';

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAddList, setShowAddList] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listColor, setListColor] = useState('');

  const [newCardList, setNewCardList] = useState(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardColor, setCardColor] = useState('');

  const [editingList, setEditingList] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('');

  const [moveMenu, setMoveMenu] = useState(null);
  const dragActiveRef = useRef(0);

  async function loadBoard() {
    setLoading(true);
    try {
      setBoard(await api.getBoard(id));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, [id]);

  function onDragEnd(result) {
    if (!result.destination) return;

    const { destination, source, draggableId } = result;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceListId = Number(source.droppableId);
    const destListId = Number(destination.droppableId);
    const movedCardId = Number(draggableId);

    setBoard((prev) => {
      const lists = prev.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const sourceList = lists.find((l) => l.id === sourceListId);
      const destList = lists.find((l) => l.id === destListId);
      const [moved] = sourceList.cards.splice(source.index, 1);
      destList.cards.splice(destination.index, 0, moved);
      return { ...prev, lists };
    });

    api.moveCard(movedCardId, destListId, destination.index).catch(() => loadBoard());
  }

  async function handleAddList(e) {
    e.preventDefault();
    if (!listTitle.trim()) return;
    try {
      await api.addList(id, listTitle, listColor);
      setListTitle('');
      setListColor('');
      setShowAddList(false);
      await loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCard(e) {
    e.preventDefault();
    if (!cardTitle.trim()) return;
    try {
      await api.addCard(newCardList, cardTitle, cardColor);
      setCardTitle('');
      setCardColor('');
      setNewCardList(null);
      await loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditList(list) {
    setEditingList(list.id);
    setEditTitle(list.title);
    setEditColor(list.color || '');
  }

  async function handleEditList(e) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    try {
      await api.updateList(editingList, { title: editTitle, color: editColor });
      setEditingList(null);
      await loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteList(list) {
    if (!window.confirm(`Excluir a lista "${list.title}"? Isso apaga todos os cartões dela.`)) return;
    try {
      await api.deleteList(list.id);
      await loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleMoveCard(cardId, fromListId, targetListId) {
    setBoard((prev) => {
      const lists = prev.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const source = lists.find((l) => l.id === fromListId);
      const target = lists.find((l) => l.id === targetListId);
      const idx = source.cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return prev;
      const [moved] = source.cards.splice(idx, 1);
      target.cards.push(moved);
      return { ...prev, lists };
    });
    setMoveMenu(null);
    api
      .moveCard(cardId, targetListId, board.lists.find((l) => l.id === targetListId).cards.length)
      .catch(() => loadBoard());
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!board) return null;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>{board.name}</h1>
          {board.description && <p className="muted">{board.description}</p>}
        </div>
        <Link to="/boards" className="btn">Voltar</Link>
      </header>

      <DragDropContext
        onDragStart={() => (dragActiveRef.current = Date.now())}
        onDragEnd={onDragEnd}
      >
        <div className="board-body">
          {board.lists.map((list) => {
            const listText = contrastColor(list.color);
            const dark = listText === '#ffffff';
            return (
              <div
                key={list.id}
                className={`list${dark ? ' list-dark' : ''}`}
                style={list.color ? { backgroundColor: list.color } : undefined}
              >
                {editingList === list.id ? (
                  <form className="inline-form list-edit-form" onSubmit={handleEditList}>
                    <input
                      autoFocus
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Nome da lista"
                    />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="row gap">
                      <button type="submit" className="btn primary small">Salvar</button>
                      <button type="button" className="btn small" onClick={() => setEditingList(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="list-header">
                    <h3 className="list-title">{list.title}</h3>
                    <span className="list-actions">
                      <button
                        className="btn text small list-delete"
                        title="Editar lista"
                        onClick={() => startEditList(list)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn text small list-delete"
                        title="Excluir lista"
                        onClick={() => handleDeleteList(list)}
                      >
                        Excluir
                      </button>
                    </span>
                  </div>
                )}

                <Droppable droppableId={String(list.id)}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`list-cards${snapshot.isDraggingOver ? ' dragging-over' : ''}`}
                    >
                      {list.cards.map((card, index) => (
                        <Draggable
                          key={card.id}
                          draggableId={String(card.id)}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`card-mini${dragSnapshot.isDragging ? ' dragging' : ''}`}
                              style={{
                                ...dragProvided.draggableProps.style,
                                ...(card.color
                                  ? { backgroundColor: card.color, color: contrastColor(card.color) }
                                  : {}),
                              }}
                              onClick={() => {
                                if (Date.now() - dragActiveRef.current < 400) return;
                                navigate(`/board/card/${card.id}`);
                              }}
                            >
                              <span className="card-mini-title">{card.title}</span>
                              {card.remind_at && (
                                <span
                                  className={`card-mini-reminder${isOverdue(card.remind_at) ? ' overdue' : ''}`}
                                  title={`Lembrete: ${formatDateTime(card.remind_at)}`}
                                >
                                  ⏰ {formatDateTime(card.remind_at)}
                                </span>
                              )}
                              <button
                                type="button"
                                className="card-mini-move-btn"
                                title="Mover para lista..."
                                aria-label="Mover para lista"
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMoveMenu({ card, fromListId: list.id });
                                }}
                              >
                                ⋯
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {newCardList === list.id ? (
                  <form className="inline-form" onSubmit={handleAddCard}>
                    <input
                      autoFocus
                      type="text"
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                      placeholder="Título do cartão"
                    />
                    <ColorPicker value={cardColor} onChange={setCardColor} />
                    <div className="row gap">
                      <button type="submit" className="btn primary small">Salvar Cartão</button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setNewCardList(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="btn text add-card-btn"
                    onClick={() => setNewCardList(list.id)}
                  >
                    + Adicionar Cartão
                  </button>
                )}
              </div>
            );
          })}

          {showAddList ? (
            <form className="list new-list" onSubmit={handleAddList}>
              <input
                autoFocus
                type="text"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Nome da lista"
              />
              <ColorPicker value={listColor} onChange={setListColor} />
              <div className="row gap">
                <button type="submit" className="btn primary small">Salvar Lista</button>
                <button type="button" className="btn small" onClick={() => setShowAddList(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button className="list new-list-btn" onClick={() => setShowAddList(true)}>
              + Adicionar Lista
            </button>
          )}
        </div>
      </DragDropContext>

      {moveMenu && (
        <div className="modal-overlay" onClick={() => setMoveMenu(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mover "{moveMenu.card.title}" para outra lista</h3>
            {board.lists
              .filter((l) => l.id !== moveMenu.fromListId)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="modal-list"
                  onClick={() => handleMoveCard(moveMenu.card.id, moveMenu.fromListId, l.id)}
                >
                  <span
                    className="modal-list-dot"
                    style={l.color ? { backgroundColor: l.color } : { backgroundColor: '#ebecf0' }}
                  />
                  {l.title}
                </button>
              ))}
            {board.lists.filter((l) => l.id !== moveMenu.fromListId).length === 0 && (
              <p className="muted">Só existe uma lista neste quadro.</p>
            )}
            <button type="button" className="btn" onClick={() => setMoveMenu(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}