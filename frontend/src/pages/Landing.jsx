import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Clock3,
  FolderKanban,
  Layers3,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="zyra-landing">
      {/* Animated Background */}
      <div className="landing-background">
        <div className="landing-orb landing-orb-one"></div>
        <div className="landing-orb landing-orb-two"></div>
        <div className="landing-orb landing-orb-three"></div>
        <div className="landing-grid"></div>
      </div>

      {/* NAVBAR */}
      <header className="landing-navbar">
        <div className="landing-brand">
          <div className="landing-logo">
            <span>Z</span>
          </div>

          <div>
            <strong>ZYRA</strong>
            <span>Intelligent Project Workspace</span>
          </div>
        </div>

        <nav className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#features">Features</a>
          <a href="#ai">AI</a>
          <a href="#vision">Vision</a>
        </nav>

        <div className="landing-nav-actions">
          <button
            className="landing-signin-btn"
            onClick={() => navigate("/login")}
          >
            Sign In
          </button>

          <button
            className="landing-get-started-btn"
            onClick={() => navigate("/login")}
          >
            Get Started
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* HERO */}
      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <div className="landing-badge">
              <span className="landing-badge-dot"></span>
              The workspace that evolves with you
            </div>

            <h1>
              Build better projects.
              <span>Work smarter together.</span>
            </h1>

            <p className="landing-hero-description">
              ZYRA brings projects, tasks, teams, and intelligent assistance
              into one evolving workspace built for the way modern teams work.
            </p>

            <div className="landing-hero-actions">
              <button
                className="landing-primary-btn"
                onClick={() => navigate("/login")}
              >
                Start Building
                <ArrowRight size={18} />
              </button>

              <a href="#product" className="landing-secondary-btn">
                Explore ZYRA
                <ChevronRight size={17} />
              </a>
            </div>

            <div className="landing-trust-row">
              <div>
                <CheckCircle2 size={15} />
                <span>Project Management</span>
              </div>

              <div>
                <CheckCircle2 size={15} />
                <span>Team Collaboration</span>
              </div>

              <div>
                <CheckCircle2 size={15} />
                <span>AI Ready</span>
              </div>
            </div>
          </div>

          {/* INTERACTIVE PRODUCT VISUAL */}
          <div className="landing-product-stage">
            <div className="landing-stage-glow"></div>

            <div className="floating-card floating-card-top">
              <div className="floating-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <strong>AI Assistant</strong>
                <span>Analyzing workspace...</span>
              </div>
              <div className="ai-pulse"></div>
            </div>

            <div className="landing-dashboard-window">
              <div className="dashboard-window-header">
                <div className="window-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <span className="window-title">ZYRA Workspace</span>

                <div className="window-status">
                  <span></span>
                  Live
                </div>
              </div>

              <div className="dashboard-window-body">
                <aside className="mini-sidebar">
                  <div className="mini-brand">
                    <div className="mini-z">Z</div>
                    <span>ZYRA</span>
                  </div>

                  <div className="mini-nav active">
                    <Layers3 size={14} />
                    Dashboard
                  </div>

                  <div className="mini-nav">
                    <FolderKanban size={14} />
                    Projects
                  </div>

                  <div className="mini-nav">
                    <CircleCheck size={14} />
                    Tasks
                  </div>

                  <div className="mini-nav">
                    <Users size={14} />
                    Teams
                  </div>

                  <div className="mini-ai">
                    <Sparkles size={14} />
                    <span>AI Assistant</span>
                  </div>
                </aside>

                <div className="mini-main">
                  <div className="mini-topline">
                    <div>
                      <span>OVERVIEW</span>
                      <h3>Good morning, Arsalan</h3>
                    </div>

                    <div className="mini-avatar">A</div>
                  </div>

                  <div className="mini-stats">
                    <div className="mini-stat">
                      <div className="mini-stat-icon">
                        <FolderKanban size={14} />
                      </div>
                      <span>Projects</span>
                      <strong>08</strong>
                    </div>

                    <div className="mini-stat">
                      <div className="mini-stat-icon">
                        <CircleCheck size={14} />
                      </div>
                      <span>Tasks Done</span>
                      <strong>42</strong>
                    </div>

                    <div className="mini-stat">
                      <div className="mini-stat-icon">
                        <Users size={14} />
                      </div>
                      <span>Members</span>
                      <strong>12</strong>
                    </div>
                  </div>

                  <div className="mini-workspace">
                    <div className="mini-panel">
                      <div className="mini-panel-heading">
                        <div>
                          <span>ACTIVE PROJECT</span>
                          <strong>ZYRA Platform</strong>
                        </div>

                        <span className="mini-active">Active</span>
                      </div>

                      <div className="mini-progress">
                        <div className="mini-progress-label">
                          <span>Project progress</span>
                          <strong>68%</strong>
                        </div>

                        <div className="progress-track">
                          <div className="progress-fill"></div>
                        </div>
                      </div>

                      <div className="mini-task-list">
                        <div className="mini-task completed">
                          <div className="task-check">
                            <CheckCircle2 size={13} />
                          </div>
                          <span>Workspace foundation</span>
                          <small>Done</small>
                        </div>

                        <div className="mini-task">
                          <div className="task-check pending">
                            <Clock3 size={13} />
                          </div>
                          <span>AI Assistant integration</span>
                          <small>In progress</small>
                        </div>

                        <div className="mini-task">
                          <div className="task-check pending">
                            <Clock3 size={13} />
                          </div>
                          <span>Predictive intelligence</span>
                          <small>Upcoming</small>
                        </div>
                      </div>
                    </div>

                    <div className="mini-ai-panel">
                      <div className="mini-ai-heading">
                        <div className="mini-ai-symbol">
                          <Brain size={15} />
                        </div>

                        <div>
                          <strong>ZYRA AI</strong>
                          <span>Intelligence layer</span>
                        </div>
                      </div>

                      <div className="ai-message">
                        <span className="ai-message-dot"></span>I found 3 tasks
                        that may need attention.
                      </div>

                      <div className="ai-lines">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-card floating-card-bottom">
              <div className="floating-members">
                <span>A</span>
                <span>M</span>
                <span>+</span>
              </div>

              <div>
                <strong>Team online</strong>
                <span>2 members collaborating</span>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT INTRO */}
        <section className="landing-product-section" id="product">
          <div className="section-heading">
            <div className="section-label">
              <Zap size={15} />
              ONE WORKSPACE
            </div>

            <h2>
              Everything your project needs.
              <span>All in one place.</span>
            </h2>

            <p>
              ZYRA connects the everyday building blocks of a project into one
              workspace, creating the foundation for intelligent collaboration.
            </p>
          </div>

          <div className="landing-product-cards">
            <div className="product-card product-card-large">
              <div className="product-card-icon">
                <FolderKanban size={22} />
              </div>

              <span className="product-card-number">01</span>

              <h3>Projects</h3>

              <p>
                Organize projects, track progress, and keep every important
                piece of work connected.
              </p>

              <div className="product-card-line"></div>
            </div>

            <div className="product-card">
              <div className="product-card-icon">
                <CircleCheck size={22} />
              </div>

              <span className="product-card-number">02</span>

              <h3>Tasks</h3>

              <p>
                Turn ideas into actionable work and keep everyone aligned on
                what comes next.
              </p>

              <div className="product-card-line"></div>
            </div>

            <div className="product-card">
              <div className="product-card-icon">
                <Users size={22} />
              </div>

              <span className="product-card-number">03</span>

              <h3>Teams</h3>

              <p>
                Give teams a shared space where collaboration becomes simpler
                and more transparent.
              </p>

              <div className="product-card-line"></div>
            </div>
          </div>
        </section>

        {/* AI SECTION */}
        <section className="landing-ai-section" id="ai">
          <div className="ai-section-visual">
            <div className="ai-orbit orbit-one"></div>
            <div className="ai-orbit orbit-two"></div>
            <div className="ai-orbit orbit-three"></div>

            <div className="ai-core">
              <div className="ai-core-inner">
                <Brain size={42} />
              </div>
            </div>

            <div className="ai-node node-one">
              <FolderKanban size={16} />
            </div>

            <div className="ai-node node-two">
              <CircleCheck size={16} />
            </div>

            <div className="ai-node node-three">
              <Users size={16} />
            </div>

            <div className="ai-node node-four">
              <Sparkles size={16} />
            </div>
          </div>

          <div className="ai-section-content">
            <div className="section-label">
              <Sparkles size={15} />
              INTELLIGENCE LAYER
            </div>

            <h2>
              Your workspace
              <span>gets smarter over time.</span>
            </h2>

            <p>
              ZYRA starts with a powerful project workspace. As the platform
              evolves, intelligence becomes part of the way your team works.
            </p>

            <div className="ai-roadmap">
              <div className="ai-roadmap-item active">
                <div className="roadmap-number">01</div>
                <div>
                  <strong>AI Assistant</strong>
                  <span>Understand and assist with project work.</span>
                </div>
              </div>

              <div className="ai-roadmap-item">
                <div className="roadmap-number">02</div>
                <div>
                  <strong>Predictive Intelligence</strong>
                  <span>Identify patterns and project risks.</span>
                </div>
              </div>

              <div className="ai-roadmap-item">
                <div className="roadmap-number">03</div>
                <div>
                  <strong>AI Project Agent</strong>
                  <span>Move from assistance toward intelligent action.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="landing-features-section" id="features">
          <div className="section-heading centered">
            <div className="section-label">
              <Layers3 size={15} />
              BUILT TO EVOLVE
            </div>

            <h2>
              Simple at the beginning.
              <span>Powerful as it grows.</span>
            </h2>
          </div>

          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-number">01</div>
              <h3>Project-first architecture</h3>
              <p>
                A structured workspace designed to become the foundation for
                deeper intelligence.
              </p>
            </div>

            <div className="feature-item">
              <div className="feature-number">02</div>
              <h3>Collaboration built in</h3>
              <p>
                Projects, tasks, teams, and communication stay connected instead
                of living in separate tools.
              </p>
            </div>

            <div className="feature-item">
              <div className="feature-number">03</div>
              <h3>AI-ready foundation</h3>
              <p>
                The platform is designed so intelligence can progressively
                become part of everyday project workflows.
              </p>
            </div>

            <div className="feature-item">
              <div className="feature-number">04</div>
              <h3>Built for the future</h3>
              <p>
                The architecture leaves room for machine learning, automation,
                integrations, and intelligent agents.
              </p>
            </div>
          </div>
        </section>

        {/* VISION */}
        <section className="landing-vision-section" id="vision">
          <div className="vision-content">
            <div className="section-label">
              <Sparkles size={15} />
              THE ZYRA VISION
            </div>

            <h2>
              Plan.
              <span>Collaborate.</span>
              Build.
              <span>Evolve.</span>
            </h2>

            <p>
              ZYRA is not just another project-management tool. It is a
              workspace designed to progressively evolve from organization into
              intelligence.
            </p>

            <button
              className="landing-primary-btn"
              onClick={() => navigate("/login")}
            >
              Enter ZYRA
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="vision-word">
            <span>ZYRA</span>
            <div className="vision-line"></div>
            <small>Intelligent Project Workspace</small>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="landing-final-cta">
          <div className="final-cta-glow"></div>

          <div className="final-cta-content">
            <div className="section-label">
              <Sparkles size={15} />
              START BUILDING
            </div>

            <h2>
              Your workspace.
              <span>Ready to evolve.</span>
            </h2>

            <p>Bring your projects, people, and ideas together with ZYRA.</p>

            <button
              className="landing-primary-btn final-btn"
              onClick={() => navigate("/login")}
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <div className="footer-logo">Z</div>

          <div>
            <strong>ZYRA</strong>
            <span>Intelligent Project Workspace</span>
          </div>
        </div>

        <div className="footer-tagline">Plan. Collaborate. Build. Evolve.</div>

        <div className="footer-copy">© 2026 ZYRA</div>
      </footer>
    </div>
  );
}

export default Landing;
