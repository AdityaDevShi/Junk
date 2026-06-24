import { Link, Outlet, useLocation } from "react-router-dom";

export default function App() {
  const loc = useLocation();
  const is = (p: string) => (loc.pathname === p ? "active" : "");
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">📍</span>
          <span>Community&nbsp;Hero</span>
        </Link>
        <nav className="nav">
          <Link to="/" className={is("/")}>
            Map
          </Link>
          <Link to="/leaderboard" className={is("/leaderboard")}>
            Impact
          </Link>
          <Link to="/gov" className={is("/gov")}>
            Authority
          </Link>
          <Link to="/report" className="btn btn-primary btn-sm">
            ＋ Report
          </Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
