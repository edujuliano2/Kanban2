import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import AppNav from './components/AppNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Boards from './pages/Boards';
import CreateBoard from './pages/CreateBoard';
import Board from './pages/Board';
import CardDetail from './pages/CardDetail';
import Calendar from './pages/Calendar';
import Family from './pages/Family';
import Settings from './pages/Settings';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page center">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page center">Carregando...</div>;
  if (user) return <Navigate to="/boards" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthed>
                <Register />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/boards"
            element={
              <RequireAuth>
                <Boards />
              </RequireAuth>
            }
          />
          <Route
            path="/create-board"
            element={
              <RequireAuth>
                <CreateBoard />
              </RequireAuth>
            }
          />
          <Route
            path="/board/:id"
            element={
              <RequireAuth>
                <Board />
              </RequireAuth>
            }
          />
          <Route
            path="/board/card/:id"
            element={
              <RequireAuth>
                <CardDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/family"
            element={
              <RequireAuth>
                <Family />
              </RequireAuth>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireAuth>
                <Calendar />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
