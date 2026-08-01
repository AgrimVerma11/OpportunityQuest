import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Route guard: requires a signed-in session, and optionally one or more allowed
// roles (a string or an array). Unauthenticated users are sent to the login
// screen; a signed-in user whose role isn't allowed is sent to their home feed.
// Rendering the guard before the page removes the flash of protected content
// that the old per-page redirects allowed.
export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  const allowedRoles = Array.isArray(role) ? role : role ? [role] : [];
  if (allowedRoles.length && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
