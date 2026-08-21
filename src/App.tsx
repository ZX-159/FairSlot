import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import PublicEvents from './pages/PublicEvents';
import JoinEvent from './pages/JoinEvent';
import ClaimEvent from './pages/ClaimEvent';
import ClaimReceipt from './pages/ClaimReceipt';
import Dashboard from './pages/Dashboard';
import EventEditor from './pages/EventEditor';
import EventManage from './pages/EventManage';
import Account from './pages/Account';
import Faq from './pages/Faq';
import Guide from './pages/Guide';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/events" element={<PublicEvents />} />
          <Route path="/join" element={<JoinEvent />} />
          <Route path="/e/:code" element={<ClaimEvent />} />
          <Route path="/event/:code" element={<ClaimEvent />} />
          <Route path="/receipt/:token" element={<ClaimReceipt />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/guide" element={<Guide />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/new"
            element={
              <ProtectedRoute>
                <EventEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/:id"
            element={
              <ProtectedRoute>
                <EventManage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
