import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Compass,
  FolderKanban,
  LayoutGrid,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import "../styles/Dashboard.css";

function Dashboard() {
  return (
    <main className="zyra-overview-dashboard">
      <section className="overview-canvas">
        {/* ==============================================
            COMPACT HEADER
        ============================================== */}

        <header className="overview-shell-header">
          <div className="overview-heading-copy">
            <div className="overview-eyebrow">
              <span className="overview-eyebrow-dot" />
              WORKSPACE OVERVIEW
            </div>

            <h1>
              Your space to <span>build.</span>
            </h1>

            <p>A clearer way to organize ideas and move work forward.</p>
          </div>

          <div className="overview-header-badge">
            <span className="overview-badge-icon">
              <LayoutGrid size={17} />
            </span>

            <div>
              <strong>ZYRA Workspace</strong>
              <span>Workspace overview</span>
            </div>

            <span className="overview-badge-indicator" />
          </div>
        </header>

        {/* ==============================================
            MAIN CONTENT
        ============================================== */}

        <div className="overview-main-grid">
          {/* ----------------------------------------------
              FEATURED HERO
          ---------------------------------------------- */}

          <section className="overview-hero">
            <div className="overview-hero-content">
              <span className="overview-hero-label">
                <Sparkles size={13} />A FRESH START
              </span>

              <h2>
                Think clearly.
                <br />
                Work <span>smarter.</span>
              </h2>

              <p>
                Bring your projects, ideas, and plans together in one organized
                workspace.
              </p>

              <div className="overview-hero-bottom">
                <span className="overview-hero-status">
                  <CheckCircle2 size={15} />
                  One workspace. Clear direction.
                </span>
              </div>
            </div>

            {/* Decorative workspace graphic */}

            <div className="overview-visual" aria-hidden="true">
              <div className="overview-orbit overview-orbit-one" />
              <div className="overview-orbit overview-orbit-two" />

              <div className="overview-visual-card overview-visual-main">
                <Workflow size={29} />
                <span>YOUR WORKSPACE</span>
                <div className="overview-visual-line" />
                <div className="overview-visual-line overview-visual-line-short" />
              </div>

              <div className="overview-floating-card overview-floating-top">
                <FolderKanban size={18} />
              </div>

              <div className="overview-floating-card overview-floating-bottom">
                <Users size={18} />
              </div>

              <span className="overview-visual-dot overview-visual-dot-one" />
              <span className="overview-visual-dot overview-visual-dot-two" />
            </div>
          </section>

          {/* ----------------------------------------------
              SIDE INFORMATION CARDS
          ---------------------------------------------- */}

          <aside className="overview-side-stack">
            <article className="overview-info-card">
              <div className="overview-info-heading">
                <span className="overview-info-icon">
                  <Compass size={17} />
                </span>

                <span className="overview-info-label">WORKSPACE GUIDE</span>
              </div>

              <h3>Find your direction.</h3>

              <p>
                Start with a plan, organize the details, and focus on what
                matters.
              </p>

              <div className="overview-info-divider" />

              <div className="overview-info-footer">
                <span>Plan your next move</span>
                <Compass size={15} />
              </div>
            </article>

            <article className="overview-info-card overview-quick-card">
              <div className="overview-info-heading">
                <span className="overview-info-icon">
                  <Zap size={17} />
                </span>

                <span className="overview-info-label">BUILT FOR FOCUS</span>
              </div>

              <div className="overview-focus-list">
                <div>
                  <Circle size={15} />
                  <span>Stay organized</span>
                </div>

                <div>
                  <Circle size={15} />
                  <span>Keep work structured</span>
                </div>

                <div>
                  <Circle size={15} />
                  <span>Move forward with clarity</span>
                </div>
              </div>
            </article>
          </aside>

          {/* ----------------------------------------------
              THREE WORKSPACE MODULES
          ---------------------------------------------- */}

          <section className="overview-modules">
            <article className="overview-module-card">
              <span className="overview-module-icon">
                <FolderKanban size={19} />
              </span>

              <div className="overview-module-copy">
                <span>ORGANIZE</span>
                <h3>Projects</h3>

                <p>Give your ideas structure and keep related work together.</p>
              </div>

              <ArrowRight
                size={16}
                className="overview-module-arrow"
                aria-hidden="true"
              />
            </article>

            <article className="overview-module-card">
              <span className="overview-module-icon">
                <Activity size={19} />
              </span>

              <div className="overview-module-copy">
                <span>MAKE PROGRESS</span>
                <h3>Tasks & Goals</h3>

                <p>Turn bigger plans into smaller, actionable steps.</p>
              </div>

              <ArrowRight
                size={16}
                className="overview-module-arrow"
                aria-hidden="true"
              />
            </article>

            <article className="overview-module-card">
              <span className="overview-module-icon">
                <Users size={19} />
              </span>

              <div className="overview-module-copy">
                <span>WORK TOGETHER</span>
                <h3>Collaboration</h3>

                <p>Keep people, responsibilities, and shared work connected.</p>
              </div>

              <ArrowRight
                size={16}
                className="overview-module-arrow"
                aria-hidden="true"
              />
            </article>
          </section>
        </div>

        {/* ==============================================
            COMPACT FOOTER
        ============================================== */}

        <footer className="overview-shell-footer">
          <div className="overview-footer-brand">
            <span className="overview-footer-dot" />
            <strong>ZYRA</strong>
            <span className="overview-footer-divider">/</span>
            <span>WORKSPACE OVERVIEW</span>
          </div>

          <span className="overview-footer-tagline">
            Plan. Collaborate. Build. Evolve.
          </span>
        </footer>
      </section>
    </main>
  );
}

export default Dashboard;
