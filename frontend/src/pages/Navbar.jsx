import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import Avatar from "../components/Avatar";
import Logo from "../components/Logo";
import NotificationBell from "../components/NotificationBell";
import { IconChevronDown, IconMenu, IconX } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, logout } = useAuth();

  // A single open-menu state: "user" | "nav" | null (opening one closes the other).
  const [menu, setMenu] = useState(null);
  const headerRef = useRef(null);

  const isAuthPage =
    location.pathname === "/" || location.pathname === "/register";

  const closeMenus = () => setMenu(null);

  // Close menus on outside click or Escape. (Link clicks close via onClick.)
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMenu(null);
      }
    };
    const onKey = (e) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const handleLogout = () => {
    setMenu(null);
    logout();
    navigate("/");
  };

  const role = currentUser?.role;
  const links = [{ to: "/home", label: "Home" }];
  if (role === "Faculty") links.push({ to: "/faculty", label: "Faculty Corner" });
  if (role === "Student")
    links.push({ to: "/my-applications", label: "My Applications" });
  if (role === "Coordinator")
    links.push(
      { to: "/approvals", label: "Approvals" },
      { to: "/analytics", label: "Analytics" }
    );
  if (role === "Student" || role === "Faculty")
    links.push({ to: "/messages", label: "Messages", prefix: true });

  const isActive = (link) =>
    link.prefix
      ? location.pathname.startsWith(link.to)
      : location.pathname === link.to;

  return (
    <header className="navbar" ref={headerRef}>
      <div className="navbar-inner">
        <div className="nav-left">
          {!isAuthPage && (
            <button
              type="button"
              className="nav-burger"
              aria-label="Menu"
              aria-expanded={menu === "nav"}
              onClick={() => setMenu(menu === "nav" ? null : "nav")}
            >
              {menu === "nav" ? <IconX /> : <IconMenu />}
            </button>
          )}

          <Link to={currentUser ? "/home" : "/"} className="nav-brand">
            <img
              src="/brand/opportunity-quest-lockup-light.svg"
              alt="Opportunity Quest"
              className="nav-brand-lockup"
            />
            <Logo className="nav-brand-mark" size={42} />
          </Link>

          {!isAuthPage && (
            <nav className="nav-links" aria-label="Primary">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link${isActive(link) ? " active" : ""}`}
                  aria-current={isActive(link) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {!isAuthPage && currentUser && (
          <div className="nav-right">
            <NotificationBell />

            <div className="nav-user">
              <button
                type="button"
                className="nav-user-btn"
                aria-haspopup="menu"
                aria-expanded={menu === "user"}
                onClick={() => setMenu(menu === "user" ? null : "user")}
              >
                <Avatar
                  name={currentUser.name}
                  image={currentUser.profileImage}
                  size={32}
                />
                <span className="nav-user-meta">
                  <span className="nav-user-name">
                    {currentUser.prefix ? `${currentUser.prefix} ` : ""}
                    {currentUser.name}
                  </span>
                  <span className="nav-user-role">{currentUser.role}</span>
                </span>
                <IconChevronDown className="nav-user-caret" />
              </button>

              {menu === "user" && (
                <div className="nav-menu" role="menu">
                  <Link
                    to="/profile"
                    className="nav-menu-item"
                    role="menuitem"
                    onClick={closeMenus}
                  >
                    Profile
                  </Link>
                  <div className="nav-menu-divider" />
                  <button
                    type="button"
                    className="nav-menu-item nav-menu-danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile nav panel */}
      {!isAuthPage && menu === "nav" && (
        <nav className="nav-mobile" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-mobile-link${isActive(link) ? " active" : ""}`}
              aria-current={isActive(link) ? "page" : undefined}
              onClick={closeMenus}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export default Navbar;
