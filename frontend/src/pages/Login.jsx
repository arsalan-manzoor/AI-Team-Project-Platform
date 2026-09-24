import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { login } from "../services/authService";
import "../styles/login.css";
import zyraLogo from "../assets/zyra-logo.jpg";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Lock the fields on page load so Chrome cannot autofill them
  const [isReadOnly, setIsReadOnly] = useState(true);

  // Unlock the fields right before the user clicks
  const unlockFields = () => setIsReadOnly(false);

  async function handleLogin(event) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      await login(email.trim(), password);

      navigate("/dashboard");
    } catch (error) {
      setError(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-background" aria-hidden="true">
        <div className="network-line network-line-1"></div>
        <div className="network-line network-line-2"></div>
        <div className="network-line network-line-3"></div>
        <div className="network-line network-line-4"></div>
        <div className="network-line network-line-5"></div>

        <span className="network-node network-node-1"></span>
        <span className="network-node network-node-2"></span>
        <span className="network-node network-node-3"></span>
        <span className="network-node network-node-4"></span>
        <span className="network-node network-node-5"></span>
        <span className="network-node network-node-6"></span>

        <div className="ambient-glow ambient-glow-1"></div>
        <div className="ambient-glow ambient-glow-2"></div>
      </div>

      <header className="login-header">
        <div className="login-brand">
          <img src={zyraLogo} alt="ZYRA" className="login-brand-logo" />

          <div>
            <h1>ZYRA</h1>
            <span>Intelligent Project Workspace</span>
          </div>
        </div>

        <div className="system-status">
          <span className="status-dot"></span>
          SYSTEM READY
        </div>
      </header>

      <main className="login-main">
        <section className="login-card">
          <div className="login-card-header">
            <span className="login-eyebrow">WORKSPACE ACCESS</span>

            <h2>Access Workspace</h2>

            <p>Secure workspace authentication</p>
          </div>

          <form onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label htmlFor="username">Email</label>

              <input
                id="username"
                type="text"
                name="username"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                /* The Magic Combination */
                readOnly={isReadOnly}
                onMouseEnter={unlockFields} // Desktop: unlocks before click
                onTouchStart={unlockFields} // Mobile: unlocks before tap
                onFocus={unlockFields} // Fallback
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                /* The Magic Combination */
                readOnly={isReadOnly}
                onMouseEnter={unlockFields}
                onTouchStart={unlockFields}
                onFocus={unlockFields}
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Enter Workspace"}
            </button>
          </form>

          <div className="login-security-note">
            <span>SECURE CONNECTION</span>
            <span>ZYRA WORKSPACE</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Login;
