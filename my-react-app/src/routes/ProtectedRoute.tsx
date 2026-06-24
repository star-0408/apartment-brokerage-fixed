import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../shared/store/store";

export default function ProtectedRoute() {
  const { token, isAuthenticated } = useSelector((state: RootState) => state.auth);

  // ✅ בודק גם token וגם isAuthenticated
  if (!token || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
