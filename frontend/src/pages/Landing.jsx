import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import "../styles/landing.css";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  CircleCheck,
  Clock3,
  FolderKanban,
  Layers3,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const SECTIONS = [
  { id: "product", num: "01", label: "Workspace" },
  { id: "features", num: "02", label: "Architecture" },
  { id: "intelligence", num: "03", label: "Intelligence" },
  { id: "vision", num: "04", label: "Launch" },
];

const EVOLUTION_STEPS = [
  { step: "01", title: "WORK", icon: FolderKanban },
  { step: "02", title: "DATA", icon: Activity },
  { step: "03", title: "CONTEXT", icon: Layers3 },
  { step: "04", title: "RELATIONSHIPS", icon: Users },
  { step: "05", title: "INTELLIGENCE", icon: Brain, active: true },
  { step: "06", title: "ACTION", icon: Zap, future: true },
];

function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const dashboardRef = useRef(null);
  const lenisRef = useRef(null);

  const [activeSection, setActiveSection] = useState(0);
  const [previewMode, setPreviewMode] = useState("company");

  const handleStartIndividual = () => navigate("/individual");
  const handleStartCompany = () => navigate("/company");

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const updateTicker = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
    };
  }, []);

  const scrollToSection = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: 0, duration: 1.5 });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleStageMouseMove = (e) => {
    if (window.innerWidth <= 800 || !stageRef.current || !dashboardRef.current)
      return;
    const rect = stageRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width - 0.5;
    const yRatio = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(dashboardRef.current, {
      rotateY: xRatio * 10,
      rotateX: -yRatio * 10,
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(".landing-floating-card", {
      x: xRatio * -30,
      y: yRatio * -24,
      duration: 0.6,
      stagger: 0.03,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleStageMouseLeave = () => {
    if (window.innerWidth <= 800 || !dashboardRef.current) return;
    gsap.to(dashboardRef.current, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.8,
      ease: "power3.out",
      overwrite: "auto",
    });
    gsap.to(".landing-floating-card", {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".zyra-scroll-progress-bar", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.2,
        },
      });

      const mm = gsap.matchMedia();

      mm.add("(min-width: 801px)", () => {
        // =====================================================
        // STAGE 01
        // =====================================================
        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#product",
            start: "top top",
            end: "+=175%",
            pin: true,
            scrub: 1,
            onToggle: (self) => self.isActive && setActiveSection(0),
          },
        });
        heroTl
          .to(
            ".theater-hero-header",
            {
              y: -140,
              scale: 0.88,
              opacity: 0,
              filter: "blur(8px)",
              duration: 0.7,
              ease: "power2.inOut",
            },
            0,
          )
          .fromTo(
            ".landing-dashboard-window",
            { rotateX: 28, scale: 0.78, y: 40 },
            {
              rotateX: 0,
              scale: 1.08,
              y: -95,
              boxShadow:
                "0 45px 130px rgba(0,0,0,0.85), 0 0 80px rgba(34,211,238,0.32)",
              duration: 1.1,
              ease: "power2.out",
            },
            0,
          )
          .fromTo(
            ".mini-progress-fill",
            { scaleX: 0.2, transformOrigin: "left center" },
            { scaleX: 1, duration: 0.8, stagger: 0.12 },
            0.35,
          )
          .fromTo(
            ".mini-task",
            { x: -20, opacity: 0.3 },
            { x: 0, opacity: 1, stagger: 0.12, duration: 0.6 },
            0.4,
          )
          .fromTo(
            ".landing-ai-floating",
            { x: 80, y: 40, opacity: 0, scale: 0.6 },
            { x: -45, y: -90, opacity: 1, scale: 1.05, duration: 0.7 },
            0.45,
          )
          .fromTo(
            ".landing-collaboration-floating",
            { x: -80, y: 40, opacity: 0, scale: 0.6 },
            { x: 45, y: -85, opacity: 1, scale: 1.05, duration: 0.7 },
            0.55,
          )
          .fromTo(
            ".landing-insight-floating",
            { y: 60, opacity: 0, scale: 0.6 },
            { y: -55, opacity: 1, scale: 1.05, duration: 0.7 },
            0.65,
          );

        // =====================================================
        // STAGE 02: 3D ISOMETRIC LAYER STACK
        // =====================================================
        const archTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#features",
            start: "top top",
            end: "+=200%",
            pin: true,
            scrub: 1.2,
            onToggle: (self) => self.isActive && setActiveSection(1),
          },
        });
        archTl
          .fromTo(
            "#features .compact-stage-header",
            { y: 45, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            0,
          )
          .fromTo(
            ".iso-3d-stage",
            {
              autoAlpha: 0,
              scale: 0.8,
              rotateX: 30,
              rotateZ: -10,
              transformPerspective: 2500,
            },
            {
              autoAlpha: 1,
              scale: 1,
              rotateX: 48,
              rotateZ: -20,
              duration: 0.6,
              ease: "power3.out",
            },
            0.1,
          )
          .fromTo(
            ".iso-layer-1",
            { z: 0, opacity: 0 },
            { z: 60, opacity: 1, duration: 0.5 },
            0.3,
          )
          .fromTo(
            ".iso-layer-2",
            { z: 0, opacity: 0 },
            { z: 120, opacity: 1, duration: 0.5 },
            0.4,
          )
          .fromTo(
            ".iso-layer-3",
            { z: 0, opacity: 0 },
            { z: 180, opacity: 1, duration: 0.5 },
            0.5,
          )
          .fromTo(
            ".iso-layer-4",
            { z: 0, opacity: 0 },
            { z: 240, opacity: 1, duration: 0.5 },
            0.6,
          )
          .fromTo(
            ".iso-layer-5",
            { z: 0, opacity: 0 },
            { z: 300, opacity: 1, duration: 0.5 },
            0.7,
          )
          .fromTo(
            ".iso-data-stream",
            { scaleY: 0, opacity: 0 },
            { scaleY: 1, opacity: 1, duration: 0.6 },
            0.5,
          )
          .fromTo(
            ".iso-action-btn",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            0.8,
          );

        // =====================================================
        // STAGE 03: THE TELEMETRY RADAR
        // =====================================================
        const intelTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#intelligence",
            start: "top top",
            end: "+=220%",
            pin: true,
            scrub: 1.2,
            onToggle: (self) => self.isActive && setActiveSection(2),
          },
        });

        intelTl
          .fromTo(
            "#intelligence .compact-stage-header",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            0,
          )
          .fromTo(
            ".radar-grid",
            { scale: 0.2, opacity: 0, rotateZ: -45 },
            {
              scale: 1,
              opacity: 1,
              rotateZ: 0,
              duration: 1,
              ease: "power3.out",
            },
            0.1,
          )
          .fromTo(
            ".term-line",
            { opacity: 0, x: -20 },
            { opacity: 1, x: 0, stagger: 0.15, duration: 0.5 },
            0.3,
          )
          .fromTo(
            ".node-a .node-dot",
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3 },
            0.8,
          )
          .fromTo(
            ".node-a .node-tooltip",
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            0.9,
          )
          .fromTo(
            ".node-b .node-dot",
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3 },
            1.3,
          )
          .fromTo(
            ".node-b .node-tooltip",
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            1.4,
          )
          .fromTo(
            ".node-c .node-dot",
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3 },
            1.8,
          )
          .fromTo(
            ".node-c .node-tooltip",
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 },
            1.9,
          )
          .fromTo(
            ".hud-evo-pill",
            { y: 20, opacity: 0.15, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.6 },
            2.2,
          );

        // =====================================================
        // STAGE 04
        // =====================================================
        const visionTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#vision",
            start: "top top",
            end: "+=150%",
            pin: true,
            scrub: 1,
            onToggle: (self) => self.isActive && setActiveSection(3),
          },
        });
        visionTl
          .fromTo(
            ".vision-orbit-one",
            { rotation: -80, scale: 0.6 },
            { rotation: 25, scale: 1.05, duration: 1.2 },
            0,
          )
          .fromTo(
            ".vision-orbit-two",
            { rotation: 80, scale: 0.6 },
            { rotation: -25, scale: 1.05, duration: 1.2 },
            0,
          )
          .fromTo(
            ".vision-kinetic-title",
            { y: 50, opacity: 0, scale: 0.88 },
            { y: 0, opacity: 1, scale: 1, duration: 0.7 },
            0.15,
          )
          .fromTo(
            ".holo-portal-card",
            { y: 80, opacity: 0, scale: 0.88, rotateX: 15 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              rotateX: 0,
              stagger: 0.15,
              duration: 0.8,
              ease: "power3.out",
            },
            0.45,
          );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="zyra-landing" ref={containerRef}>
      <div className="zyra-scroll-progress-bar" aria-hidden="true" />

      <aside className="zyra-section-hud" aria-label="Section progress">
        {SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            className={`hud-dot-btn ${activeSection === idx ? "active" : ""}`}
            onClick={() => scrollToSection(sec.id)}
          >
            <span className="hud-num">{sec.num}</span>
            <span className="hud-label">{sec.label}</span>
            <span className="hud-pip" />
          </button>
        ))}
      </aside>

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
          {Array.from({ length: 12 }).map((_, idx) => (
            <span key={idx} />
          ))}
        </div>
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="landing-orbit landing-orbit-three" />
        <div className="landing-light-trail landing-light-trail-one" />
        <div className="landing-light-trail landing-light-trail-two" />
      </div>

      <header className="landing-navbar">
        <button
          type="button"
          className="landing-brand"
          onClick={() => scrollToSection("product")}
        >
          <span className="landing-brand-mark">
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
                d="M10 8 H54 C57 8 58 11 56 13 L20 51 H54 C57 51 58 54 56 56 H10 C7 56 6 53 8 51 L44 13 H10 C7 13 7 8 10 8 Z"
                fill="url(#landingZyraGradient)"
              />
            </svg>
          </span>
          <span className="landing-brand-copy">
            <strong>ZYRA</strong>
            <span>Intelligent Project Workspace</span>
          </span>
        </button>

        <nav className="landing-nav-links">
          {SECTIONS.map((sec, idx) => (
            <button
              key={sec.id}
              type="button"
              className={activeSection === idx ? "active-nav-link" : ""}
              onClick={() => scrollToSection(sec.id)}
            >
              {sec.label}
            </button>
          ))}
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-signin-btn"
            onClick={handleStartIndividual}
          >
            Start with Individual
          </button>
          <button
            type="button"
            className="landing-get-started-btn company-header-btn"
            onClick={handleStartCompany}
          >
            Start with Company <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <main>
        {/* STAGE 01 */}
        <section className="cinematic-section" id="product">
          <div className="theater-stage-container">
            <div className="theater-hero-header">
              <div className="landing-eyebrow">
                <span className="landing-eyebrow-dot" />
                INTELLIGENT WORKSPACE ECOSYSTEM
              </div>
              <h1 className="theater-hero-title">
                Your work. <span>Connected intelligently.</span>
              </h1>
              <div className="theater-dual-gateways">
                <button
                  type="button"
                  className="landing-primary-btn zyra-entry-btn"
                  onClick={handleStartIndividual}
                  onMouseEnter={() => setPreviewMode("individual")}
                >
                  <User size={16} />
                  <div className="entry-btn-copy">
                    <strong>Start with Individual</strong>
                    <small>Personal Workspace →</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="landing-demo-btn zyra-entry-btn company-entry"
                  onClick={handleStartCompany}
                  onMouseEnter={() => setPreviewMode("company")}
                >
                  <span className="landing-demo-icon">
                    <Building2 size={15} strokeWidth={2.2} />
                  </span>
                  <div className="entry-btn-copy">
                    <strong>Start with Company</strong>
                    <small>Organization Workspace →</small>
                  </div>
                </button>
              </div>
            </div>

            <div
              className="landing-product-stage theater-product-stage"
              ref={stageRef}
              onMouseMove={handleStageMouseMove}
              onMouseLeave={handleStageMouseLeave}
            >
              <div className="landing-stage-aura" />
              <div className="landing-stage-ring landing-stage-ring-one" />
              <div className="landing-stage-ring landing-stage-ring-two" />

              <div className="landing-floating-card landing-ai-floating">
                <div className="floating-card-icon">
                  <Sparkles size={17} />
                </div>
                <div className="floating-card-content">
                  <strong>ZYRA Context Engine</strong>
                  <span>
                    {previewMode === "company"
                      ? "Connected: 4 Depts • 18 Tasks"
                      : "Personal Velocity: +24% this week"}
                  </span>
                </div>
                <span className="floating-live-dot" />
              </div>

              <div className="landing-floating-card landing-collaboration-floating">
                <div className="collaboration-avatars">
                  <span>A</span>
                  <span>M</span>
                  <span>+</span>
                </div>
                <div className="floating-card-content">
                  <strong>
                    {previewMode === "company"
                      ? "Role Permissions Active"
                      : "Solo Builder Mode"}
                  </strong>
                  <span>
                    {previewMode === "company"
                      ? "Org Admin • Team Leads synced"
                      : "Zero org setup required"}
                  </span>
                </div>
              </div>

              <div className="landing-floating-card landing-insight-floating">
                <div className="floating-insight-icon">
                  <BarChart3 size={16} />
                </div>
                <div className="floating-card-content">
                  <strong>Live AI Action</strong>
                  <span>
                    {previewMode === "company"
                      ? "Rebalanced Helix UI across Design Team"
                      : "Auto-scheduled Helix UX review"}
                  </span>
                </div>
              </div>

              <div
                className="landing-dashboard-window theater-dashboard-window"
                ref={dashboardRef}
              >
                <div className="dashboard-window-topbar">
                  <div className="dashboard-window-brand">
                    <div className="dashboard-mini-logo">Z</div>
                    <strong>ZYRA OS</strong>
                  </div>
                  <div className="dashboard-mode-switcher">
                    <button
                      type="button"
                      className={previewMode === "individual" ? "active" : ""}
                      onClick={() => setPreviewMode("individual")}
                    >
                      <User size={10} /> Individual Mode
                    </button>
                    <button
                      type="button"
                      className={previewMode === "company" ? "active" : ""}
                      onClick={() => setPreviewMode("company")}
                    >
                      <Building2 size={10} /> Company Org Mode
                    </button>
                  </div>
                  <div className="dashboard-window-actions">
                    <span className="window-action-dot" />
                    <div className="dashboard-user">
                      <span className="dashboard-user-avatar">A</span>
                      <span>
                        {previewMode === "company"
                          ? "Arsalan • Org Admin"
                          : "Arsalan • Independent"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-window-body">
                  <aside className="dashboard-mini-sidebar">
                    <div className="mini-sidebar-heading">
                      {previewMode === "company" ? "ORGANIZATION" : "WORKSPACE"}
                    </div>
                    <div className="mini-sidebar-link active">
                      <Layers3 size={14} /> Command
                    </div>
                    {previewMode === "company" && (
                      <div className="mini-sidebar-link">
                        <Building2 size={14} /> Departments
                      </div>
                    )}
                    <div className="mini-sidebar-link">
                      <FolderKanban size={14} /> Projects
                    </div>
                    <div className="mini-sidebar-link">
                      <CircleCheck size={14} /> Tasks
                    </div>
                    {previewMode === "company" && (
                      <div className="mini-sidebar-link">
                        <Users size={14} /> Teams
                      </div>
                    )}
                    <div className="mini-sidebar-heading mini-activity-heading">
                      PULSE
                    </div>
                    <div className="mini-sidebar-link">
                      <Clock3 size={14} /> Activity
                    </div>
                    <div className="mini-ai-link">
                      <Sparkles size={14} />
                      <span>Context AI</span>
                    </div>
                  </aside>

                  <div className="dashboard-mini-main">
                    <div className="dashboard-mini-header">
                      <div>
                        <span>
                          {previewMode === "company"
                            ? "ORGANIZATION → DEPARTMENTS → TEAMS → PROJECTS"
                            : "PERSONAL WORKSPACE → PROJECTS → AI CO-PILOT"}
                        </span>
                        <h3>
                          {previewMode === "company"
                            ? "Nexus Enterprise Ecosystem"
                            : "Arsalan's Personal Command"}{" "}
                          <span>⚡</span>
                        </h3>
                      </div>
                      <div className="dashboard-mini-avatar">A</div>
                    </div>

                    <div className="dashboard-mini-content">
                      <div className="dashboard-project-area">
                        <div className="mini-section-header">
                          <strong>Active Connected Projects</strong>
                          <span>Live Sync</span>
                        </div>
                        <div className="mini-project-grid">
                          <div className="mini-project-card cyan">
                            <div className="mini-project-top">
                              <strong>Project Nexus</strong>
                              <span>•••</span>
                            </div>
                            <div className="mini-project-meta">
                              <span>Velocity</span>
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
                                {previewMode === "company" && <span>M</span>}
                                {previewMode === "company" && <span>+</span>}
                              </div>
                              <span className="mini-status cyan-status">
                                On Track
                              </span>
                            </div>
                          </div>
                          <div className="mini-project-card blue">
                            <div className="mini-project-top">
                              <strong>Horizon Launch</strong>
                              <span>•••</span>
                            </div>
                            <div className="mini-project-meta">
                              <span>Velocity</span>
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
                                {previewMode === "company" && <span>M</span>}
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
                              <span>Velocity</span>
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
                                {previewMode === "company" && <span>+</span>}
                              </div>
                              <span className="mini-status purple-status">
                                Review
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mini-intelligence-panel">
                        <div className="mini-panel-title">
                          <strong>ZYRA AI Context</strong>
                          <Sparkles size={14} />
                        </div>
                        <span className="mini-panel-subtitle">
                          Real-Time Telemetry
                        </span>
                        <div className="mini-chart">
                          <svg viewBox="0 0 240 80" preserveAspectRatio="none">
                            <path
                              d="M0 62 C30 35 48 58 76 43 S120 58 150 29 S190 48 240 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            />
                          </svg>
                        </div>
                        <div className="mini-recommendations">
                          <strong>AI Auto-Actions</strong>
                          <span>Nexus milestone verified</span>
                          <span>Helix bottleneck resolved</span>
                        </div>
                      </div>

                      <div className="mini-bottom-panels">
                        <div className="mini-tasks-panel">
                          <div className="mini-section-header">
                            <strong>Workflow Stream</strong>
                            <span>Live</span>
                          </div>
                          <div className="mini-task">
                            <CheckCircle2 size={14} />
                            <span>Finalize Helix UX Review</span>
                            <small>Done</small>
                          </div>
                          <div className="mini-task">
                            <CircleCheck size={14} />
                            <span>Sync Department Roadmap</span>
                            <small>Active</small>
                          </div>
                        </div>
                        <div className="mini-team-panel">
                          <div className="mini-section-header">
                            <strong>Context Activity</strong>
                            <span>Pulse</span>
                          </div>
                          <div className="mini-feed-item">
                            <span className="feed-avatar">A</span>
                            <p>
                              <strong>Project Nexus</strong> synced with AI
                              analytics.
                            </p>
                          </div>
                          <div className="mini-feed-item">
                            <span className="feed-avatar purple-feed">AI</span>
                            <p>
                              Updated workload across{" "}
                              <strong>3 active teams</strong>.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STAGE 02: 3D ISOMETRIC LAYER STACK */}
        <section className="cinematic-section" id="features">
          <div className="cinematic-inner iso-wrapper">
            <div className="compact-stage-header iso-header-fix">
              <span className="landing-section-label"></span>
              <h2>
                Two distinct deployment models.
                <span className="block-span">
                  One unified intelligence core.
                </span>
              </h2>
            </div>

            <div className="zyra-iso-stage">
              {/* Card Container 1 (Not Clickable) */}
              <div className="iso-card-wrapper">
                <div className="iso-3d-stage">
                  <div className="iso-stack">
                    <div className="iso-data-stream cyan-stream" />
                    <div className="iso-layer iso-layer-3 cyan-layer">
                      <Sparkles size={16} /> <span>Personal AI Co-Pilot</span>
                    </div>
                    <div className="iso-layer iso-layer-2 cyan-layer">
                      <CircleCheck size={16} /> <span>Smart Task Sprints</span>
                    </div>
                    <div className="iso-layer iso-layer-1 cyan-layer">
                      <FolderKanban size={16} />{" "}
                      <span>Independent Workspace</span>
                    </div>
                    <div className="iso-base cyan-base" />
                  </div>
                </div>
                {/* The Button (Clickable) */}
                <button
                  type="button"
                  className="iso-action-btn cyan-iso-btn"
                  onClick={handleStartIndividual}
                >
                  Start with Individual <ArrowRight size={14} />
                </button>
              </div>

              {/* Card Container 2 (Not Clickable) */}
              <div className="iso-card-wrapper">
                <div className="iso-3d-stage">
                  <div className="iso-stack">
                    <div className="iso-data-stream purple-stream" />
                    <div className="iso-layer iso-layer-5 purple-layer">
                      <Brain size={16} /> <span>Organization Context AI</span>
                    </div>
                    <div className="iso-layer iso-layer-4 purple-layer">
                      <ShieldCheck size={16} />{" "}
                      <span>Role-Based Permissions</span>
                    </div>
                    <div className="iso-layer iso-layer-3 purple-layer">
                      <Users size={16} /> <span>Departments & Teams</span>
                    </div>
                    <div className="iso-layer iso-layer-2 purple-layer">
                      <Activity size={16} /> <span>Global Activity Stream</span>
                    </div>
                    <div className="iso-layer iso-layer-1 purple-layer">
                      <Building2 size={16} />{" "}
                      <span>Verified Organization Base</span>
                    </div>
                    <div className="iso-base purple-base" />
                  </div>
                </div>
                {/* The Button (Clickable) */}
                <button
                  type="button"
                  className="iso-action-btn purple-iso-btn"
                  onClick={handleStartCompany}
                >
                  Start with Company <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================
            STAGE 03: THE TELEMETRY RADAR
        ======================================================= */}
        <section className="cinematic-section" id="intelligence">
          <div className="cinematic-inner radar-intel-wrapper">
            <div className="compact-stage-header">
              <span className="landing-section-label"></span>
              <h2>
                Real-time context. <span>Continuous AI monitoring.</span>
              </h2>
            </div>

            <div className="radar-stage">
              {/* Left-side Terminal Output */}
              <div className="terminal-log">
                <div className="term-line">
                  &gt; ZYRA_OS: INITIALIZING NEURAL SWEEP...
                </div>
                <div className="term-line">
                  &gt; INGESTING 482 WORKSPACE NODES... [OK]
                </div>
                <div className="term-line">
                  &gt; CROSS-REFERENCING DEPARTMENT VELOCITY...
                </div>
                <div className="term-line">
                  &gt; DETECTED ANOMALY IN PROJECT NEXUS.
                </div>
                <div className="term-line highlight-term">
                  &gt; REBALANCING WORKLOAD HEURISTICS... [RESOLVED]
                </div>
                <div className="term-line">&gt; MONITORING...</div>
              </div>

              {/* Central 3D Radar Hologram */}
              <div className="radar-3d-container">
                <div className="radar-grid">
                  <div className="radar-circle rc-1"></div>
                  <div className="radar-circle rc-2"></div>
                  <div className="radar-circle rc-3"></div>
                  <div className="radar-crosshair-x"></div>
                  <div className="radar-crosshair-y"></div>
                  <div className="radar-sweep"></div>

                  {/* Radar Nodes (Counter-rotated in CSS to stand up) */}
                  <div className="radar-node node-a">
                    <span className="node-dot"></span>
                    <div className="node-tooltip">
                      <strong>Project Nexus</strong>
                      <span>Status: Optimized</span>
                    </div>
                  </div>

                  <div className="radar-node node-b">
                    <span className="node-dot warning-dot"></span>
                    <div className="node-tooltip warning-tooltip">
                      <strong>Design Dept</strong>
                      <span>Alert: Capacity at 95%</span>
                    </div>
                  </div>

                  <div className="radar-node node-c">
                    <span className="node-dot"></span>
                    <div className="node-tooltip">
                      <strong>Helix UX</strong>
                      <span>Action: Auto-Scheduled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hud-evolution-bar">
              {EVOLUTION_STEPS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.title} className="hud-evo-group">
                    <div
                      className={`hud-evo-pill ${item.active ? "active" : ""} ${item.future ? "future" : ""}`}
                    >
                      <IconComponent size={14} />
                      <small>{item.step}</small>
                      <strong>{item.title}</strong>
                    </div>
                    {idx < EVOLUTION_STEPS.length - 1 && (
                      <ArrowRight size={13} className="hud-evo-arrow" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* STAGE 04 */}
        <section className="cinematic-section" id="vision">
          <div className="cinematic-inner landing-vision-section">
            <div className="vision-orbit vision-orbit-one" />
            <div className="vision-orbit vision-orbit-two" />

            <div className="vision-finale-stack">
              <div className="vision-kinetic-title">
                <div className="landing-section-label"></div>
                <h2>
                  Plan. <span>Collaborate.</span> Build. <span>Evolve.</span>
                </h2>
              </div>

              <div className="holo-portals-grid">
                {/* Individual Card Container (Not Clickable) */}
                <div className="holo-portal-card cyan-portal">
                  <div className="portal-orb-glow" />
                  <div className="portal-icon">
                    <User size={24} />
                  </div>
                  <span className="portal-eyebrow">01 // SOLO BUILDERS</span>
                  <h3>Start with Individual</h3>
                  <div className="portal-tags">
                    <span>Personal Projects</span>
                    <span>•</span>
                    <span>Smart Tasks</span>
                    <span>•</span>
                    <span>Personal AI</span>
                  </div>
                  {/* The Button (Clickable) */}
                  <button
                    type="button"
                    className="portal-launch-btn"
                    onClick={handleStartIndividual}
                  >
                    Start with Individual <ArrowRight size={16} />
                  </button>
                </div>

                {/* Company Card Container (Not Clickable) */}
                <div className="holo-portal-card purple-portal">
                  <div className="portal-orb-glow" />
                  <div className="portal-icon">
                    <Building2 size={24} />
                  </div>
                  <span className="portal-eyebrow">02 // ORGANIZATIONS</span>
                  <h3>Start with Company</h3>
                  <div className="portal-tags">
                    <span>Verified Org</span>
                    <span>•</span>
                    <span>Depts & Teams</span>
                    <span>•</span>
                    <span>Role Shield</span>
                  </div>
                  {/* The Button (Clickable) */}
                  <button
                    type="button"
                    className="portal-launch-btn"
                    onClick={handleStartCompany}
                  >
                    Start with Company <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <footer className="landing-footer">
                <div className="landing-footer-brand">
                  <div className="footer-logo-mark">Z</div>
                  <div>
                    <strong>ZYRA</strong>
                    <span>Intelligent Project Workspace</span>
                  </div>
                </div>
                <div className="landing-footer-tagline">
                  Your work. Connected intelligently.
                </div>
                <div className="landing-footer-copy">© 2026 ZYRA</div>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Landing;
