import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App";
import HomePage from "./pages/HomePage";
import ReportPage from "./pages/ReportPage";
import IssueDetailPage from "./pages/IssueDetailPage";
import GovPanelPage from "./pages/GovPanelPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "report", element: <ReportPage /> },
      { path: "issue/:id", element: <IssueDetailPage /> },
      { path: "gov", element: <GovPanelPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
