import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";

export default function App() {
  const loc = useLocation();
  const is = (p: string) => (loc.pathname === p ? "active" : "");
  const { user, role, signOut } = useAuth();
  const displayName = user
    ? user.isAnonymous
      ? "Guest"
      : user.displayName || user.email?.split("@")[0] || "You"
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">📍</span>
          <span>MuniPeople</span>
        </Link>
        <nav className="nav">
          <Link to="/" className={is("/")}>
            Map
          </Link>
          <Link to="/leaderboard" className={is("/leaderboard")}>
            Impact
          </Link>
          {role === "authority" && (
            <Link to="/gov" className={is("/gov")}>
              Authority
            </Link>
          )}
          <Link to="/report" className="btn btn-primary btn-sm">
            ＋ Report
          </Link>
          {user ? (
            <span className="user-chip">
              {displayName}
              <button className="link-btn" onClick={() => void signOut()}>
                Sign out
              </button>
            </span>
          ) : (
            <Link to="/login" className={is("/login")}>
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
