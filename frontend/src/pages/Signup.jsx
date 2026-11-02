import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import {
  Eye,
  EyeOff,
  ArrowRight,
  Mail,
  CheckCircle2,
  FolderKanban,
  Users,
  Sparkles,
  ListChecks,
  ShieldCheck,
  UserCog,
  UserPlus,
} from "lucide-react";

import { apiRequest, setAuthToken } from "../services/api";
import { logout, setAuthPortal } from "../services/authService";

import zyraLogo from "../assets/zyra-logo.jpg";
import "../styles/signup.css";

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [verificationCode, setVerificationCode] = useState("");
  const [verificationStep, setVerificationStep] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [createdWorkspaceName, setCreatedWorkspaceName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // ======================================================
  // EMAIL SIGNUP — REQUEST VERIFICATION CODE
  // ======================================================

  async function handleSignup(event) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (cleanName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      // The backend assigns TEAM_LEADER automatically.
      // Public signup never sends a user-selected role.

      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      setEmail(cleanEmail);
      setVerificationStep(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to start signup.");
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // EMAIL VERIFICATION — CREATE INDIVIDUAL WORKSPACE
  // ======================================================

  async function handleVerification(event) {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = verificationCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);

      const data = await apiRequest("/users/verify", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          verificationCode: cleanCode,
        }),
      });

      setCreatedWorkspaceName(
        data?.workspace?.name || `${name.trim()}'s Individual Workspace`,
      );

      setAccountCreated(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to verify your email.");
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // DASHBOARD ROUTING
  // ======================================================

  function getIndividualDashboardPath(role) {
    const normalizedRole = String(role || "").trim().toUpperCase();

    const individualRoutes = {
      TEAM_LEADER: "/dashboard/individual/team-leader",
      USER: "/dashboard/individual/user",
    };

    return individualRoutes[normalizedRole] || null;
  }

  // ======================================================
  // GOOGLE SIGNUP
  //
  // authMode: SIGNUP
  //
  // 1. Verify Google identity.
  // 2. Request Individual account registration.
  // 3. Save the returned JWT.
  // 4. Verify Individual portal access.
  // 5. Retrieve actual Individual workspace membership.
  // 6. Save workspace and role.
  // 7. Navigate to the correct Individual dashboard.
  //
  // Existing accounts are handled by the backend.
  // Company accounts cannot create Individual accounts
  // through this Google signup flow.
  // ======================================================

  async function handleGoogleSuccess(credentialResponse) {
    setError("");

    const idToken = credentialResponse?.credential;

    if (!idToken) {
      setError("Google Sign-Up did not return a valid credential.");
      return;
    }

    let authenticated = false;

    try {
      setGoogleLoading(true);

      // ======================================================
      // STEP 1: REGISTER / AUTHENTICATE THROUGH GOOGLE
      // ======================================================

      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          idToken,
          workspaceType: "INDIVIDUAL",
          authMode: "SIGNUP",
        }),
      });

      if (!data?.token) {
        throw new Error(
          "Google Sign-Up did not return an authentication token.",
        );
      }

      // ======================================================
      // STEP 2: SAVE AUTHENTICATION TOKEN
      // ======================================================

      setAuthToken(data.token);
      authenticated = true;

      // Google Sign-Up belongs to the Individual portal.

      setAuthPortal("INDIVIDUAL");

      // ======================================================
      // STEP 3: VERIFY INDIVIDUAL PORTAL ACCESS
      // ======================================================

      const portalAccess = await apiRequest(
        "/workspaces/my-portal-access",
      );

      const availablePortals = Array.isArray(
        portalAccess?.available_portals,
      )
        ? portalAccess.available_portals.map((portal) =>
            String(portal).trim().toUpperCase(),
          )
        : [];

      if (!availablePortals.includes("INDIVIDUAL")) {
        throw new Error(
          "Individual Workspace access could not be verified. Please contact the administrator.",
        );
      }

      // ======================================================
      // STEP 4: CHECK INITIAL PASSWORD REQUIREMENT
      // ======================================================

      const mustChangePassword =
        portalAccess?.must_change_password === true ||
        data?.must_change_password === true ||
        data?.user?.must_change_password === true;

      if (mustChangePassword) {
        localStorage.removeItem("zyra_active_workspace_id");

        sessionStorage.setItem(
          "zyra_last_dashboard_path",
          "/dashboard",
        );

        navigate("/profile?section=password", {
          replace: true,
        });

        return;
      }

      // ======================================================
      // STEP 5: CHECK INDIVIDUAL MEMBERSHIP
      // ======================================================

      const memberships = Array.isArray(portalAccess?.memberships)
        ? portalAccess.memberships.map((type) =>
            String(type).trim().toUpperCase(),
          )
        : [];

      const hasIndividualMembership =
        memberships.includes("INDIVIDUAL");

      const pendingInvitations = Array.isArray(
        portalAccess?.pending_invitations,
      )
        ? portalAccess.pending_invitations.map((type) =>
            String(type).trim().toUpperCase(),
          )
        : [];

      const hasIndividualInvitation =
        pendingInvitations.includes("INDIVIDUAL");

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
          "Your Individual Workspace membership could not be verified.",
        );
      }

      // ======================================================
      // STEP 6: FETCH ACTUAL WORKSPACE MEMBERSHIPS
      // ======================================================

      const workspaceData = await apiRequest("/workspaces/mine");

      const workspaces = Array.isArray(workspaceData?.workspaces)
        ? workspaceData.workspaces
        : Array.isArray(workspaceData)
          ? workspaceData
          : [];

      // Individual Signup must never select a Company workspace.

      const individualWorkspaces = workspaces
        .map((workspace) => {
          const workspaceType = String(
            workspace?.type || workspace?.workspace_type || "",
          )
            .trim()
            .toUpperCase();

          const role = String(
            workspace?.role || workspace?.workspace_role || "",
          )
            .trim()
            .toUpperCase();

          return {
            ...workspace,
            normalizedType: workspaceType,
            normalizedRole: role,
            dashboardPath:
              workspaceType === "INDIVIDUAL"
                ? getIndividualDashboardPath(role)
                : null,
          };
        })
        .filter(
          (workspace) =>
            workspace.normalizedType === "INDIVIDUAL" &&
            Boolean(workspace.dashboardPath),
        );

      // ======================================================
      // STEP 7: SELECT INDIVIDUAL WORKSPACE
      // ======================================================

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
        throw new Error(
          "Your Individual Workspace was authenticated, but no supported Individual membership was found. Please contact the administrator.",
        );
      }

      // ======================================================
      // STEP 8: SAVE WORKSPACE AND ROLE
      // ======================================================

      localStorage.setItem(
        "zyra_active_workspace_id",
        String(selectedWorkspace.id),
      );

      localStorage.setItem(
        `zyra_active_workspace_role_${selectedWorkspace.id}`,
        selectedWorkspace.normalizedRole,
      );

      // ======================================================
      // STEP 9: SAVE DASHBOARD DESTINATION
      // ======================================================

      sessionStorage.setItem(
        "zyra_last_dashboard_path",
        selectedWorkspace.dashboardPath,
      );

      // ======================================================
      // STEP 10: NAVIGATE TO INDIVIDUAL DASHBOARD
      // ======================================================

      navigate(selectedWorkspace.dashboardPath, {
        replace: true,
      });
    } catch (requestError) {
      console.error(
        "Google Sign-Up or dashboard routing error:",
        requestError,
      );

      // Clear authentication if subsequent verification fails.

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
  // GOOGLE SIGNUP ERROR
  // ======================================================

  function handleGoogleError() {
    setGoogleLoading(false);

    setError(
      "Google Sign-Up was cancelled or could not be completed.",
    );
  }

  // ======================================================
  // RETURN TO SIGNUP
  // ======================================================

  function handleBackToSignup() {
    setVerificationStep(false);
    setVerificationCode("");
    setError("");
  }

  // ======================================================
  // CONTINUE TO NORMAL LOGIN AFTER EMAIL VERIFICATION
  // ======================================================

  function goToLogin() {
    navigate("/login", {
      state: {
        signupSuccess: true,
        email: email.trim().toLowerCase(),
      },
    });
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="signup-page">
      {/* BACKGROUND */}

      <div className="signup-background" aria-hidden="true">
        <div className="signup-gradient signup-gradient-one" />
        <div className="signup-gradient signup-gradient-two" />
        <div className="signup-gradient signup-gradient-three" />

        <div className="signup-grid" />

        <div className="signup-particles">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* MAIN SIGNUP LAYOUT */}

      <main className="signup-shell">
        {/* LEFT: INDIVIDUAL WORKSPACE STORY */}

        <section className="signup-visual">
          <Link to="/" className="signup-visual-brand">
            <img
              src={zyraLogo}
              alt="ZYRA"
              className="signup-visual-logo"
            />

            <div className="signup-visual-brand-text">
              <strong>ZYRA</strong>
              <span>Intelligent Project Workspace</span>
            </div>
          </Link>

          <div className="signup-visual-content">
            <div className="signup-visual-heading">
              <span className="signup-visual-eyebrow">
                YOUR INDIVIDUAL WORKSPACE
              </span>

              <h1>
                Your work.
                <br />
                <span>Your team. Your lead.</span>
              </h1>

              <p>
                Start with your own workspace. You're automatically the Team
                Leader, with the freedom to create Users and build your team as
                your work grows.
              </p>
            </div>

            <div className="signup-network">
              <div className="signup-network-glow" />

              <div className="signup-network-ring signup-network-ring-one" />
              <div className="signup-network-ring signup-network-ring-two" />
              <div className="signup-network-ring signup-network-ring-three" />

              <div className="signup-network-line signup-line-one" />
              <div className="signup-network-line signup-line-two" />
              <div className="signup-network-line signup-line-three" />
              <div className="signup-network-line signup-line-four" />
              <div className="signup-network-line signup-line-five" />
              <div className="signup-network-line signup-line-six" />

              <div className="signup-network-core">
                <div className="signup-network-core-inner">
                  <img src={zyraLogo} alt="" />
                </div>
              </div>

              <div className="signup-network-node signup-node-one">
                <Users size={22} />
              </div>

              <div className="signup-network-node signup-node-two">
                <FolderKanban size={21} />
              </div>

              <div className="signup-network-node signup-node-three">
                <ListChecks size={21} />
              </div>

              <div className="signup-network-node signup-node-four">
                <UserPlus size={21} />
              </div>

              <div className="signup-network-node signup-node-five">
                <ShieldCheck size={20} />
              </div>

              <span className="signup-network-particle particle-one" />
              <span className="signup-network-particle particle-two" />
              <span className="signup-network-particle particle-three" />
              <span className="signup-network-particle particle-four" />
              <span className="signup-network-particle particle-five" />
              <span className="signup-network-particle particle-six" />

              <div className="signup-float-card signup-float-project">
                <div className="signup-float-icon">
                  <FolderKanban size={17} />
                </div>

                <div>
                  <strong>Workspace created</strong>
                  <span>Your space, ready to go</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-team">
                <div className="signup-float-icon">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <strong>Team Leader</strong>
                  <span>You're in control</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-task">
                <div className="signup-float-icon">
                  <UserPlus size={17} />
                </div>

                <div>
                  <strong>Create Users</strong>
                  <span>Build your team when ready</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-ai">
                <div className="signup-float-icon">
                  <Sparkles size={17} />
                </div>

                <div>
                  <strong>Work smarter</strong>
                  <span>Projects, tasks and AI</span>
                </div>

                <i />
              </div>
            </div>

            <div className="signup-visual-footer">
              <div className="signup-footer-line" />

              <div>
                <strong>Start as Team Leader. Grow with ZYRA.</strong>
                <span>Your workspace grows with you.</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: SIGNUP / VERIFICATION / SUCCESS */}

        <section className="signup-auth">
          <div className="signup-card">
            <div className="signup-card-glow" />

            <div className="signup-card-brand">
              <img src={zyraLogo} alt="ZYRA" />

              <div>
                <strong>ZYRA</strong>
                <span>Intelligent Project Workspace</span>
              </div>
            </div>

            {/* VIEW 1: SIGNUP FORM */}

            {!verificationStep ? (
              <>
                <div className="signup-card-header">
                  <span className="signup-eyebrow">
                    INDIVIDUAL WORKSPACE
                  </span>

                  <h2>Create your space.</h2>

                  <p>
                    One account gives you your own workspace. ZYRA assigns you
                    the Team Leader role automatically, so you can create Users
                    after signing in.
                  </p>
                </div>

                {/* GOOGLE SIGNUP */}

                <div className="google-signup-wrapper">
                  <button
                    type="button"
                    className="google-signup-button"
                    disabled={loading || googleLoading}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <span className="google-icon">
                      <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                      />
                    </span>

                    <span>
                      {googleLoading
                        ? "Connecting to Google..."
                        : "Continue with Google"}
                    </span>
                  </button>

                  <div className="google-login-overlay">
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

                <div className="signup-divider">
                  <span>or continue with email</span>
                </div>

                {/* EMAIL SIGNUP FORM */}

                <form onSubmit={handleSignup} className="signup-form">
                  <div className="signup-field">
                    <label htmlFor="signup-name">Full Name</label>

                    <input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      disabled={loading || googleLoading}
                    />
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-email">Email Address</label>

                    <input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      disabled={loading || googleLoading}
                    />
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-password">Password</label>

                    <div className="signup-password-wrapper">
                      <input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        disabled={loading || googleLoading}
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        disabled={loading || googleLoading}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="signup-field">
                    <label htmlFor="signup-confirm-password">
                      Confirm Password
                    </label>

                    <div className="signup-password-wrapper">
                      <input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        disabled={loading || googleLoading}
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        disabled={loading || googleLoading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="signup-workflow-note">
                    <UserCog size={17} />

                    <div>
                      <strong>Your role is assigned automatically</strong>

                      <span>
                        You'll be the Team Leader. Create and manage Users
                        from inside your Individual Workspace.
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="signup-error" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="signup-submit-button"
                    disabled={loading || googleLoading}
                  >
                    <span>
                      {loading
                        ? "Sending verification..."
                        : "Send verification code"}
                    </span>

                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>

                <div className="signup-login-link">
                  <span>Already have an account?</span>
                  <Link to="/login">Sign in</Link>
                </div>
              </>
            ) : accountCreated ? (
              /* VIEW 3: SIGNUP SUCCESS */

              <>
                <div className="signup-verification-icon signup-success-icon">
                  <CheckCircle2 size={27} />
                </div>

                <div className="signup-card-header">
                  <span className="signup-eyebrow">SETUP COMPLETE</span>

                  <h2>Your workspace is ready.</h2>

                  <p>
                    Your email is verified and your Individual Workspace has
                    been created. You're its Team Leader.
                  </p>
                </div>

                <div className="signup-success-workspace">
                  <div className="signup-success-workspace-icon">
                    <FolderKanban size={20} />
                  </div>

                  <div>
                    <span>YOUR WORKSPACE</span>

                    <strong>{createdWorkspaceName}</strong>

                    <small>
                      <CheckCircle2 size={13} />
                      Team Leader access enabled
                    </small>
                  </div>
                </div>

                <div className="signup-workflow-note signup-success-note">
                  <UserPlus size={17} />

                  <div>
                    <strong>Next: create your Users</strong>

                    <span>
                      Sign in to open your workspace and add people when
                      you're ready.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="signup-submit-button signup-success-continue"
                  onClick={goToLogin}
                >
                  <span>Continue to sign in</span>
                  <ArrowRight size={18} />
                </button>
              </>
            ) : (
              /* VIEW 2: EMAIL VERIFICATION */

              <>
                <div className="signup-verification-icon">
                  <Mail size={25} />
                </div>

                <div className="signup-card-header">
                  <span className="signup-eyebrow">
                    STEP 1 OF 2 · VERIFY EMAIL
                  </span>

                  <h2>Check your inbox.</h2>

                  <p>
                    We sent a 6-digit verification code to{" "}
                    <strong>{email}</strong>. Once verified, ZYRA will create
                    your Individual Workspace and assign you as Team Leader.
                  </p>
                </div>

                <form
                  onSubmit={handleVerification}
                  className="signup-form"
                >
                  <div className="signup-field">
                    <label htmlFor="verification-code">
                      Verification Code
                    </label>

                    <input
                      id="verification-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(
                          event.target.value.replace(/\D/g, ""),
                        )
                      }
                      autoComplete="one-time-code"
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="signup-error" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="signup-submit-button"
                    disabled={loading}
                  >
                    <span>
                      {loading
                        ? "Verifying and creating workspace..."
                        : "Verify & create workspace"}
                    </span>

                    {!loading && <CheckCircle2 size={18} />}
                  </button>
                </form>

                <div className="signup-verification-note">
                  <Mail size={14} />
                  <span>The code expires in 10 minutes.</span>
                </div>

                <div className="signup-login-link">
                  <button
                    type="button"
                    onClick={handleBackToSignup}
                    disabled={loading}
                    className="signup-back-button"
                  >
                    ← Back to signup
                  </button>
                </div>
              </>
            )}

            <div className="signup-card-footer">
              <ShieldCheck size={13} />
              <span>Your account information is securely protected.</span>
            </div>
          </div>

          <p className="signup-footer">
            By creating an account, you agree to use ZYRA responsibly.
          </p>
        </section>
      </main>
    </div>
  );
}

export default Signup;