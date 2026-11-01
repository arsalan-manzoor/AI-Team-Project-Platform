import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

import { login, logout, setAuthPortal } from "../services/authService";

import { apiRequest } from "../services/api";

import "../styles/companyLogin.css";

// ======================================================
// COMPANY DASHBOARD ROUTING
// ======================================================

function getCompanyDashboardPath(workspaceType, membershipRole) {
  const normalizedType = String(workspaceType || "")
    .trim()
    .toUpperCase();

  const normalizedRole = String(membershipRole || "")
    .trim()
    .toUpperCase();

  if (normalizedType !== "COMPANY") {
    return null;
  }

  const companyPaths = {
    ADMIN: "/dashboard/company/admin",
    HR: "/dashboard/company/hr",
    TEAM_LEADER: "/dashboard/company/team-leader",
    USER: "/dashboard/company/user",
  };

  return companyPaths[normalizedRole] || null;
}

// ======================================================
// COMPANY LOGIN
// ======================================================

function CompanyLogin() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  // Password-reset token received through the email link.
  const resetToken = searchParams.get("token") || "";

  const [view, setView] = useState(() => (resetToken ? "reset" : "login"));

  // ======================================================
  // LOGIN STATE
  // ======================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
  // CHECK INITIAL PASSWORD REQUIREMENT
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

    const loginFlag = loginFlags.find((value) => typeof value === "boolean");

    try {
      const response = await apiRequest("/auth/me");

      const currentUser = response?.user || response?.data?.user || response;

      const currentFlags = [
        currentUser?.must_change_password,
        currentUser?.mustChangePassword,
      ];

      const currentFlag = currentFlags.find(
        (value) => typeof value === "boolean",
      );

      if (typeof currentFlag === "boolean") {
        return currentFlag;
      }

      if (typeof loginFlag === "boolean") {
        return loginFlag;
      }

      throw new Error("Unable to verify your initial password requirement.");
    } catch (requestError) {
      if (typeof loginFlag === "boolean") {
        return loginFlag;
      }

      throw requestError;
    }
  }

  // ======================================================
  // REDIRECT TO INITIAL PASSWORD CHANGE
  // ======================================================

  function redirectToInitialPasswordChange() {
    localStorage.removeItem("zyra_active_workspace_id");

    sessionStorage.setItem("zyra_last_dashboard_path", "/dashboard");

    navigate("/profile?section=password", {
      replace: true,
    });
  }

  // ======================================================
  // GET WORKSPACE LIST
  // ======================================================

  async function getWorkspaceList() {
    const response = await apiRequest("/workspaces/mine");

    if (Array.isArray(response?.workspaces)) {
      return response.workspaces;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  }

  // ======================================================
  // CHECK PENDING COMPANY INVITATION
  // ======================================================

  async function hasPendingCompanyInvitation() {
    const response = await apiRequest("/workspaces/my-invitations");

    const invitations = Array.isArray(response?.invitations)
      ? response.invitations
      : [];

    return invitations.some((invitation) => {
      const workspaceType = String(
        invitation?.workspace_type || invitation?.workspace?.type || "",
      )
        .trim()
        .toUpperCase();

      return workspaceType === "COMPANY";
    });
  }

  // ======================================================
  // HANDLE COMPANY LOGIN
  // ======================================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!email.trim() || !password) {
      setError("Please enter your work email and password.");
      return;
    }

    let authenticated = false;

    try {
      setLoading(true);

      // STEP 1: AUTHENTICATE

      const loginResponse = await login(email.trim(), password);

      authenticated = true;

      setAuthPortal("COMPANY");

      // STEP 2: CHECK INITIAL PASSWORD REQUIREMENT

      const mustChangePassword =
        await checkInitialPasswordRequirement(loginResponse);

      if (mustChangePassword) {
        redirectToInitialPasswordChange();
        return;
      }

      // STEP 3: GET ACTUAL WORKSPACE MEMBERSHIPS

      const workspaces = await getWorkspaceList();

      const companyWorkspaces = workspaces
        .map((workspace) => {
          const workspaceType = workspace?.type || workspace?.workspace_type;

          const workspaceRole = workspace?.role || workspace?.workspace_role;

          return {
            ...workspace,
            dashboardPath: getCompanyDashboardPath(
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
            workspaceType === "COMPANY" && Boolean(workspace.dashboardPath)
          );
        });

      // STEP 4: NO COMPANY MEMBERSHIP

      if (companyWorkspaces.length === 0) {
        const hasCompanyInvitation = await hasPendingCompanyInvitation();

        if (hasCompanyInvitation) {
          setAuthPortal("COMPANY");

          localStorage.removeItem("zyra_active_workspace_id");

          sessionStorage.setItem("zyra_last_dashboard_path", "/dashboard");

          navigate("/dashboard", {
            replace: true,
          });

          return;
        }

        logout();
        authenticated = false;

        setError(
          "This account does not have an active Company Workspace membership or pending Company invitation. Please use Individual Sign In or contact your Company administrator.",
        );

        return;
      }

      // STEP 5: SELECT COMPANY WORKSPACE

      const savedWorkspaceId = localStorage.getItem("zyra_active_workspace_id");

      let selectedWorkspace = companyWorkspaces.find(
        (workspace) => String(workspace.id) === String(savedWorkspaceId),
      );

      if (!selectedWorkspace) {
        selectedWorkspace = companyWorkspaces[0] || null;
      }

      if (!selectedWorkspace) {
        logout();
        authenticated = false;

        setError(
          "Your Company account has no supported workspace role. Please contact your administrator.",
        );

        return;
      }

      // STEP 6: ACTIVATE COMPANY WORKSPACE

      const selectedRole =
        selectedWorkspace.role || selectedWorkspace.workspace_role;

      setAuthPortal("COMPANY");

      localStorage.setItem(
        "zyra_active_workspace_id",
        String(selectedWorkspace.id),
      );

      localStorage.setItem(
        `zyra_active_workspace_role_${selectedWorkspace.id}`,
        String(selectedRole).trim().toUpperCase(),
      );

      // STEP 7: SAVE DASHBOARD DESTINATION

      sessionStorage.setItem(
        "zyra_last_dashboard_path",
        selectedWorkspace.dashboardPath,
      );

      // STEP 8: NAVIGATE TO COMPANY ROLE DASHBOARD

      navigate(selectedWorkspace.dashboardPath, {
        replace: true,
      });
    } catch (requestError) {
      console.error("Company login error:", requestError);

      if (authenticated) {
        logout();
      }

      setError(
        requestError?.message ||
          "Unable to sign in. Please check your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // OPEN FORGOT PASSWORD
  // ======================================================

  function openForgotPassword() {
    setForgotEmail(email.trim().toLowerCase());

    setError("");
    setNotice("");
    setRecoveryMessage("");
    setRecoverySuccess(false);

    setView("forgot");
  }

  // ======================================================
  // REQUEST COMPANY PASSWORD RESET EMAIL
  // ======================================================

  async function handleForgotPassword(event) {
    event.preventDefault();

    setError("");
    setRecoveryMessage("");
    setRecoverySuccess(false);

    const cleanEmail = forgotEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your work email address.");
      return;
    }

    try {
      setRecoveryLoading(true);

      const data = await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          portal: "COMPANY",
        }),
      });

      setRecoveryMessage(
        data?.message ||
          "Password reset instructions have been sent. Please check your inbox and spam folder.",
      );

      setRecoverySuccess(true);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to process your password reset request. Please try again.",
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  // ======================================================
  // RESET COMPANY PASSWORD
  // ======================================================

  async function handleResetPassword(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!resetToken) {
      setError(
        "Your password reset link is missing its token. Please request a new reset link.",
      );

      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setError("Please complete both password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your password must contain at least 8 characters.");

      return;
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Your password must not exceed 72 bytes.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Your passwords do not match.");
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

      setNewPassword("");
      setConfirmNewPassword("");
      setPassword("");

      setEmail(forgotEmail.trim() || email);

      setNotice(
        data?.message ||
          "Your password has been reset successfully. You can now sign in.",
      );

      setError("");
      setView("login");

      // Remove the reset token from the browser URL.
      setSearchParams({}, { replace: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to reset your password. The recovery link may have expired.",
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  // ======================================================
  // RETURN TO COMPANY LOGIN
  // ======================================================

  function returnToCompanyLogin() {
    setError("");
    setRecoveryMessage("");
    setRecoverySuccess(false);

    setView("login");

    // Remove any reset token from the URL.
    setSearchParams({}, { replace: true });
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <main className="company-auth-main">
      <div className="company-auth-grid" />

      <div className="company-auth-orbit orbit-one" />
      <div className="company-auth-orbit orbit-two" />

      {/* TOP NAVIGATION */}

      <header className="company-auth-header">
        <button
          className="company-auth-brand"
          onClick={() => navigate("/company")}
          type="button"
        >
          <span className="company-brand-mark">Z</span>

          <span>
            <strong>ZYRA</strong>
            <small>INTELLIGENT WORKSPACE</small>
          </span>
        </button>

        <div className="company-auth-header-right">
          <span className="company-system-status">
            <span className="status-dot" />
            SYSTEM ONLINE
          </span>

          <button
            type="button"
            className="company-switch-link"
            onClick={() => navigate("/login")}
          >
            Individual Sign In
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}

      <section className="company-auth-content">
        {/* LEFT AUTHENTICATION PANEL */}

        <div className="company-login-panel-wrap">
          <div className="company-login-panel">
            <div className="company-panel-corner corner-tl" />
            <div className="company-panel-corner corner-tr" />
            <div className="company-panel-corner corner-bl" />
            <div className="company-panel-corner corner-br" />

            {/* AUTHENTICATION HEADING */}

            <div className="company-login-heading">
              <div className="company-auth-label">
                <ShieldCheck size={14} />

                {view === "login"
                  ? "COMPANY WORKSPACE"
                  : view === "forgot"
                    ? "ACCOUNT RECOVERY"
                    : "SECURE PASSWORD RESET"}
              </div>

              <h1>
                {view === "login"
                  ? "Welcome back."
                  : view === "forgot"
                    ? recoverySuccess
                      ? "Check your inbox."
                      : "Forgot your password?"
                    : "Create a new password."}
              </h1>

              <p>
                {view === "login"
                  ? "Sign in to your company's intelligent workspace."
                  : view === "forgot"
                    ? recoverySuccess
                      ? "If an account exists with this email address, password reset instructions will be sent. Please check your inbox and spam folder."
                      : "Enter your registered work email address. We'll send you a secure password reset link."
                    : "Choose a new password with at least 8 characters to secure your Company account."}
              </p>
            </div>

            {/* ============================================
                VIEW 1: COMPANY LOGIN
            ============================================ */}

            {view === "login" && (
              <form onSubmit={handleLogin} className="company-login-form">
                <label>
                  <span>WORK EMAIL</span>

                  <div className="company-input">
                    <Mail size={17} />

                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                      disabled={loading}
                    />
                  </div>
                </label>

                <label>
                  <span>PASSWORD</span>

                  <div className="company-input">
                    <LockKeyhole size={17} />

                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={loading}
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <div className="company-login-options">
                  <label className="remember-option">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="forgot-password"
                    onClick={openForgotPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className="company-auth-error" role="alert">
                    {error}
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    style={{
                      padding: "11px 13px",
                      border: "1px solid rgba(52, 211, 153, 0.25)",
                      borderRadius: "8px",
                      background: "rgba(16, 185, 129, 0.08)",
                      color: "#6ee7b7",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
                    {notice}
                  </div>
                )}

                <button
                  type="submit"
                  className="company-login-button"
                  disabled={loading}
                >
                  <span>{loading ? "AUTHENTICATING..." : "SIGN IN"}</span>

                  <span className="button-arrow">→</span>
                </button>

                <div className="company-divider">
                  <span />
                  <small>OR</small>
                  <span />
                </div>

                <button
                  type="button"
                  className="company-google-button"
                  onClick={() =>
                    setError(
                      "Google authentication will use the existing ZYRA Google flow.",
                    )
                  }
                  disabled={loading}
                >
                  <span className="google-symbol">G</span>
                  Continue with Google
                </button>
              </form>
            )}

            {/* ============================================
                VIEW 2: FORGOT PASSWORD
            ============================================ */}

            {view === "forgot" && (
              <>
                {recoverySuccess ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "17px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "15px",
                        border: "1px solid rgba(52, 211, 153, 0.25)",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.08)",
                        color: "#6ee7b7",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      <CheckCircle2 size={20} style={{ flexShrink: 0 }} />

                      {recoveryMessage}
                    </div>

                    <button
                      type="button"
                      className="company-login-button"
                      onClick={returnToCompanyLogin}
                    >
                      <span>BACK TO SIGN IN</span>
                      <span className="button-arrow">→</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleForgotPassword}
                    className="company-login-form"
                  >
                    <label>
                      <span>WORK EMAIL</span>

                      <div className="company-input">
                        <Mail size={17} />

                        <input
                          type="email"
                          placeholder="you@company.com"
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
                    </label>

                    {error && (
                      <div className="company-auth-error" role="alert">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="company-login-button"
                      disabled={recoveryLoading}
                    >
                      <span>
                        {recoveryLoading
                          ? "SENDING RESET LINK..."
                          : "SEND RESET LINK"}
                      </span>

                      <span className="button-arrow">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={returnToCompanyLogin}
                      disabled={recoveryLoading}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px",
                        border: "none",
                        background: "transparent",
                        color: "#a9bad0",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowLeft size={15} />
                      Back to Company Sign In
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ============================================
                VIEW 3: RESET PASSWORD
            ============================================ */}

            {view === "reset" && (
              <form
                onSubmit={handleResetPassword}
                className="company-login-form"
              >
                <label>
                  <span>NEW PASSWORD</span>

                  <div className="company-input">
                    <LockKeyhole size={17} />

                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={recoveryLoading}
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword((value) => !value)}
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
                </label>

                <label>
                  <span>CONFIRM NEW PASSWORD</span>

                  <div className="company-input">
                    <LockKeyhole size={17} />

                    <input
                      type={showConfirmNewPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      value={confirmNewPassword}
                      onChange={(event) =>
                        setConfirmNewPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      minLength={8}
                      required
                      disabled={recoveryLoading}
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowConfirmNewPassword((value) => !value)
                      }
                      aria-label={
                        showConfirmNewPassword
                          ? "Hide confirmation password"
                          : "Show confirmation password"
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
                </label>

                <p
                  style={{
                    color: "#8b98a7",
                    fontSize: "12px",
                    lineHeight: 1.6,
                    margin: "0",
                  }}
                >
                  Password must contain at least 8 characters and must not
                  exceed 72 UTF-8 bytes.
                </p>

                {error && (
                  <div className="company-auth-error" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="company-login-button"
                  disabled={recoveryLoading}
                >
                  <span>
                    {recoveryLoading
                      ? "RESETTING PASSWORD..."
                      : "RESET PASSWORD"}
                  </span>

                  <span className="button-arrow">→</span>
                </button>

                <button
                  type="button"
                  onClick={returnToCompanyLogin}
                  disabled={recoveryLoading}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "12px",
                    border: "none",
                    background: "transparent",
                    color: "#a9bad0",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={15} />
                  Back to Company Sign In
                </button>
              </form>
            )}

            {/* COMPANY SIGNUP FOOTER */}

            <div className="company-login-footer">
              <span>Need to establish a company?</span>

              <button type="button" onClick={() => navigate("/company/signup")}>
                Create Company Workspace
              </button>
            </div>

            <div className="company-secure-line">
              <LockKeyhole size={12} />
              SECURE COMPANY WORKSPACE
            </div>
          </div>
        </div>

        {/* RIGHT VISUALIZATION */}

        <div className="company-visual">
          <div className="visual-label">
            <span />
            ORGANIZATIONAL INTELLIGENCE
          </div>

          <div className="visual-title">
            <span>Your company.</span>
            <strong>Connected as one.</strong>
          </div>

          <div className="company-network">
            <div className="network-ring ring-large" />
            <div className="network-ring ring-medium" />
            <div className="network-ring ring-small" />

            <div className="network-line line-one" />
            <div className="network-line line-two" />
            <div className="network-line line-three" />
            <div className="network-line line-four" />
            <div className="network-line line-five" />
            <div className="network-line line-six" />

            <div className="network-node node-center">
              <div className="node-core">Z</div>
              <span>ZYRA AI</span>
            </div>

            <div className="network-node node-org">
              <small>01</small>
              <strong>ORGANIZATION</strong>
            </div>

            <div className="network-node node-dept">
              <small>02</small>
              <strong>DEPARTMENTS</strong>
            </div>

            <div className="network-node node-team">
              <small>03</small>
              <strong>TEAMS</strong>
            </div>

            <div className="network-node node-people">
              <small>04</small>
              <strong>PEOPLE</strong>
            </div>

            <div className="network-node node-projects">
              <small>05</small>
              <strong>PROJECTS</strong>
            </div>

            <div className="floating-data data-one">
              <span>ACTIVE PROJECTS</span>
              <strong>24</strong>
            </div>

            <div className="floating-data data-two">
              <span>CONNECTED TEAMS</span>
              <strong>08</strong>
            </div>

            <div className="floating-data data-three">
              <span>AI STATUS</span>
              <strong>ANALYZING</strong>
            </div>
          </div>

          <p className="company-visual-description">
            Projects, teams, people and organizational activity connected inside
            one intelligent workspace.
          </p>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="company-auth-bottom">
        <span>ZYRA / COMPANY ACCESS</span>

        <span>PLAN. COLLABORATE. BUILD. EVOLVE.</span>

        <span>© {new Date().getFullYear()} ZYRA</span>
      </footer>
    </main>
  );
}

export default CompanyLogin;
