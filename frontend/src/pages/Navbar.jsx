import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/register";

  const handleLogout = () => {
    localStorage.clear();
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
          </>
        )}
      </div>

      {!isAuthPage && (
        <div className="nav-right">
          <Link to="/profile" className="user-chip">
            <div className="user-avatar">
              {currentUser?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{currentUser?.name}</span>
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
