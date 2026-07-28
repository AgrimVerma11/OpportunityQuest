import { Link, useNavigate, useLocation } from "react-router-dom";
import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, logout } = useAuth();

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/register";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="nav-logo" onClick={() => navigate("/home")}>
          <span className="nav-logo-badge">OQ</span>
          Opportunity Quest
        </span>

        {!isAuthPage && (
          <>
            <span className="nav-divider" />
            <Link
              to="/home"
              className={`nav-link${isActive("/home") ? " active" : ""}`}
            >
              Home
            </Link>

            {currentUser?.role === "Faculty" && (
              <Link
                to="/faculty"
                className={`nav-link${isActive("/faculty") ? " active" : ""}`}
              >
                Faculty Corner
              </Link>
            )}

            {currentUser?.role === "Student" && (
              <Link
                to="/my-applications"
                className={`nav-link${
                  isActive("/my-applications") ? " active" : ""
                }`}
              >
                My Applications
              </Link>
            )}

            {currentUser?.role === "Coordinator" && (
              <Link
                to="/approvals"
                className={`nav-link${
                  isActive("/approvals") ? " active" : ""
                }`}
              >
                Approvals
              </Link>
            )}
          </>
        )}
      </div>

      {!isAuthPage && (
        <div className="nav-right">
          <Link to="/profile" className="user-chip">
            <Avatar
              name={currentUser?.name}
              image={currentUser?.profileImage}
              size={36}
            />
            <div className="user-info">
              <span className="user-name">
                {currentUser?.prefix ? `${currentUser.prefix} ` : ""}
                {currentUser?.name}
              </span>
              <span className={`user-role ${currentUser?.role}`}>
                {currentUser?.role}
              </span>
            </div>
          </Link>

          <button className="nav-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
