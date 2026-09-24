import "../styles/landing.css";

import {
  ArrowDown,
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

  const handleEnterZYRA = () => {
    navigate("/login");
  };

  const handleGetStarted = () => {
    navigate("/signup");
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="zyra-landing">
      {/* =========================================================
          AMBIENT BACKGROUND
      ========================================================= */}

      <div className="landing-background" aria-hidden="true">
        <div className="landing-noise" />
        <div className="landing-grid" />

        <div className="landing-orb landing-orb-cyan" />
        <div className="landing-orb landing-orb-blue" />
        <div className="landing-orb landing-orb-purple" />

        <div className="landing-glow landing-glow-one" />
        <div className="landing-glow landing-glow-two" />
        <div className="landing-glow landing-glow-three" />

        <div className="landing-stars">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="landing-orbit landing-orbit-three" />

        <div className="landing-light-trail landing-light-trail-one" />
        <div className="landing-light-trail landing-light-trail-two" />
      </div>

      {/* =========================================================
          NAVIGATION
      ========================================================= */}

      <header className="landing-navbar">
        <button
          type="button"
          className="landing-brand"
          onClick={() => scrollToSection("hero")}
          aria-label="Go to ZYRA home"
        >
          <span className="landing-brand-mark">
            <svg
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="landingZyraGradient"
                  x1="8"
                  y1="56"
                  x2="56"
                  y2="8"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#22d3ee" />
                  <stop offset="0.48" stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>

              <path
                d="
                  M10 8
                  H54
                  C57 8 58 11 56 13
                  L20 51
                  H54
                  C57 51 58 54 56 56
                  H10
                  C7 56 6 53 8 51
                  L44 13
                  H10
                  C7 13 7 8 10 8
                  Z
                "
                fill="url(#landingZyraGradient)"
              />
            </svg>
          </span>

          <span className="landing-brand-copy">
            <strong>ZYRA</strong>
            <span>Intelligent Project Workspace</span>
          </span>
        </button>

        <nav className="landing-nav-links" aria-label="Main navigation">
          <button type="button" onClick={() => scrollToSection("product")}>
            Product
          </button>

          <button type="button" onClick={() => scrollToSection("features")}>
            Features
          </button>

          <button type="button" onClick={() => scrollToSection("intelligence")}>
            Intelligence
          </button>

          <button type="button" onClick={() => scrollToSection("vision")}>
            Vision
          </button>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-signin-btn"
            onClick={handleEnterZYRA}
          >
            Sign In
          </button>

          <button
            type="button"
            className="landing-get-started-btn"
            onClick={handleGetStarted}
          >
            Get Started
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* =========================================================
          MAIN
      ========================================================= */}

      <main>
        {/* =======================================================
            HERO
        ======================================================= */}

        <section className="landing-hero" id="hero">
          <div className="landing-hero-content">
            <div className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              THE INTELLIGENT PROJECT WORKSPACE
            </div>

            <h1 className="landing-hero-title">
              Everything your team
              <span>needs to build.</span>
            </h1>

            <p className="landing-hero-description">
              Projects, tasks, teams and intelligence in one evolving workspace.
            </p>

            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary-btn"
                onClick={handleGetStarted}
              >
                Get Started
                <ArrowRight size={18} />
              </button>

              {/* WATCH DEMO — FIXED ICON */}
              <button
                type="button"
                className="landing-demo-btn"
                onClick={() => scrollToSection("intelligence")}
              >
                <span className="landing-demo-icon">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </span>
                Watch Demo
              </button>
            </div>

            <div className="landing-trust-row">
              <div>
                <CheckCircle2 size={16} />
                <span>Project Management</span>
              </div>

              <div>
                <CheckCircle2 size={16} />
                <span>Team Collaboration</span>
              </div>

              <div>
                <CheckCircle2 size={16} />
                <span>AI Ready</span>
              </div>
            </div>
          </div>

          {/* =====================================================
              VISUAL 1 — ZYRA WORKSPACE
          ===================================================== */}

          <div className="landing-product-stage">
            <div className="landing-stage-aura" />

            <div className="landing-stage-ring landing-stage-ring-one" />
            <div className="landing-stage-ring landing-stage-ring-two" />

            {/* AI FLOATING CARD */}

            <div className="landing-floating-card landing-ai-floating">
              <div className="floating-card-icon">
                <Sparkles size={17} />
              </div>

              <div className="floating-card-content">
                <strong>ZYRA Intelligence</strong>
                <span>Analyzing your workspace...</span>
              </div>

              <span className="floating-live-dot" />
            </div>

            {/* COLLABORATION CARD */}

            <div className="landing-floating-card landing-collaboration-floating">
              <div className="collaboration-avatars">
                <span>A</span>
                <span>M</span>
                <span>+</span>
              </div>

              <div className="floating-card-content">
                <strong>Team Collaboration</strong>
                <span>2 members online</span>
              </div>
            </div>

            {/* AI INSIGHT CARD */}

            <div className="landing-floating-card landing-insight-floating">
              <div className="floating-insight-icon">
                <Brain size={16} />
              </div>

              <div className="floating-card-content">
                <strong>AI Insight</strong>
                <span>3 tasks may need attention.</span>
              </div>
            </div>

            {/* MAIN ZYRA WINDOW */}

            <div className="landing-dashboard-window">
              <div className="dashboard-window-topbar">
                <div className="dashboard-window-brand">
                  <div className="dashboard-mini-logo">Z</div>
                  <strong>ZYRA</strong>
                </div>

                <div className="dashboard-window-search">
                  <span>Search projects, tasks, AI insights...</span>
                </div>

                <div className="dashboard-window-actions">
                  <span className="window-action-dot" />
                  <span className="window-action-dot" />

                  <div className="dashboard-user">
                    <span className="dashboard-user-avatar">A</span>
                    <span>Arsalan</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-window-body">
                {/* MINI SIDEBAR */}

                <aside className="dashboard-mini-sidebar">
                  <div className="mini-sidebar-heading">WORKSPACE</div>

                  <div className="mini-sidebar-link active">
                    <Layers3 size={14} />
                    Dashboard
                  </div>

                  <div className="mini-sidebar-link">
                    <FolderKanban size={14} />
                    Projects
                  </div>

                  <div className="mini-sidebar-link">
                    <CircleCheck size={14} />
                    Tasks
                  </div>

                  <div className="mini-sidebar-link">
                    <Users size={14} />
                    Teams
                  </div>

                  <div className="mini-sidebar-heading mini-activity-heading">
                    ACTIVITY
                  </div>

                  <div className="mini-sidebar-link">
                    <Clock3 size={14} />
                    Notifications
                  </div>

                  <div className="mini-ai-link">
                    <Sparkles size={14} />
                    <span>AI Assistant</span>
                  </div>
                </aside>

                {/* MINI DASHBOARD */}

                <div className="dashboard-mini-main">
                  <div className="dashboard-mini-header">
                    <div>
                      <span>OVERVIEW</span>

                      <h3>
                        Good morning, Arsalan
                        <span>👋</span>
                      </h3>
                    </div>

                    <div className="dashboard-mini-avatar">A</div>
                  </div>

                  <div className="dashboard-mini-content">
                    {/* PROJECTS */}

                    <div className="dashboard-project-area">
                      <div className="mini-section-header">
                        <strong>Current Projects</strong>
                        <span>View all</span>
                      </div>

                      <div className="mini-project-grid">
                        <div className="mini-project-card cyan">
                          <div className="mini-project-top">
                            <strong>Project Nexus</strong>
                            <span>•••</span>
                          </div>

                          <div className="mini-project-meta">
                            <span>Progress</span>
                            <strong>85%</strong>
                          </div>

                          <div className="mini-progress">
                            <div
                              className="mini-progress-fill"
                              style={{ width: "85%" }}
                            />
                          </div>

                          <div className="mini-project-bottom">
                            <div className="mini-avatars">
                              <span>A</span>
                              <span>M</span>
                              <span>+</span>
                            </div>

                            <span className="mini-status cyan-status">
                              In Progress
                            </span>
                          </div>
                        </div>

                        <div className="mini-project-card blue">
                          <div className="mini-project-top">
                            <strong>Horizon Launch</strong>
                            <span>•••</span>
                          </div>

                          <div className="mini-project-meta">
                            <span>Progress</span>
                            <strong>72%</strong>
                          </div>

                          <div className="mini-progress">
                            <div
                              className="mini-progress-fill"
                              style={{ width: "72%" }}
                            />
                          </div>

                          <div className="mini-project-bottom">
                            <div className="mini-avatars">
                              <span>A</span>
                              <span>M</span>
                            </div>

                            <span className="mini-status blue-status">
                              Active
                            </span>
                          </div>
                        </div>

                        <div className="mini-project-card purple">
                          <div className="mini-project-top">
                            <strong>Helix Redesign</strong>
                            <span>•••</span>
                          </div>

                          <div className="mini-project-meta">
                            <span>Progress</span>
                            <strong>64%</strong>
                          </div>

                          <div className="mini-progress">
                            <div
                              className="mini-progress-fill"
                              style={{ width: "64%" }}
                            />
                          </div>

                          <div className="mini-project-bottom">
                            <div className="mini-avatars">
                              <span>A</span>
                              <span>+</span>
                            </div>

                            <span className="mini-status purple-status">
                              Review
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* INTELLIGENCE PANEL */}

                    <div className="mini-intelligence-panel">
                      <div className="mini-panel-title">
                        <strong>ZYRA Intelligence</strong>
                        <Sparkles size={14} />
                      </div>

                      <span className="mini-panel-subtitle">
                        AI Performance Outlook
                      </span>

                      <div className="mini-chart">
                        <svg
                          viewBox="0 0 240 80"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M0 62 C30 35 48 58 76 43 S120 58 150 29 S190 48 240 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                        </svg>
                      </div>

                      <p>Focus areas: Nexus is on track; Helix needs review.</p>

                      <div className="mini-recommendations">
                        <strong>Priority Recommendations</strong>
                        <span>1. Optimize resources for Nexus.</span>
                        <span>2. Resolve Helix UI bottlenecks.</span>
                      </div>
                    </div>

                    {/* BOTTOM PANELS */}

                    <div className="mini-bottom-panels">
                      <div className="mini-tasks-panel">
                        <div className="mini-section-header">
                          <strong>My Tasks</strong>
                          <span>•••</span>
                        </div>

                        <div className="mini-task">
                          <CheckCircle2 size={14} />
                          <span>Finalize Helix UX Review</span>
                          <small>Today</small>
                        </div>

                        <div className="mini-task">
                          <CircleCheck size={14} />
                          <span>Sync Marketing Plan</span>
                          <small>Tomorrow</small>
                        </div>

                        <div className="mini-task">
                          <Clock3 size={14} />
                          <span>Project Retrospective</span>
                          <small>Friday</small>
                        </div>
                      </div>

                      <div className="mini-team-panel">
                        <div className="mini-section-header">
                          <strong>Team Activity</strong>
                          <span>•••</span>
                        </div>

                        <div className="mini-feed-item">
                          <span className="feed-avatar">A</span>

                          <p>
                            Updated <strong>Project Nexus</strong> and synced
                            the team.
                          </p>
                        </div>

                        <div className="mini-feed-item">
                          <span className="feed-avatar purple-feed">M</span>

                          <p>
                            Updated project tasks and collaborated with the
                            team.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTIVE STATUS */}

            <div className="landing-stage-status">
              <span className="status-pulse" />

              <span>ZYRA workspace is active</span>

              <span className="status-divider" />

              <strong>2 members online</strong>
            </div>
          </div>
        </section>

        {/* =======================================================
            CAPABILITIES
        ======================================================= */}

        <section className="landing-capabilities-section" id="features">
          <div className="landing-section-heading">
            <div className="landing-section-label">
              <Zap size={15} />
              ONE INTELLIGENT WORKSPACE
            </div>

            <h2>
              Everything your project needs.
              <span>All in one place.</span>
            </h2>

            <p>
              ZYRA brings the essential pieces of project execution together
              before intelligence takes it further.
            </p>
          </div>

          <div className="landing-capability-grid">
            <div className="landing-capability-card">
              <div className="capability-icon">
                <FolderKanban size={22} />
              </div>

              <div className="capability-content">
                <span className="capability-number">01</span>
                <h3>Projects</h3>

                <p>
                  Organize projects, track progress and keep everything
                  connected.
                </p>
              </div>

              <span className="capability-arrow">
                <ArrowRight size={16} />
              </span>
            </div>

            <div className="landing-capability-card">
              <div className="capability-icon">
                <CircleCheck size={22} />
              </div>

              <div className="capability-content">
                <span className="capability-number">02</span>
                <h3>Tasks</h3>

                <p>
                  Turn ideas into actionable work and stay aligned on what comes
                  next.
                </p>
              </div>

              <span className="capability-arrow">
                <ArrowRight size={16} />
              </span>
            </div>

            <div className="landing-capability-card">
              <div className="capability-icon">
                <Users size={22} />
              </div>

              <div className="capability-content">
                <span className="capability-number">03</span>
                <h3>Teams</h3>

                <p>
                  Give teams a shared space for better collaboration and
                  visibility.
                </p>
              </div>

              <span className="capability-arrow">
                <ArrowRight size={16} />
              </span>
            </div>

            <div className="landing-capability-card ai-capability">
              <div className="capability-icon">
                <Sparkles size={22} />
              </div>

              <div className="capability-content">
                <span className="capability-number">04</span>
                <h3>AI Assistant</h3>

                <p>
                  Get intelligent insights, suggestions and support while you
                  work.
                </p>
              </div>

              <span className="capability-arrow">
                <ArrowRight size={16} />
              </span>
            </div>
          </div>
        </section>

        {/* =======================================================
            VISUAL 2 — ZYRA INTELLIGENCE NETWORK
        ======================================================= */}

        <section className="landing-intelligence-section" id="intelligence">
          <div className="landing-section-heading intelligence-heading">
            <div className="landing-section-label">
              <Sparkles size={15} />
              THE INTELLIGENCE LAYER
            </div>

            <h2>
              Your workspace
              <span>gets smarter over time.</span>
            </h2>

            <p>Your work is connected. Your intelligence should be too.</p>
          </div>

          {/* =====================================================
              INTELLIGENCE VISUAL
          ===================================================== */}

          <div className="zyra-intelligence-visual">
            <div className="intelligence-visual-title">
              <span>YOUR WORK IS CONNECTED.</span>
              <strong>YOUR INTELLIGENCE SHOULD BE TOO.</strong>
            </div>

            <div className="intelligence-network">
              {/* ENERGY RINGS */}

              <div className="network-ring network-ring-one" />
              <div className="network-ring network-ring-two" />
              <div className="network-ring network-ring-three" />

              {/* SVG CONNECTION SYSTEM */}

              <svg
                className="network-connections"
                viewBox="0 0 1100 620"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* PROJECTS */}

                <path
                  className="network-line"
                  d="M160 160 C330 160 360 280 500 310"
                />

                <path
                  className="network-line-glow"
                  d="M160 160 C330 160 360 280 500 310"
                />

                {/* TEAMS */}

                <path
                  className="network-line"
                  d="M160 430 C330 430 360 350 500 310"
                />

                <path
                  className="network-line-glow"
                  d="M160 430 C330 430 360 350 500 310"
                />

                {/* TASKS */}

                <path
                  className="network-line"
                  d="M940 160 C770 160 740 280 600 310"
                />

                <path
                  className="network-line-glow"
                  d="M940 160 C770 160 740 280 600 310"
                />

                {/* PEOPLE */}

                <path
                  className="network-line"
                  d="M940 430 C770 430 740 350 600 310"
                />

                <path
                  className="network-line-glow"
                  d="M940 430 C770 430 740 350 600 310"
                />

                {/* LOWER CONNECTION */}

                <path
                  className="network-lower-line"
                  d="M550 370 C550 445 550 475 550 535"
                />
              </svg>

              {/* MOVING PARTICLES */}

              <span className="network-particle particle-projects" />
              <span className="network-particle particle-teams" />
              <span className="network-particle particle-tasks" />
              <span className="network-particle particle-people" />

              {/* PROJECT NODE */}

              <div className="network-card network-card-projects">
                <div className="network-card-heading">
                  <FolderKanban size={15} />
                  PROJECTS
                </div>

                <div className="network-card-lines">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="network-mini-chart">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

                <span className="network-node-dot" />
              </div>

              {/* TASK NODE */}

              <div className="network-card network-card-tasks">
                <div className="network-card-heading">
                  <CircleCheck size={15} />
                  TASKS
                </div>

                <div className="network-card-lines">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="network-task-bars">
                  <i />
                  <i />
                  <i />
                </div>

                <span className="network-node-dot" />
              </div>

              {/* TEAMS NODE */}

              <div className="network-card network-card-teams">
                <div className="network-card-heading">
                  <Users size={15} />
                  TEAMS
                </div>

                <div className="network-card-lines">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="network-team-dots">
                  <i />
                  <i />
                  <i />
                </div>

                <span className="network-node-dot" />
              </div>

              {/* PEOPLE NODE */}

              <div className="network-card network-card-people">
                <div className="network-card-heading">
                  <Users size={15} />
                  PEOPLE
                </div>

                <div className="network-card-lines">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="network-people-icons">
                  <i />
                  <i />
                  <i />
                </div>

                <span className="network-node-dot" />
              </div>

              {/* CENTRAL ZYRA CORE */}

              <div className="zyra-network-core">
                <div className="core-energy-ring core-ring-one" />
                <div className="core-energy-ring core-ring-two" />
                <div className="core-energy-ring core-ring-three" />

                <div className="core-pulse" />

                <div className="core-logo">
                  <span>Z</span>
                </div>

                <strong>ZYRA</strong>
                <small>AI INTELLIGENCE</small>
              </div>

              {/* LOWER SYSTEM */}

              <div className="network-lower-system">
                <div className="lower-system-core">
                  <div className="lower-core-glow" />
                  <strong>ZYRA</strong>
                  <span>INTELLIGENCE</span>
                </div>

                <div className="lower-system-node lower-projects">PROJECTS</div>

                <div className="lower-system-node lower-tasks">TASKS</div>

                <div className="lower-system-node lower-teams">TEAMS</div>

                <div className="lower-system-node lower-people">PEOPLE</div>
              </div>

              <div className="network-down-arrow">
                <ArrowDown size={20} />
              </div>
            </div>
          </div>

          {/* ORIGINAL EVOLUTION FLOW REMAINS */}

          <div className="intelligence-evolution">
            <div className="intelligence-line" />

            <div className="intelligence-stage">
              <div className="intelligence-node">
                <Layers3 size={23} />
              </div>

              <span className="intelligence-step">FOUNDATION</span>

              <strong>Workspace</strong>
              <span>Organize & manage</span>
            </div>

            <div className="intelligence-connector">
              <ArrowRight size={18} />
            </div>

            <div className="intelligence-stage active">
              <div className="intelligence-node">
                <Sparkles size={23} />
              </div>

              <span className="intelligence-step">NOW</span>

              <strong>AI Assistant</strong>
              <span>Get instant help</span>
            </div>

            <div className="intelligence-connector">
              <ArrowRight size={18} />
            </div>

            <div className="intelligence-stage">
              <div className="intelligence-node">
                <Brain size={23} />
              </div>

              <span className="intelligence-step">NEXT</span>

              <strong>Predictive Intelligence</strong>
              <span>Spot risks & opportunities</span>
            </div>

            <div className="intelligence-connector">
              <ArrowRight size={18} />
            </div>

            <div className="intelligence-stage future">
              <div className="intelligence-node">
                <Zap size={23} />
              </div>

              <span className="intelligence-step">FUTURE</span>

              <strong>AI Project Agent</strong>
              <span>Take action automatically</span>
            </div>
          </div>
        </section>

        {/* =======================================================
            SHOWCASE
        ======================================================= */}

        <section className="landing-showcase-section">
          <div className="landing-showcase-header">
            <div>
              <div className="landing-section-label">
                <Layers3 size={15} />
                BUILT TO EVOLVE
              </div>

              <h2>
                From organized work
                <span>to intelligent work.</span>
              </h2>
            </div>

            <p>
              ZYRA starts with a powerful project workspace and creates a
              foundation for progressively deeper intelligence.
            </p>
          </div>

          <div className="landing-showcase-grid">
            <div className="showcase-card showcase-large">
              <div className="showcase-card-top">
                <span>01</span>
                <FolderKanban size={20} />
              </div>

              <h3>Projects & Teams</h3>

              <p>
                Keep your people, projects and progress connected in one
                intelligent workspace.
              </p>

              <div className="showcase-mini-ui">
                <div className="showcase-ui-sidebar">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="showcase-ui-content">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-top">
                <span>02</span>
                <CircleCheck size={20} />
              </div>

              <h3>Tasks & Milestones</h3>

              <p>Turn project goals into clear, trackable work.</p>

              <div className="showcase-kanban">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-top">
                <span>03</span>
                <Sparkles size={20} />
              </div>

              <h3>AI Assistant</h3>

              <p>
                Ask questions, understand your workspace and get intelligent
                assistance.
              </p>

              <div className="showcase-ai-message">
                <Sparkles size={14} />
                <span>3 tasks may need attention.</span>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-top">
                <span>04</span>
                <Brain size={20} />
              </div>

              <h3>Predictive Intelligence</h3>

              <p>Progressively identify patterns, risks and opportunities.</p>

              <div className="showcase-chart">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================
            VISION
        ======================================================= */}

        <section className="landing-vision-section" id="vision">
          <div className="vision-background-word">ZYRA</div>

          <div className="vision-orbit vision-orbit-one" />
          <div className="vision-orbit vision-orbit-two" />

          <div className="vision-content">
            <div className="landing-section-label">
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
              ZYRA is designed to progressively evolve from organization into
              intelligence — helping teams not only manage work, but understand
              it.
            </p>

            <button
              type="button"
              className="landing-primary-btn"
              onClick={handleEnterZYRA}
            >
              Enter ZYRA
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* =======================================================
            FINAL CTA
        ======================================================= */}

        <section className="landing-final-cta">
          <div className="final-cta-aura" />
          <div className="final-cta-grid" />

          <div className="final-cta-content">
            <div className="landing-section-label">
              <Sparkles size={15} />
              START BUILDING
            </div>

            <h2>
              Your workspace.
              <span>Ready to evolve.</span>
            </h2>

            <p>Bring your projects, people and ideas together with ZYRA.</p>

            <button
              type="button"
              className="landing-primary-btn final-cta-button"
              onClick={handleGetStarted}
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <div className="footer-logo-mark">Z</div>

          <div>
            <strong>ZYRA</strong>
            <span>Intelligent Project Workspace</span>
          </div>
        </div>

        <div className="landing-footer-tagline">
          Plan. Collaborate. Build. Evolve.
        </div>

        <div className="landing-footer-copy">© 2026 ZYRA</div>
      </footer>
    </div>
  );
}

export default Landing;
