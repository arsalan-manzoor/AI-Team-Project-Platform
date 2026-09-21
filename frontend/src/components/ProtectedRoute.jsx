import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser, isAuthenticated } from "../services/authService";

function ProtectedRoute() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function verifySession() {
      if (!isAuthenticated()) {
        setAuthenticated(false);
        setCheckingAuth(false);
        return;
      }

      try {
        await getCurrentUser();
        setAuthenticated(true);
      } catch (error) {
        console.error("Session verification failed:", error);
        setAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    }

    verifySession();
  }, []);

  if (checkingAuth) {
    return <p>Checking your session...</p>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
