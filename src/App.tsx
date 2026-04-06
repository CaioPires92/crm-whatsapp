import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Conversas from './pages/Conversas';
import Agenda from './pages/Agenda';
import Campanhas from './pages/Campanhas';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rota Pública */}
            <Route path="/login" element={<Login />} />

            {/* Rotas Protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Dashboard />}>
                <Route index element={<Navigate to="/kanban" replace />} />
                <Route path="kanban" element={<Kanban />} />
                <Route path="conversas" element={<Conversas />} />
                <Route path="contatos" element={<Agenda />} />
                <Route path="campanhas" element={<Campanhas />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
