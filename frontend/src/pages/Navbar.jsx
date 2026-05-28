import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/" || location.pathname === "/register";

  const handleLogout = () => {
    localStorage.clear(); // 🔥 clears token too
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="nav-logo">Opportunity Quest</span>

        {!isAuthPage && (
          <>
            <Link to="/home" className="nav-link">Home</Link>
            <Link to="/faculty" className="nav-link">Faculty</Link>
          </>
        )}
      </div>

      {!isAuthPage && (
        <div className="nav-right">
          <button className="nav-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;