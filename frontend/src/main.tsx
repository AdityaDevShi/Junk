import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import { RequireAuthority } from "./components/RequireAuthority";
import App from "./App";
import HomePage from "./pages/HomePage";
import ReportPage from "./pages/ReportPage";
import IssueDetailPage from "./pages/IssueDetailPage";
import GovPanelPage from "./pages/GovPanelPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LoginPage from "./pages/LoginPage";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "report", element: <ReportPage /> },
      { path: "issue/:id", element: <IssueDetailPage /> },
      {
        path: "gov",
        element: (
          <RequireAuthority>
            <GovPanelPage />
          </RequireAuthority>
        ),
      },
      { path: "leaderboard", element: <LeaderboardPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
