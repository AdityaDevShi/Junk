import { Link, Outlet, useLocation } from "react-router-dom";

export default function App() {
  const loc = useLocation();
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">📍</span>
          <span>Community&nbsp;Hero</span>
        </Link>
        <nav className="nav">
          <Link to="/" className={loc.pathname === "/" ? "active" : ""}>
            Map
          </Link>
          <Link to="/gov" className={loc.pathname === "/gov" ? "active" : ""}>
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
