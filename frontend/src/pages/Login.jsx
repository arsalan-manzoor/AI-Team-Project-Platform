import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  FolderKanban,
  CheckCircle2,
  Activity,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { login, logout, setAuthPortal } from "../services/authService";

import { apiRequest, setAuthToken } from "../services/api";

import zyraLogo from "../assets/zyra-logo.jpg";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ======================================================
  // LOGIN / FORGOT PASSWORD / RESET PASSWORD
  // ======================================================

  const resetToken = searchParams.get("token") || "";
  const invitationEmail = searchParams.get("email") || "";
  const invitationPortal = (searchParams.get("portal") || "").toLowerCase();

  const [view, setView] = useState(() => (resetToken ? "reset" : "login"));

  // ======================================================
  // LOGIN STATE
  // ======================================================

  const [email, setEmail] = useState(() => invitationEmail.trim());
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ======================================================
  // PASSWORD RECOVERY STATE
  // ======================================================

  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  // ======================================================
  // SHARED MESSAGES
  // ======================================================

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ======================================================
  // LOGIN INPUT BEHAVIOR
  // ======================================================

  const [isReadOnly, setIsReadOnly] = useState(
    () => !invitationEmail.trim(),
  );

  useEffect(() => {
    const invitedEmail = searchParams.get("email");

    if (invitedEmail && invitedEmail.trim()) {
      setEmail(invitedEmail.trim());
      setIsReadOnly(false);
    }
  }, [searchParams]);

  function unlockFields() {
    if (isReadOnly) {
      setIsReadOnly(false);
    }
  }

  // ======================================================
  // CHANGE SCREEN
  // ======================================================

  function changeView(nextView) {
    setError("");
    setNotice("");
    setRecoveryMessage("");
    setRecoverySuccess(false);

    setView(nextView);

    if (nextView === "login") {
      setSearchParams({}, { replace: true });
    }
  }

  // ======================================================
  // DASHBOARD ROUTING HELPERS
  // ======================================================

  function getRoleDashboardPath(workspaceType, membershipRole) {
    const normalizedWorkspaceType = String(workspaceType || "")
      .trim()
      .toUpperCase();

    const normalizedRole = String(membershipRole || "")
      .trim()
      .toUpperCase();

    if (normalizedWorkspaceType === "INDIVIDUAL") {
      const individualPaths = {
        TEAM_LEADER: "/dashboard/individual/team-leader",
        USER: "/dashboard/individual/user",
      };

      return individualPaths[normalizedRole] || null;
    }

    if (normalizedWorkspaceType === "COMPANY") {
      const companyPaths = {
        ADMIN: "/dashboard/company/admin",
        HR: "/dashboard/company/hr",
        TEAM_LEADER: "/dashboard/company/team-leader",
        USER: "/dashboard/company/user",
      };

      return companyPaths[normalizedRole] || null;
    }

    return null;
  }

  // ======================================================
  // INITIAL PASSWORD VERIFICATION
  //
  // IMPORTANT:
  //
  // This must happen immediately after authentication.
  // Do not call workspace-access features before this check.
  // ======================================================

  async function checkInitialPasswordRequirement(loginResponse) {
    const loginFlags = [
      loginResponse?.must_change_password,
      loginResponse?.mustChangePassword,
      loginResponse?.user?.must_change_password,
      loginResponse?.user?.mustChangePassword,
      loginResponse?.data?.user?.must_change_password,
      loginResponse?.data?.user?.mustChangePassword,
    ];

    const loginFlag = loginFlags.find(
      (value) => typeof value === "boolean",
    );

    try {
      // Retrieve the latest account state directly.
      // This endpoint must remain accessible to authenticated
      // users who are required to change their initial password.

      const response = await apiRequest("/auth/me");

      const currentUser =
        response?.user ||
        response?.data?.user ||
        response;

      const currentFlags = [
        currentUser?.must_change_password,
        currentUser?.mustChangePassword,
      ];

      const currentFlag = currentFlags.find(
        (value) => typeof value === "boolean",
      );

      // The current database state is authoritative.
      if (typeof currentFlag === "boolean") {
        return currentFlag;
      }

      // Use login response as a fallback if the profile
      // response does not contain the password flag.
      if (typeof loginFlag === "boolean") {
        return loginFlag;
      }

      throw new Error(
        "Unable to verify your initial password requirement.",
      );
    } catch (requestError) {
      // If /auth/me is temporarily unavailable but the login
      // endpoint provided the password flag, use that result.
      if (typeof loginFlag === "boolean") {
        return loginFlag;
      }

      throw requestError;
    }
  }

  // ======================================================
  // MANDATORY PASSWORD REDIRECTION
  // ======================================================

  function redirectToInitialPasswordChange() {
    // Do not retain an old workspace selection.
    localStorage.removeItem("zyra_active_workspace_id");

    // After changing the password, the member should first
    // enter the general dashboard.
    sessionStorage.setItem(
      "zyra_last_dashboard_path",
      "/dashboard",
    );

    navigate("/profile?section=password", {
      replace: true,
    });
  }

  // ======================================================
  // COMPLETE INDIVIDUAL AUTHENTICATION
  //
  // Used by Google Sign-In.
  //
  // IMPORTANT:
  // Initial-password verification happens BEFORE
  // portal-access and workspace-membership requests.
  // ======================================================

  async function completeIndividualAuthentication(loginResponse) {
    // ------------------------------------------------------
    // STEP 1: CHECK INITIAL PASSWORD REQUIREMENT
    // ------------------------------------------------------

    const mustChangePassword =
      await checkInitialPasswordRequirement(loginResponse);

    if (mustChangePassword) {
      redirectToInitialPasswordChange();
      return;
    }

    // ------------------------------------------------------
    // STEP 2: VERIFY INDIVIDUAL PORTAL ACCESS
    // ------------------------------------------------------

    const portalAccess = await apiRequest(
      "/workspaces/my-portal-access",
    );

    // Additional safety check.
    if (portalAccess?.must_change_password === true) {
      redirectToInitialPasswordChange();
      return;
    }

    const availablePortals = Array.isArray(
      portalAccess?.available_portals,
    )
      ? portalAccess.available_portals.map((portal) =>
          String(portal).trim().toUpperCase(),
        )
      : [];

    if (!availablePortals.includes("INDIVIDUAL")) {
      throw new Error(
        "This account does not have Individual Workspace access. Please use Company Sign In.",
      );
    }

    setAuthPortal("INDIVIDUAL");

    // ------------------------------------------------------
    // STEP 3: CHECK MEMBERSHIPS AND INVITATIONS
    // ------------------------------------------------------

    const memberships = Array.isArray(portalAccess?.memberships)
      ? portalAccess.memberships.map((type) =>
          String(type).trim().toUpperCase(),
        )
      : [];

    const pendingInvitations = Array.isArray(
      portalAccess?.pending_invitations,
    )
      ? portalAccess.pending_invitations.map((type) =>
          String(type).trim().toUpperCase(),
        )
      : [];

    const hasIndividualMembership =
      memberships.includes("INDIVIDUAL");

    const hasIndividualInvitation =
      pendingInvitations.includes("INDIVIDUAL");

    // A pending invitation does not mean the user
    // already has an active workspace membership.

    if (!hasIndividualMembership && hasIndividualInvitation) {
      localStorage.removeItem("zyra_active_workspace_id");

      sessionStorage.setItem(
        "zyra_last_dashboard_path",
        "/dashboard",
      );

      navigate("/dashboard", {
        replace: true,
      });

      return;
    }

    if (!hasIndividualMembership) {
      throw new Error(
        "Your Individual workspace membership or invitation could not be verified. Please contact your workspace administrator.",
      );
    }

    // ------------------------------------------------------
    // STEP 4: RETRIEVE ACTUAL WORKSPACE MEMBERSHIPS
    // ------------------------------------------------------

    const workspaceResponse = await apiRequest("/workspaces/mine");

    const workspaces = Array.isArray(workspaceResponse?.workspaces)
      ? workspaceResponse.workspaces
      : Array.isArray(workspaceResponse)
        ? workspaceResponse
        : [];

    // Only Individual workspaces are eligible here.

    const individualWorkspaces = workspaces
      .map((workspace) => {
        const workspaceType =
          workspace?.type || workspace?.workspace_type;

        const workspaceRole =
          workspace?.role || workspace?.workspace_role;

        return {
          ...workspace,
          dashboardPath: getRoleDashboardPath(
            workspaceType,
            workspaceRole,
          ),
        };
      })
      .filter((workspace) => {
        const workspaceType = String(
          workspace?.type || workspace?.workspace_type || "",
        )
          .trim()
          .toUpperCase();

        return (
          workspaceType === "INDIVIDUAL" &&
          Boolean(workspace.dashboardPath)
        );
      });

    // ------------------------------------------------------
    // STEP 5: SELECT THE CORRECT INDIVIDUAL WORKSPACE
    // ------------------------------------------------------

    const savedWorkspaceId = localStorage.getItem(
      "zyra_active_workspace_id",
    );

    let selectedWorkspace = individualWorkspaces.find(
      (workspace) =>
        String(workspace.id) === String(savedWorkspaceId),
    );

    if (!selectedWorkspace) {
      selectedWorkspace = individualWorkspaces[0] || null;
    }

    // ------------------------------------------------------
    // STEP 6: VALIDATE WORKSPACE ROLE
    // ------------------------------------------------------

    if (!selectedWorkspace) {
      throw new Error(
        "Your Individual workspace membership has no supported role. Please contact your workspace administrator.",
      );
    }

    // ------------------------------------------------------
    // STEP 7: ACTIVATE SELECTED WORKSPACE
    // ------------------------------------------------------

    const selectedRole =
      selectedWorkspace.role || selectedWorkspace.workspace_role;

    localStorage.setItem(
      "zyra_active_workspace_id",
      String(selectedWorkspace.id),
    );

    localStorage.setItem(
      `zyra_active_workspace_role_${selectedWorkspace.id}`,
      String(selectedRole).trim().toUpperCase(),
    );

    // ------------------------------------------------------
    // STEP 8: SAVE DASHBOARD DESTINATION
    // ------------------------------------------------------

    sessionStorage.setItem(
      "zyra_last_dashboard_path",
      selectedWorkspace.dashboardPath,
    );

    // ------------------------------------------------------
    // STEP 9: NAVIGATE TO ROLE-BASED DASHBOARD
    // ------------------------------------------------------

    navigate(selectedWorkspace.dashboardPath, {
      replace: true,
    });
  }

  // ======================================================
  // EMAIL + PASSWORD LOGIN
  // ======================================================

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    let authenticated = false;

    try {
      setLoading(true);

      // ----------------------------------------------------
      // STEP 1: AUTHENTICATE
      // ----------------------------------------------------

      const loginResponse = await login(email.trim(), password);

      authenticated = true;

      setAuthPortal("INDIVIDUAL");

      // ----------------------------------------------------
      // STEP 2: CHECK INITIAL PASSWORD FIRST
      //
      // This is deliberately before portal-access.
      // ----------------------------------------------------

      const mustChangePassword =
        await checkInitialPasswordRequirement(loginResponse);

      if (mustChangePassword) {
        redirectToInitialPasswordChange();
        return;
      }

      // ----------------------------------------------------
      // STEP 3: CHECK INDIVIDUAL PORTAL ACCESS
      // ----------------------------------------------------

      const portalAccess = await apiRequest(
        "/workspaces/my-portal-access",
      );

      // Additional safety check.
      if (portalAccess?.must_change_password === true) {
        redirectToInitialPasswordChange();
        return;
      }

      const availablePortals = Array.isArray(
        portalAccess?.available_portals,
      )
        ? portalAccess.available_portals.map((portal) =>
            String(portal).trim().toUpperCase(),
          )
        : [];

      if (!availablePortals.includes("INDIVIDUAL")) {
        logout();
        authenticated = false;

        setError(
          "This account does not have Individual Workspace access. Please use Company Sign In.",
        );

        return;
      }

      // ----------------------------------------------------
      // STEP 4: CHECK MEMBERSHIPS AND INVITATIONS
      // ----------------------------------------------------

      const memberships = Array.isArray(portalAccess?.memberships)
        ? portalAccess.memberships.map((type) =>
            String(type).trim().toUpperCase(),
          )
        : [];

      const pendingInvitations = Array.isArray(
        portalAccess?.pending_invitations,
      )
        ? portalAccess.pending_invitations.map((type) =>
            String(type).trim().toUpperCase(),
          )
        : [];

      const hasIndividualMembership =
        memberships.includes("INDIVIDUAL");

      const hasIndividualInvitation =
        pendingInvitations.includes("INDIVIDUAL");

      // ----------------------------------------------------
      // STEP 5: PENDING INVITATION WITHOUT MEMBERSHIP
      //
      // The user must land on the general dashboard.
      // They must explicitly accept the invitation.
      // ----------------------------------------------------

      if (!hasIndividualMembership && hasIndividualInvitation) {
        localStorage.removeItem("zyra_active_workspace_id");

        sessionStorage.setItem(
          "zyra_last_dashboard_path",
          "/dashboard",
        );

        navigate("/dashboard", {
          replace: true,
        });

        return;
      }

      if (!hasIndividualMembership) {
        logout();
        authenticated = false;

        setError(
          "Your Individual workspace membership or invitation could not be verified. Please contact your workspace administrator.",
        );

        return;
      }

      // ----------------------------------------------------
      // STEP 6: RETRIEVE WORKSPACE MEMBERSHIPS
      // ----------------------------------------------------

      const workspaceResponse = await apiRequest("/workspaces/mine");

      const workspaces = Array.isArray(workspaceResponse?.workspaces)
        ? workspaceResponse.workspaces
        : Array.isArray(workspaceResponse)
          ? workspaceResponse
          : [];

      const individualWorkspaces = workspaces
        .map((workspace) => {
          const workspaceType =
            workspace?.type || workspace?.workspace_type;

          const workspaceRole =
            workspace?.role || workspace?.workspace_role;

          return {
            ...workspace,
            dashboardPath: getRoleDashboardPath(
              workspaceType,
              workspaceRole,
            ),
          };
        })
        .filter((workspace) => {
          const workspaceType = String(
            workspace?.type || workspace?.workspace_type || "",
          )
            .trim()
            .toUpperCase();

          return (
            workspaceType === "INDIVIDUAL" &&
            Boolean(workspace.dashboardPath)
          );
        });

      // ----------------------------------------------------
      // STEP 7: SELECT ACTIVE INDIVIDUAL WORKSPACE
      // ----------------------------------------------------

      const savedWorkspaceId = localStorage.getItem(
        "zyra_active_workspace_id",
      );

      let selectedWorkspace = individualWorkspaces.find(
        (workspace) =>
          String(workspace.id) === String(savedWorkspaceId),
      );

      if (!selectedWorkspace) {
        selectedWorkspace = individualWorkspaces[0] || null;
      }

      if (!selectedWorkspace) {
        logout();
        authenticated = false;

        setError(
          "Your Individual workspace membership has no supported role. Please contact your workspace administrator.",
        );

        return;
      }

      // ----------------------------------------------------
      // STEP 8: SAVE ACTIVE WORKSPACE AND ROLE
      // ----------------------------------------------------

      const selectedRole =
        selectedWorkspace.role || selectedWorkspace.workspace_role;

      localStorage.setItem(
        "zyra_active_workspace_id",
        String(selectedWorkspace.id),
      );

      localStorage.setItem(
        `zyra_active_workspace_role_${selectedWorkspace.id}`,
        String(selectedRole).trim().toUpperCase(),
      );

      // ----------------------------------------------------
      // STEP 9: SAVE DASHBOARD DESTINATION
      // ----------------------------------------------------

      sessionStorage.setItem(
        "zyra_last_dashboard_path",
        selectedWorkspace.dashboardPath,
      );

      // ----------------------------------------------------
      // STEP 10: NAVIGATE TO ROLE-BASED DASHBOARD
      // ----------------------------------------------------

      navigate(selectedWorkspace.dashboardPath, {
        replace: true,
      });
    } catch (requestError) {
      console.error("Individual login error:", requestError);

      if (authenticated) {
        logout();
      }

      setError(
        requestError.message ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // GOOGLE SIGN-IN
  //
  // Existing ZYRA accounts only.
  // ======================================================

  async function handleGoogleSuccess(credentialResponse) {
    setError("");
    setNotice("");

    const idToken = credentialResponse?.credential;

    if (!idToken) {
      setError("Google Sign-In did not return a valid credential.");
      return;
    }

    let authenticated = false;

    try {
      setGoogleLoading(true);

      // STEP 1: Authenticate an existing ZYRA account.

      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          idToken,
          workspaceType: "INDIVIDUAL",
          authMode: "LOGIN",
        }),
      });

      if (!data?.token) {
        throw new Error("Google Sign-In did not return a login token.");
      }

      // STEP 2: Save JWT before authenticated API calls.

      setAuthToken(data.token);
      authenticated = true;

      // STEP 3: Use the same initial-password and
      // Individual portal workflow as normal login.

      await completeIndividualAuthentication(data);
    } catch (requestError) {
      console.error("Individual Google Sign-In error:", requestError);

      if (authenticated) {
        logout();
      }

      setError(
        requestError.message ||
          "Unable to continue with Google. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  // ======================================================
  // GOOGLE SIGN-IN ERROR
  // ======================================================

  function handleGoogleError() {
    setGoogleLoading(false);

    setError("Google Sign-In was cancelled or could not be completed.");
  }

  // ======================================================
  // REQUEST PASSWORD RESET EMAIL
  // ======================================================

  async function handleForgotPassword(event) {
    event.preventDefault();

    setError("");
    setRecoveryMessage("");

    const cleanEmail = forgotEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setRecoveryLoading(true);

      const data = await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
        }),
      });

      setRecoveryMessage(
        data?.message ||
          "If an active ZYRA account exists for that email, password reset instructions will be sent.",
      );

      setRecoverySuccess(true);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to process your request. Please try again.",
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  // ======================================================
  // RESET PASSWORD
  // ======================================================

  async function handleResetPassword(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!resetToken) {
      setError(
        "Your recovery link is missing its token. Please request a new recovery link.",
      );

      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setError("Please complete both password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Your password must not exceed 72 bytes.");
      return;
    }

    try {
      setRecoveryLoading(true);

      const data = await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken,
          password: newPassword,
        }),
      });

      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setEmail(forgotEmail.trim() || email);

      setNotice(
        data?.message ||
          "Your password has been reset successfully. You can now sign in.",
      );

      setView("login");
      setSearchParams({}, { replace: true });
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to reset your password. The recovery link may have expired.",
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="zyra-auth-page zyra-login-page">
      {/* BACKGROUND */}

      <div className="auth-background" aria-hidden="true">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-glow auth-glow-three" />

        <div className="auth-grid" />

        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />

        <div className="auth-curve auth-curve-one" />
        <div className="auth-curve auth-curve-two" />

        <div className="auth-desk">
          <div className="auth-laptop">
            <div className="auth-laptop-screen">
              <div className="mini-screen-line wide" />
              <div className="mini-screen-line" />
              <div className="mini-screen-line short" />

              <div className="mini-screen-chart">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="auth-laptop-base" />
          </div>

          <div className="auth-mug" />
          <div className="auth-desk-line" />
        </div>

        <div className="auth-plant">
          <div className="plant-leaf leaf-one" />
          <div className="plant-leaf leaf-two" />
          <div className="plant-leaf leaf-three" />
          <div className="plant-leaf leaf-four" />
          <div className="plant-pot" />
        </div>
      </div>

      {/* MAIN */}

      <main className="auth-shell">
        {/* LEFT VISUAL SIDE */}

        <section className="auth-visual">
          <Link to="/" className="auth-brand">
            <img src={zyraLogo} alt="ZYRA" />

            <div>
              <strong>ZYRA</strong>
              <span>INDIVIDUAL WORKSPACE</span>
            </div>
          </Link>

          <div className="auth-top-link">
            <span>New here?</span>

            <Link to="/signup">
              Create account
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="auth-visual-content">
            <span className="auth-eyebrow">
              YOUR PERSONAL AI WORKSPACE
            </span>

            <h1>
              Turn your ideas
              <br />
              into real <span>progress.</span>
            </h1>

            <p className="auth-description">
              Manage your projects, stay on top of tasks, track your activity
              and get AI assistance — all in one intelligent workspace.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <FolderKanban size={18} />
                </div>

                <div>
                  <strong>Projects</strong>
                  <span>Organize your goals</span>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <CheckCircle2 size={18} />
                </div>

                <div>
                  <strong>Tasks</strong>
                  <span>Stay focused</span>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Activity size={18} />
                </div>

                <div>
                  <strong>Activity</strong>
                  <span>Track your progress</span>
                </div>
              </div>

              <div className="auth-feature">
                <div className="auth-feature-icon">
                  <Sparkles size={18} />
                </div>

                <div>
                  <strong>AI Assistant</strong>
                  <span>Get help, faster</span>
                </div>
              </div>
            </div>

            <div className="auth-handwritten">
              Build
              <br />
              your tomorrow
              <span />
            </div>
          </div>

          <div className="auth-visual-footer">
            <span>IDEAS</span>
            <b>→</b>
            <span>PLANS</span>
            <b>→</b>
            <span>ACTIONS</span>
            <b>→</b>
            <span>RESULTS</span>
          </div>
        </section>

        {/* RIGHT CARD */}

        <section className="auth-form-side">
          <div className="login-card">
            <div className="login-card-glow" />

            {/* ==============================================
                VIEW 1: LOGIN
            ============================================== */}

            {view === "login" && (
              <>
                <div className="login-card-header">
                  <span className="login-eyebrow">WELCOME BACK</span>

                  <h2>Welcome back</h2>

                  <p>Sign in to your individual workspace.</p>
                </div>

                {invitationPortal === "individual" && invitationEmail && (
                  <div
                    role="status"
                    style={{
                      marginBottom: 16,
                      padding: "11px 13px",
                      borderRadius: 10,
                      border: "1px solid rgba(80, 210, 230, 0.2)",
                      background: "rgba(48, 190, 216, 0.06)",
                      color: "#a9dce5",
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    You have been invited to an Individual workspace. Sign in
                    with the temporary credentials sent to your email.
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    style={{
                      marginBottom: 18,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(69, 220, 166, 0.28)",
                      background: "rgba(48, 199, 143, 0.08)",
                      color: "#a5f0d2",
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    <CheckCircle2
                      size={15}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 7,
                      }}
                    />

                    {notice}
                  </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                  <div className="login-field">
                    <label htmlFor="login-email">Email Address</label>

                    <div className="login-input-wrapper">
                      <Mail size={17} />

                      <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        readOnly={isReadOnly}
                        onMouseEnter={unlockFields}
                        onTouchStart={unlockFields}
                        onFocus={unlockFields}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        disabled={loading || googleLoading}
                      />
                    </div>
                  </div>

                  <div className="login-field">
                    <label htmlFor="login-password">Password</label>

                    <div className="login-input-wrapper">
                      <Lock size={17} />

                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        readOnly={isReadOnly}
                        onMouseEnter={unlockFields}
                        onTouchStart={unlockFields}
                        onFocus={unlockFields}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        disabled={loading || googleLoading}
                      />

                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() =>
                          setShowPassword((value) => !value)
                        }
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        disabled={loading || googleLoading}
                      >
                        {showPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="login-options">
                    <label className="remember-option">
                      <input type="checkbox" />
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="forgot-password"
                      onClick={() => {
                        setForgotEmail(email.trim().toLowerCase());

                        setError("");
                        setNotice("");
                        setRecoverySuccess(false);
                        setRecoveryMessage("");
                        setView("forgot");
                      }}
                      disabled={loading || googleLoading}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="login-error" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="login-submit"
                    disabled={loading || googleLoading}
                  >
                    <span>{loading ? "Signing in..." : "Sign In"}</span>

                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>

                <div className="login-divider">
                  <span />
                  <b>OR</b>
                  <span />
                </div>

                {/* GOOGLE SIGN-IN */}

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                  }}
                >
                  <button
                    type="button"
                    className="login-google"
                    disabled={loading || googleLoading}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <span className="google-icon">
                      <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        style={{
                          width: 15,
                          height: 15,
                          display: "block",
                          objectFit: "contain",
                        }}
                      />
                    </span>

                    <span>
                      {googleLoading
                        ? "Connecting to Google..."
                        : "Continue with Google"}
                    </span>
                  </button>

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 5,
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      overflow: "hidden",
                      opacity: 0.01,
                      pointerEvents:
                        loading || googleLoading ? "none" : "auto",
                    }}
                  >
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="filled_black"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width="100%"
                    />
                  </div>
                </div>

                <div className="login-signup-link">
                  <span>Don't have an account?</span>
                  <Link to="/signup">Sign up</Link>
                </div>

                <div className="login-security">
                  <span className="security-dot" />
                  <span>SECURE INDIVIDUAL WORKSPACE</span>
                </div>
              </>
            )}

            {/* ==============================================
                VIEW 2: FORGOT PASSWORD
            ============================================== */}

            {view === "forgot" && (
              <>
                <div
                  style={{
                    width: 49,
                    height: 49,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 23,
                    color: "#65dce8",
                    border: "1px solid rgba(80, 210, 230, 0.24)",
                    borderRadius: 14,
                    background: "rgba(48, 190, 216, 0.09)",
                  }}
                >
                  {recoverySuccess ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <Mail size={24} />
                  )}
                </div>

                <div className="login-card-header">
                  <span className="login-eyebrow">ACCOUNT RECOVERY</span>

                  <h2>
                    {recoverySuccess
                      ? "Check your inbox."
                      : "Forgot your password?"}
                  </h2>

                  <p>
                    {recoverySuccess
                      ? "If an active ZYRA account exists for that email, password reset instructions will be sent. Check your inbox and spam folder."
                      : "Enter your registered email address. We'll send you a secure link to choose a new password."}
                  </p>
                </div>

                {!recoverySuccess ? (
                  <form onSubmit={handleForgotPassword} className="login-form">
                    <div className="login-field">
                      <label htmlFor="forgot-email">Email Address</label>

                      <div className="login-input-wrapper">
                        <Mail size={17} />

                        <input
                          id="forgot-email"
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={(event) =>
                            setForgotEmail(event.target.value)
                          }
                          autoComplete="email"
                          autoFocus
                          required
                          disabled={recoveryLoading}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="login-error" role="alert">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="login-submit"
                      disabled={recoveryLoading}
                    >
                      <span>
                        {recoveryLoading
                          ? "Sending recovery link..."
                          : "Send recovery link"}
                      </span>

                      {!recoveryLoading && <ArrowRight size={18} />}
                    </button>
                  </form>
                ) : (
                  <div
                    role="status"
                    style={{
                      marginTop: 18,
                      padding: 14,
                      border: "1px solid rgba(69, 220, 166, 0.25)",
                      borderRadius: 10,
                      background: "rgba(48, 199, 143, 0.07)",
                      color: "#a5f0d2",
                      fontSize: 12,
                      lineHeight: 1.8,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <CheckCircle2
                      size={16}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                        marginRight: 7,
                      }}
                    />

                    {recoveryMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => changeView("login")}
                  disabled={recoveryLoading}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 9,
                    marginTop: 25,
                    padding: 10,
                    border: "none",
                    background: "transparent",
                    color: "#a9bad0",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </button>

                {recoverySuccess && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecoverySuccess(false);
                      setRecoveryMessage("");
                      setError("");
                    }}
                    style={{
                      width: "100%",
                      marginTop: 5,
                      padding: 8,
                      border: "none",
                      background: "transparent",
                      color: "#65dce8",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Try another email address
                  </button>
                )}

                <div className="login-security">
                  <ShieldCheck size={13} />
                  <span>RECOVERY LINKS EXPIRE AFTER 20 MINUTES</span>
                </div>
              </>
            )}

            {/* ==============================================
                VIEW 3: RESET PASSWORD
            ============================================== */}

            {view === "reset" && (
              <>
                <div
                  style={{
                    width: 49,
                    height: 49,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 23,
                    color: "#65dce8",
                    border: "1px solid rgba(80, 210, 230, 0.24)",
                    borderRadius: 14,
                    background: "rgba(48, 190, 216, 0.09)",
                  }}
                >
                  <ShieldCheck size={24} />
                </div>

                <div className="login-card-header">
                  <span className="login-eyebrow">
                    SECURE ACCOUNT RECOVERY
                  </span>

                  <h2>Create a new password.</h2>

                  <p>
                    Choose a new password with at least 8 characters. You can
                    use it the next time you sign in.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="login-form">
                  <div className="login-field">
                    <label htmlFor="new-password">New Password</label>

                    <div className="login-input-wrapper">
                      <Lock size={17} />

                      <input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        required
                        minLength={8}
                        disabled={recoveryLoading}
                      />

                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() =>
                          setShowNewPassword((value) => !value)
                        }
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                        disabled={recoveryLoading}
                      >
                        {showNewPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="login-field">
                    <label htmlFor="confirm-new-password">
                      Confirm New Password
                    </label>

                    <div className="login-input-wrapper">
                      <Lock size={17} />

                      <input
                        id="confirm-new-password"
                        type={
                          showConfirmNewPassword ? "text" : "password"
                        }
                        placeholder="Confirm your new password"
                        value={confirmNewPassword}
                        onChange={(event) =>
                          setConfirmNewPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        required
                        minLength={8}
                        disabled={recoveryLoading}
                      />

                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() =>
                          setShowConfirmNewPassword((value) => !value)
                        }
                        aria-label={
                          showConfirmNewPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        disabled={recoveryLoading}
                      >
                        {showConfirmNewPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="login-error" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="login-submit"
                    disabled={recoveryLoading || !resetToken}
                  >
                    <span>
                      {recoveryLoading
                        ? "Updating password..."
                        : "Reset Password"}
                    </span>

                    {!recoveryLoading && <ArrowRight size={18} />}
                  </button>
                </form>

                {!resetToken && (
                  <div className="login-error" role="alert">
                    Your recovery link is missing its token. Please request a
                    new password reset link.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => changeView("forgot")}
                  disabled={recoveryLoading}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 18,
                    padding: 10,
                    border: "none",
                    background: "transparent",
                    color: "#a9bad0",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={15} />
                  Request a new recovery link
                </button>

                <div className="login-security">
                  <ShieldCheck size={13} />
                  <span>YOUR PASSWORD IS SECURELY ENCRYPTED</span>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;