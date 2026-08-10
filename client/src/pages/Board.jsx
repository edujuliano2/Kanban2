import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';
import { contrastColor } from '../colors';
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
    const { destination, source, draggableId } = result;
    if (!destination) return;
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

      <DragDropContext onDragEnd={onDragEnd}>
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
                            <button
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`card-mini${dragSnapshot.isDragging ? ' dragging' : ''}`}
                              style={
                                card.color
                                  ? { backgroundColor: card.color, color: contrastColor(card.color) }
                                  : undefined
                              }
                              onClick={() => navigate(`/board/card/${card.id}`)}
                            >
                              {card.title}
                            </button>
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
    </div>
  );
}