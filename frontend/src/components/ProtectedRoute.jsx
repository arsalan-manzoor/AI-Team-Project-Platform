import { useEffect, useRef, useState } from "react";

import { Navigate, Outlet, useLocation } from "react-router-dom";

import {
  getCurrentUser,
  getAuthPortal,
  isAuthenticated,
  logout,
} from "../services/authService";

import { useWorkspace } from "../context/WorkspaceContext";

// ======================================================
// DETERMINE LOGIN DESTINATION
// ======================================================

function getLoginDestination(pathname) {
  const path = String(pathname || "").toLowerCase();

  if (
    path.startsWith("/dashboard/company/") ||
    path === "/my-company" ||
    path === "/employees" ||
    path === "/company/reporting-structure"
  ) {
    return "/company/login";
  }

  if (path.startsWith("/dashboard/individual/")) {
    return "/login";
  }

  const portal = String(getAuthPortal() || "")
    .trim()
    .toUpperCase();

  if (portal === "COMPANY") {
    return "/company/login";
  }

  if (portal === "INDIVIDUAL") {
    return "/login";
  }

  return "/";
}

// ======================================================
// PROTECTED ROUTE
// ======================================================

function ProtectedRoute() {
  const location = useLocation();

  const { refreshWorkspaces } = useWorkspace();

  const [retryCount, setRetryCount] = useState(0);

  // This flag ensures workspace refresh happens only
  // when the user explicitly clicks Retry.
  const refreshWorkspaceOnRetry = useRef(false);

  const [session, setSession] = useState({
    verifiedPath: null,
    checkingAuth: true,
    authenticated: false,
    mustChangePassword: false,
    verificationError: false,
    redirectTo: "/",
  });

  // ======================================================
  // VERIFY AUTHENTICATION SESSION
  // ======================================================

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const currentPath = location.pathname;

      const loginDestination = getLoginDestination(currentPath);

      const shouldRefreshWorkspace = refreshWorkspaceOnRetry.current;

      refreshWorkspaceOnRetry.current = false;

      setSession((previous) => ({
        ...previous,
        verifiedPath: null,
        checkingAuth: true,
        verificationError: false,
      }));

      // --------------------------------------------------
      // STEP 1: CHECK TOKEN
      // --------------------------------------------------

      if (!isAuthenticated()) {
        if (!cancelled) {
          setSession({
            verifiedPath: currentPath,
            checkingAuth: false,
            authenticated: false,
            mustChangePassword: false,
            verificationError: false,
            redirectTo: loginDestination,
          });
        }

        return;
      }

      try {
        // ------------------------------------------------
        // STEP 2: VERIFY AUTHENTICATION WITH BACKEND
        // ------------------------------------------------

        const response = await getCurrentUser();

        const currentUser =
          response?.user || response?.data?.user || response?.data || response;

        if (cancelled) {
          return;
        }

        // ------------------------------------------------
        // STEP 3: RESTORE WORKSPACE AFTER RETRY
        // ------------------------------------------------

        if (shouldRefreshWorkspace) {
          const workspaceRestored = await refreshWorkspaces();

          if (cancelled) {
            return;
          }

          if (!workspaceRestored) {
            throw new Error(
              "Unable to restore workspace information. Please retry.",
            );
          }
        }

        // ------------------------------------------------
        // STEP 4: SAVE VERIFIED SESSION
        // ------------------------------------------------

        setSession({
          verifiedPath: currentPath,
          checkingAuth: false,
          authenticated: true,

          mustChangePassword:
            currentUser?.must_change_password === true ||
            currentUser?.mustChangePassword === true,

          verificationError: false,
          redirectTo: loginDestination,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Session verification failed:", error.message);

        // ------------------------------------------------
        // STEP 5: HANDLE INVALID AUTHENTICATION
        // ------------------------------------------------

        if (error?.status === 401) {
          logout();

          setSession({
            verifiedPath: currentPath,
            checkingAuth: false,
            authenticated: false,
            mustChangePassword: false,
            verificationError: false,
            redirectTo: loginDestination,
          });

          return;
        }

        // ------------------------------------------------
        // STEP 6: HANDLE OTHER FAILURES
        // ------------------------------------------------

        // Preserve the authentication token.
        // Do not render the protected page until
        // authentication and workspace recovery succeed.

        setSession({
          verifiedPath: currentPath,
          checkingAuth: false,
          authenticated: false,
          mustChangePassword: false,
          verificationError: true,
          redirectTo: loginDestination,
        });
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, retryCount, refreshWorkspaces]);

  // ======================================================
  // STEP 7: WAIT FOR VERIFICATION
  // ======================================================

  if (session.checkingAuth || session.verifiedPath !== location.pathname) {
    return <p>Checking your session...</p>;
  }

  // ======================================================
  // STEP 8: DISPLAY RECOVERY SCREEN
  // ======================================================

  if (session.verificationError) {
    return (
      <div
        role="alert"
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          textAlign: "center",
          color: "#e2e8f0",
          background: "#080b0f",
          gap: "14px",
        }}
      >
        <h2>Unable to restore your session</h2>

        <p style={{ color: "#94a3b8" }}>
          Please check your internet connection or try again. Your saved login
          session has not been cleared.
        </p>

        <button
          type="button"
          onClick={() => {
            refreshWorkspaceOnRetry.current = true;
            setRetryCount((count) => count + 1);
          }}
          style={{
            padding: "11px 22px",
            border: "none",
            borderRadius: "8px",
            background: "#6366f1",
            color: "#ffffff",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ======================================================
  // STEP 9: REJECT UNAUTHENTICATED USERS
  // ======================================================

  if (!session.authenticated) {
    return <Navigate to={session.redirectTo} replace />;
  }

  // ======================================================
  // STEP 10: ENFORCE INITIAL PASSWORD CHANGE
  // ======================================================

  if (session.mustChangePassword && location.pathname !== "/profile") {
    return <Navigate to="/profile?section=password" replace />;
  }

  // ======================================================
  // STEP 11: ALLOW VERIFIED SESSION
  // ======================================================

  return <Outlet />;
}

export default ProtectedRoute;
