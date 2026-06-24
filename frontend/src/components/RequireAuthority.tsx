import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Loader } from "./Loader";

// Gate authority-only routes. Citizens/guests are bounced to the map.
export function RequireAuthority({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <Loader label="Checking access…" />;
  if (role !== "authority") return <Navigate to="/" replace />;
  return <>{children}</>;
}
