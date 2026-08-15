import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

/** Sends signed-out visitors to /login, remembering where they were headed. */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
