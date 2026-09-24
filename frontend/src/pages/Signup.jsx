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
} from "lucide-react";
import { apiRequest, setAuthToken } from "../services/api";
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError("Please enter your real full name.");
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

      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      setVerificationStep(true);
    } catch (error) {
      setError(error.message || "Unable to start signup.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(event) {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = verificationCode.trim();

    if (!cleanCode) {
      setError("Please enter the verification code.");
      return;
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);

      await apiRequest("/users/verify", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          verificationCode: cleanCode,
        }),
      });

      navigate("/login");
    } catch (error) {
      setError(error.message || "Unable to verify your email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError("");

    const idToken = credentialResponse?.credential;

    if (!idToken) {
      setError("Google Sign-In did not return a valid credential.");
      return;
    }

    try {
      setGoogleLoading(true);

      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          idToken,
        }),
      });

      if (!data?.token) {
        throw new Error("Google Sign-In did not return a login token.");
      }

      setAuthToken(data.token);

      navigate("/dashboard");
    } catch (error) {
      setError(
        error.message || "Unable to continue with Google. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGoogleError() {
    setGoogleLoading(false);
    setError("Google Sign-In was cancelled or could not be completed.");
  }

  function handleBackToSignup() {
    setVerificationStep(false);
    setVerificationCode("");
    setError("");
  }

  return (
    <div className="signup-page">
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

      <main className="signup-shell">
        <section className="signup-visual">
          <Link to="/" className="signup-visual-brand">
            <img src={zyraLogo} alt="ZYRA" className="signup-visual-logo" />

            <div className="signup-visual-brand-text">
              <strong>ZYRA</strong>
              <span>Intelligent Project Workspace</span>
            </div>
          </Link>

          <div className="signup-visual-content">
            <div className="signup-visual-heading">
              <span className="signup-visual-eyebrow">
                INTELLIGENT WORKSPACE
              </span>

              <h1>
                Build together.
                <br />
                <span>Move smarter.</span>
              </h1>

              <p>
                Projects, teams, tasks and AI intelligence connected in one
                workspace.
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
                <Sparkles size={21} />
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
                  <strong>Project created</strong>
                  <span>AI-Powered Workspace</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-team">
                <div className="signup-float-icon">
                  <Users size={17} />
                </div>

                <div>
                  <strong>Team connected</strong>
                  <span>Everyone aligned</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-task">
                <div className="signup-float-icon">
                  <CheckCircle2 size={17} />
                </div>

                <div>
                  <strong>Task completed</strong>
                  <span>Progress updated</span>
                </div>

                <i />
              </div>

              <div className="signup-float-card signup-float-ai">
                <div className="signup-float-icon">
                  <Sparkles size={17} />
                </div>

                <div>
                  <strong>AI assistant</strong>
                  <span>Helping you build faster</span>
                </div>

                <i />
              </div>
            </div>

            <div className="signup-visual-footer">
              <div className="signup-footer-line" />

              <div>
                <strong>Plan. Collaborate. Build. Evolve.</strong>
                <span>The intelligent workspace for modern teams.</span>
              </div>
            </div>
          </div>
        </section>

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

            {!verificationStep ? (
              <>
                <div className="signup-card-header">
                  <span className="signup-eyebrow">CREATE YOUR ACCOUNT</span>

                  <h2>Get Started</h2>

                  <p>
                    Join ZYRA and start building your projects with a smarter
                    workspace.
                  </p>
                </div>

                <div className="google-signup-wrapper">
                  <button
                    type="button"
                    className="google-signup-button"
                    disabled={loading || googleLoading}
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
                      {loading ? "Sending verification..." : "Create Account"}
                    </span>

                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>

                <div className="signup-login-link">
                  <span>Already have an account?</span>
                  <Link to="/login">Sign in</Link>
                </div>
              </>
            ) : (
              <>
                <div className="signup-verification-icon">
                  <Mail size={25} />
                </div>

                <div className="signup-card-header">
                  <span className="signup-eyebrow">VERIFY YOUR EMAIL</span>

                  <h2>Check your inbox</h2>

                  <p>
                    We sent a 6-digit verification code to{" "}
                    <strong>{email}</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerification} className="signup-form">
                  <div className="signup-field">
                    <label htmlFor="verification-code">Verification Code</label>

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
                    <span>{loading ? "Verifying..." : "Confirm Code"}</span>

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
