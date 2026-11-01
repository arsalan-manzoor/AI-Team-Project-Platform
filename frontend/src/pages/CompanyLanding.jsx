import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import "../styles/company.css";

import {
  ArrowRight,
  ArrowLeft,
  Target,
  FolderKanban,
  Users,
  CheckSquare,
  Workflow,
  Share2,
  RefreshCcw,
  LayoutGrid,
  ShieldAlert,
  Zap,
  ShieldCheck,
  FileKey,
  Globe2,
  Building2,
  Infinity as InfinityIcon,
  BarChart4,
  BrainCircuit,
  Lock,
  Database,
  UserCheck,
  FileCheck,
  Activity,
  Network,
  Layers,
  Terminal,
  Sparkles,
  KeyRound,
  Radar,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const NAV_SECTIONS = [
  { id: "comp-gate", num: "01", label: "Firewall Gate" },
  { id: "comp-nexus", num: "02", label: "Neural Core" },
  { id: "comp-radar", num: "03", label: "AI Radar" },
  { id: "comp-vault", num: "04", label: "The Vault" },
  { id: "comp-scale", num: "05", label: "Scale Engine" },
];

function CompanyLanding() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const lenisRef = useRef(null);
  const [activeSection, setActiveSection] = useState(0);

  // =========================================================
  // SMOOTH SCROLL — LENIS + GSAP
  // =========================================================
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.3,
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

  // =========================================================
  // SECTION SCROLL
  // =========================================================
  const scrollToSection = (id) => {
    const el = document.getElementById(id);

    if (!el) return;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, {
        offset: 0,
        duration: 1.4,
      });
    } else {
      el.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  // =========================================================
  // MASTER SCROLL-DRIVEN CHOREOGRAPHY
  // =========================================================
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // -------------------------------------------------------
      // TOP SCROLL PROGRESS BAR
      // -------------------------------------------------------
      gsap.to(".comp-progress-bar", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.15,
        },
      });

      // -------------------------------------------------------
      // INITIAL FIREWALL GATE ENTRANCE
      // -------------------------------------------------------
      const introTl = gsap.timeline();

      introTl
        .fromTo(
          ".gate-lock-assembly",
          {
            scale: 0.6,
            opacity: 0,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 1,
            ease: "back.out(1.4)",
          },
          0.2,
        )
        .fromTo(
          ".gate-hud-prompt",
          {
            y: 20,
            opacity: 0,
          },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
          },
          0.5,
        )
        .fromTo(
          ".gate-Warning-strips",
          {
            opacity: 0,
          },
          {
            opacity: 1,
            duration: 0.8,
          },
          0.4,
        );

      const mm = gsap.matchMedia();

      mm.add("(min-width: 901px)", () => {
        // =====================================================
        // SECTION 01
        // FIREWALL GATE → COMMAND NEXUS
        // =====================================================
        const gateTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#comp-gate",
            start: "top top",
            end: "+=170%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(0);
              }
            },
          },
        });

        gateTl
          .to(
            ".lock-outer-ring",
            {
              rotate: 180,
              scale: 1.25,
              borderColor: "#22d3ee",
              duration: 0.45,
              ease: "power2.inOut",
            },
            0,
          )
          .to(
            ".lock-inner-core",
            {
              rotate: -180,
              scale: 0.85,
              boxShadow: "0 0 60px #22d3ee",
              duration: 0.45,
              ease: "power2.inOut",
            },
            0,
          )
          .to(
            ".gate-lock-assembly, .gate-hud-prompt",
            {
              scale: 1.5,
              opacity: 0,
              filter: "blur(10px)",
              duration: 0.35,
              ease: "power2.in",
            },
            0.38,
          )
          .fromTo(
            ".gate-laser-seam",
            {
              scaleY: 0.2,
              opacity: 0.4,
            },
            {
              scaleY: 1,
              opacity: 1,
              boxShadow: "0 0 90px 20px #22d3ee",
              duration: 0.25,
            },
            0.25,
          )
          .to(
            ".gate-laser-seam",
            {
              opacity: 0,
              duration: 0.2,
            },
            0.55,
          )
          .to(
            ".firewall-door-left",
            {
              xPercent: -102,
              duration: 0.85,
              ease: "power3.inOut",
            },
            0.42,
          )
          .to(
            ".firewall-door-right",
            {
              xPercent: 102,
              duration: 0.85,
              ease: "power3.inOut",
            },
            0.42,
          )
          .fromTo(
            ".nexus-revealed-stage",
            {
              scale: 0.78,
              opacity: 0.15,
              filter: "blur(12px)",
            },
            {
              scale: 1,
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.85,
              ease: "power3.out",
            },
            0.42,
          )
          .fromTo(
            ".holo-slab",
            {
              z: -220,
              y: 60,
              opacity: 0,
            },
            {
              z: 0,
              y: 0,
              opacity: 1,
              stagger: 0.1,
              duration: 0.65,
              ease: "back.out(1.4)",
            },
            0.6,
          );

        // =====================================================
        // SECTION 02
        // NEURAL CORE
        // =====================================================
        const nexusTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#comp-nexus",
            start: "top top",
            end: "+=140%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(1);
              }
            },
          },
        });

        nexusTl
          .fromTo(
            ".s2-copy-col",
            {
              x: -70,
              opacity: 0,
            },
            {
              x: 0,
              opacity: 1,
              duration: 0.5,
            },
            0,
          )
          .fromTo(
            ".reactor-core-hub",
            {
              scale: 0.4,
              opacity: 0,
            },
            {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              ease: "back.out(1.6)",
            },
            0.15,
          )
          .fromTo(
            ".circuit-glow-path",
            {
              strokeDashoffset: 320,
            },
            {
              strokeDashoffset: 0,
              stagger: 0.1,
              duration: 0.7,
              ease: "none",
            },
            0.3,
          )
          .fromTo(
            ".dept-terminal-card",
            {
              scale: 0.82,
              opacity: 0,
              y: 30,
            },
            {
              scale: 1,
              opacity: 1,
              y: 0,
              stagger: 0.14,
              duration: 0.55,
              ease: "power3.out",
            },
            0.45,
          );

        // =====================================================
        // SECTION 03
        // AI RADAR ORCHESTRATOR
        // =====================================================
        const radarTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#comp-radar",
            start: "top top",
            end: "+=140%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(2);
              }
            },
          },
        });

        radarTl
          .fromTo(
            ".s3-copy-col",
            {
              x: -70,
              opacity: 0,
            },
            {
              x: 0,
              opacity: 1,
              duration: 0.5,
            },
            0,
          )
          .fromTo(
            ".gantt-matrix-board",
            {
              rotateY: -18,
              opacity: 0,
              scale: 0.9,
            },
            {
              rotateY: 0,
              opacity: 1,
              scale: 1,
              duration: 0.6,
            },
            0.15,
          )
          .fromTo(
            ".radar-laser-sweep",
            {
              left: "4%",
            },
            {
              left: "92%",
              duration: 1.1,
              ease: "none",
            },
            0.35,
          )
          .fromTo(
            ".gantt-conflict-node",
            {
              scale: 0.5,
              opacity: 0,
            },
            {
              scale: 1,
              opacity: 1,
              duration: 0.3,
              ease: "back.out(2)",
            },
            0.75,
          )
          .fromTo(
            ".bottleneck-modal-card",
            {
              y: 50,
              x: 30,
              opacity: 0,
              scale: 0.85,
            },
            {
              y: 0,
              x: 0,
              opacity: 1,
              scale: 1,
              duration: 0.5,
              ease: "back.out(1.6)",
            },
            0.82,
          );

        // =====================================================
        // SECTION 04
        // THE QUANTUM VAULT
        // =====================================================
        const vaultTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#comp-vault",
            start: "top top",
            end: "+=140%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(3);
              }
            },
          },
        });

        vaultTl
          .fromTo(
            ".s4-copy-col",
            {
              x: -70,
              opacity: 0,
            },
            {
              x: 0,
              opacity: 1,
              duration: 0.5,
            },
            0,
          )
          .fromTo(
            ".vault-mech-ring.r-outer",
            {
              rotate: -120,
              scale: 0.7,
              opacity: 0,
            },
            {
              rotate: 0,
              scale: 1,
              opacity: 1,
              duration: 0.8,
            },
            0.15,
          )
          .fromTo(
            ".vault-mech-ring.r-mid",
            {
              rotate: 120,
              scale: 0.7,
              opacity: 0,
            },
            {
              rotate: 0,
              scale: 1,
              opacity: 1,
              duration: 0.8,
            },
            0.25,
          )
          .fromTo(
            ".vault-center-shield",
            {
              scale: 0,
              opacity: 0,
            },
            {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              ease: "back.out(1.7)",
            },
            0.4,
          )
          .fromTo(
            ".vault-orbit-pill",
            {
              scale: 0.6,
              opacity: 0,
            },
            {
              scale: 1,
              opacity: 1,
              stagger: 0.1,
              duration: 0.45,
              ease: "back.out(1.4)",
            },
            0.55,
          );

        // =====================================================
        // SECTION 05
        // SCALE ENGINE
        // =====================================================
        const scaleTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#comp-scale",
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(4);
              }
            },
          },
        });

        scaleTl
          .fromTo(
            ".s5-copy-col",
            {
              x: -60,
              opacity: 0,
            },
            {
              x: 0,
              opacity: 1,
              duration: 0.6,
            },
            0,
          )
          .fromTo(
            ".spire-tower",
            {
              scaleY: 0,
              transformOrigin: "bottom center",
            },
            {
              scaleY: 1,
              stagger: 0.06,
              duration: 0.7,
              ease: "power3.out",
            },
            0.15,
          )
          .fromTo(
            ".spire-z-crown",
            {
              y: 40,
              opacity: 0,
              scale: 0.7,
            },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.6,
              ease: "back.out(1.6)",
            },
            0.5,
          )
          .fromTo(
            ".s5-right-pill",
            {
              x: 50,
              opacity: 0,
            },
            {
              x: 0,
              opacity: 1,
              stagger: 0.1,
              duration: 0.5,
            },
            0.4,
          );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="comp-v2-page" ref={containerRef}>
      {/* =========================================================
          TOP LASER PROGRESS BAR
      ========================================================= */}
      <div className="comp-progress-bar" aria-hidden="true" />

      {/* =========================================================
          RIGHT-HAND SECTION HUD
      ========================================================= */}
      <aside className="comp-hud-nav" aria-label="Section navigation">
        {NAV_SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            className={`comp-hud-item ${activeSection === idx ? "active" : ""}`}
            onClick={() => scrollToSection(sec.id)}
          >
            <span className="hud-num">{sec.num}</span>
            <span className="hud-label">{sec.label}</span>
            <span className="hud-pip" />
          </button>
        ))}
      </aside>

      {/* =========================================================
          SOLID DEEP-OBSIDIAN AMBIENT LIGHTING
      ========================================================= */}
      <div className="comp-solid-ambience" aria-hidden="true">
        <div className="ambient-glow glow-cyan" />
        <div className="ambient-glow glow-purple" />
      </div>

      {/* =========================================================
          TOP ENTERPRISE NAVBAR
      ========================================================= */}
      <header className="comp-top-navbar">
        <button
          type="button"
          className="ctn-brand"
          onClick={() => navigate("/")}
        >
          <span className="ctn-logo-z">Z</span>
          <strong>ZYRA</strong>
          <span className="ctn-badge">COMPANY OS</span>
        </button>

        <nav className="ctn-links">
          <button
            type="button"
            className={activeSection === 0 ? "active" : ""}
            onClick={() => scrollToSection("comp-gate")}
          >
            Command
          </button>

          <button
            type="button"
            className={activeSection === 1 ? "active" : ""}
            onClick={() => scrollToSection("comp-nexus")}
          >
            Ecosystem
          </button>

          <button
            type="button"
            className={activeSection === 2 ? "active" : ""}
            onClick={() => scrollToSection("comp-radar")}
          >
            AI Radar
          </button>

          <button
            type="button"
            className={activeSection === 3 ? "active" : ""}
            onClick={() => scrollToSection("comp-vault")}
          >
            The Vault
          </button>

          <button
            type="button"
            className={activeSection === 4 ? "active" : ""}
            onClick={() => scrollToSection("comp-scale")}
          >
            Scale
          </button>
        </nav>

        <div className="ctn-actions">
          {/* BACK TO INDIVIDUAL */}
          <button
            type="button"
            className="ctn-ghost-btn"
            onClick={() => navigate("/individual")}
          >
            <ArrowLeft size={13} />
            Individual
          </button>

          {/* COMPANY SIGN IN */}
          <button
            type="button"
            className="ctn-signin-btn"
            onClick={() => navigate("/company/login")}
          >
            Sign In
          </button>

          {/* COMPANY SIGN UP */}
          <button
            type="button"
            className="ctn-primary-btn"
            onClick={() => navigate("/company/signup")}
          >
            Start with Company
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main>
        {/* =========================================================
            SECTION 01
            THE FIREWALL GATE → COMMAND NEXUS
        ========================================================= */}
        <section id="comp-gate" className="comp-pinned-stage">
          <div className="nexus-revealed-stage">
            <div className="comp-grid-2col">
              {/* LEFT COPY */}
              <div className="nexus-hero-copy">
                <div className="comp-eyebrow">
                  <span className="eyebrow-num">01</span>
                  <span className="eyebrow-sep">·</span>
                  THE COMMAND NEXUS
                </div>

                <h1 className="comp-display-title">
                  YOUR COMPANY.
                  <br />
                  <span className="grad-cyan-purple">ONE INTELLIGENT</span>
                  <br />
                  <span className="grad-cyan-purple">SYSTEM.</span>
                </h1>

                <p className="comp-lead-copy">
                  Your entire company, operating as one engine. Projects, teams,
                  people, goals and AI — all connected in a single intelligent
                  workspace.
                </p>

                <div className="comp-cta-row">
                  <button
                    type="button"
                    className="btn-zyra-cyan"
                    onClick={() => navigate("/company/signup")}
                  >
                    Book a Demo
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="btn-zyra-outline"
                    onClick={() => navigate("/company/signup")}
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>

              {/* RIGHT VISUAL */}
              <div className="nexus-3d-chamber">
                <div className="holo-stack-wrapper">
                  <div className="holo-vertical-beam" />

                  <div className="holo-slab slab-1">
                    <div className="slab-inner">
                      <span className="slab-icon">
                        <Target size={16} />
                      </span>
                      <strong>COMPANY GOALS</strong>
                      <span className="slab-tag">
                        Vision → Strategy → Execution
                      </span>
                    </div>
                  </div>

                  <div className="holo-slab slab-2">
                    <div className="slab-inner">
                      <span className="slab-icon">
                        <FolderKanban size={16} />
                      </span>
                      <strong>PROJECTS</strong>
                      <span className="slab-metric">12 Active Roadmaps</span>
                    </div>
                  </div>

                  <div className="holo-slab slab-3">
                    <div className="slab-inner">
                      <span className="slab-icon">
                        <Users size={16} />
                      </span>
                      <strong>TEAMS</strong>
                      <span className="slab-metric">
                        8 Cross-Functional Squads
                      </span>
                    </div>
                  </div>

                  <div className="holo-slab slab-4">
                    <div className="slab-inner">
                      <span className="slab-icon">
                        <CheckSquare size={16} />
                      </span>
                      <strong>TASKS</strong>
                      <span className="slab-metric">248 Live Executions</span>
                    </div>
                  </div>

                  <div className="holo-pedestal-ring" />
                </div>

                <div className="nexus-overview-card">
                  <h4>Company Overview</h4>

                  <div className="noc-item">
                    <span className="dot cyan" />
                    <strong>12</strong> Projects
                  </div>

                  <div className="noc-item">
                    <span className="dot purple" />
                    <strong>8</strong> Teams
                  </div>

                  <div className="noc-item">
                    <span className="dot blue" />
                    <strong>96</strong> Members
                  </div>

                  <div className="noc-item">
                    <span className="dot cyan" />
                    <strong>248</strong> Tasks
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FIREWALL OVERLAY */}
          <div className="firewall-gate-overlay" aria-hidden="true">
            <div className="firewall-door firewall-door-left">
              <div className="door-tech-grid" />
              <div className="door-diagonal-ribs" />

              <div className="door-status-readout">
                <span>SYS.FIREWALL // SECTOR 01</span>
                <strong>ENCRYPTION: AES-256-GCM</strong>
              </div>

              <div className="door-edge-clamp clamp-top" />
              <div className="door-edge-clamp clamp-bottom" />
            </div>

            <div className="firewall-door firewall-door-right">
              <div className="door-tech-grid" />
              <div className="door-diagonal-ribs" />

              <div className="door-status-readout right-readout">
                <span>CLEARANCE: ENTERPRISE</span>
                <strong>QUANTUM LOCK ENGAGED</strong>
              </div>

              <div className="door-edge-clamp clamp-top" />
              <div className="door-edge-clamp clamp-bottom" />
            </div>

            <div className="gate-laser-seam" />

            <div className="gate-lock-assembly">
              <div className="lock-outer-ring" />
              <div className="lock-Segmented-ring" />

              <div className="lock-inner-core">
                <KeyRound size={28} />
                <span>ZYRA OS</span>
              </div>
            </div>

            <div className="gate-hud-prompt">
              <span className="prompt-pulse-dot" />
              SCROLL TO BREACH FIREWALL &amp; ENTER COMMAND NEXUS
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 02
            COMPANY IN MOTION
        ========================================================= */}
        <section id="comp-nexus" className="comp-pinned-stage">
          <div className="comp-grid-2col">
            <div className="s2-copy-col">
              <div className="comp-eyebrow">
                <span className="eyebrow-num">02</span>
                <span className="eyebrow-sep">·</span>
                COMPANY IN MOTION
              </div>

              <h2 className="comp-section-title">
                Different teams.
                <br />
                <span className="grad-cyan-purple">One source of truth.</span>
              </h2>

              <p className="comp-lead-copy">
                Engineering, Design, Marketing and Operations — all working
                together, with real-time updates, shared context and complete
                visibility.
              </p>

              <div className="comp-feature-stack">
                <div className="cfs-row">
                  <span className="cfs-icon">
                    <Workflow size={15} />
                  </span>
                  Department Workflows
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <Share2 size={15} />
                  </span>
                  Shared Projects &amp; Tasks
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <RefreshCcw size={15} />
                  </span>
                  Real-time Collaboration
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <LayoutGrid size={15} />
                  </span>
                  Unified Workspace
                </div>
              </div>
            </div>

            <div className="s2-visual-col">
              <div className="neural-router-stage">
                <svg
                  className="router-svg-circuits"
                  viewBox="0 0 600 440"
                  fill="none"
                >
                  <path className="circuit-base-path" d="M300 220 L130 95" />
                  <path className="circuit-base-path" d="M300 220 L470 95" />
                  <path className="circuit-base-path" d="M300 220 L130 345" />
                  <path className="circuit-base-path" d="M300 220 L470 345" />

                  <path
                    className="circuit-glow-path cyan-stroke"
                    d="M300 220 L130 95"
                  />

                  <path
                    className="circuit-glow-path purple-stroke"
                    d="M300 220 L470 95"
                  />

                  <path
                    className="circuit-glow-path blue-stroke"
                    d="M300 220 L130 345"
                  />

                  <path
                    className="circuit-glow-path cyan-stroke"
                    d="M300 220 L470 345"
                  />
                </svg>

                <div className="reactor-core-hub">
                  <div className="reactor-ring r-a" />
                  <div className="reactor-ring r-b" />

                  <div className="reactor-hex">
                    <strong>ZYRA</strong>
                    <small>CORE BUS</small>
                  </div>
                </div>

                <div className="dept-terminal-card dt-tl">
                  <div className="dtc-header">
                    <span className="dtc-badge cyan">
                      <Terminal size={13} />
                    </span>

                    <strong>Engineering</strong>
                    <span className="dtc-live">SYNCED</span>
                  </div>

                  <div className="dtc-mock-bars">
                    <div className="m-bar w-80 cyan-fill" />
                    <div className="m-bar w-60 purple-fill" />
                  </div>

                  <span className="dtc-foot">Agile Board &amp; CI/CD</span>
                </div>

                <div className="dept-terminal-card dt-tr">
                  <div className="dtc-header">
                    <span className="dtc-badge purple">
                      <Layers size={13} />
                    </span>

                    <strong>Design</strong>
                    <span className="dtc-live">SYNCED</span>
                  </div>

                  <div className="dtc-swatches">
                    <span className="sw s1" />
                    <span className="sw s2" />
                    <span className="sw s3" />
                  </div>

                  <span className="dtc-foot">Creative Pipeline</span>
                </div>

                <div className="dept-terminal-card dt-bl">
                  <div className="dtc-header">
                    <span className="dtc-badge blue">
                      <BarChart4 size={13} />
                    </span>

                    <strong>Marketing</strong>
                    <span className="dtc-live">SYNCED</span>
                  </div>

                  <div className="dtc-mock-bars">
                    <div className="m-bar w-90 blue-fill" />
                    <div className="m-bar w-50 cyan-fill" />
                  </div>

                  <span className="dtc-foot">Campaign Timeline</span>
                </div>

                <div className="dept-terminal-card dt-br">
                  <div className="dtc-header">
                    <span className="dtc-badge cyan">
                      <Activity size={13} />
                    </span>

                    <strong>Operations</strong>
                    <span className="dtc-live">SYNCED</span>
                  </div>

                  <div className="dtc-mock-bars">
                    <div className="m-bar w-75 cyan-fill" />
                    <div className="m-bar w-85 purple-fill" />
                  </div>

                  <span className="dtc-foot">Operations Hub</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 03
            AI ORCHESTRATOR
        ========================================================= */}
        <section id="comp-radar" className="comp-pinned-stage">
          <div className="comp-grid-2col">
            <div className="s3-copy-col">
              <div className="comp-eyebrow">
                <span className="eyebrow-num">03</span>
                <span className="eyebrow-sep">·</span>
                AI ORCHESTRATOR
              </div>

              <h2 className="comp-section-title">
                AI that doesn’t just assist —
                <br />
                <span className="grad-cyan-purple">it manages the gaps.</span>
              </h2>

              <p className="comp-lead-copy">
                ZYRA’s AI understands your entire workspace — spotting risks,
                finding opportunities and keeping projects on track before
                deadlines slip.
              </p>

              <div className="comp-feature-stack">
                <div className="cfs-row">
                  <span className="cfs-icon">
                    <Network size={15} />
                  </span>
                  Dependency Analysis
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <ShieldAlert size={15} />
                  </span>
                  Risk Detection
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <Sparkles size={15} />
                  </span>
                  Smart Recommendations
                </div>

                <div className="cfs-row">
                  <span className="cfs-icon">
                    <Zap size={15} />
                  </span>
                  Automated Actions
                </div>
              </div>
            </div>

            <div className="s3-visual-col">
              <div className="radar-orchestrator-stage">
                <div className="gantt-matrix-board">
                  <div className="gmb-topbar">
                    <span>
                      <Radar size={13} /> LIVE DEPENDENCY MATRIX
                    </span>

                    <span className="gmb-tag">AI TELEMETRY ACTIVE</span>
                  </div>

                  <div className="gmb-rows">
                    <div className="gmb-row">
                      <span className="gmb-label">UI Design</span>

                      <div className="gmb-track">
                        <div
                          className="gmb-pill pill-cyan"
                          style={{
                            width: "48%",
                            left: "4%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="gmb-row">
                      <span className="gmb-label">Backend API</span>

                      <div className="gmb-track">
                        <div
                          className="gmb-pill pill-conflict"
                          style={{
                            width: "52%",
                            left: "34%",
                          }}
                        >
                          <span className="gantt-conflict-node">!</span>
                        </div>
                      </div>
                    </div>

                    <div className="gmb-row">
                      <span className="gmb-label">Frontend</span>

                      <div className="gmb-track">
                        <div
                          className="gmb-pill pill-purple"
                          style={{
                            width: "44%",
                            left: "46%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="gmb-row">
                      <span className="gmb-label">Testing</span>

                      <div className="gmb-track">
                        <div
                          className="gmb-pill pill-blue"
                          style={{
                            width: "36%",
                            left: "58%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="gmb-row">
                      <span className="gmb-label">Deployment</span>

                      <div className="gmb-track">
                        <div
                          className="gmb-pill pill-cyan"
                          style={{
                            width: "28%",
                            left: "70%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="radar-laser-sweep">
                      <span className="laser-badge">AI SCAN</span>
                    </div>
                  </div>
                </div>

                <div className="bottleneck-modal-card">
                  <div className="bmc-head">
                    <span className="bmc-warn-icon">
                      <ShieldAlert size={16} />
                    </span>

                    <strong>Bottleneck Detected</strong>
                  </div>

                  <p className="bmc-desc">
                    UI Design is delaying Backend API integration by 48 hours.
                  </p>

                  <div className="bmc-rec-box">
                    <small>Recommended Action</small>
                    <strong>Reallocate 1 designer for 2 days.</strong>
                  </div>

                  <div className="bmc-actions">
                    <button type="button" className="bmc-btn-apply">
                      Apply Recommendation
                    </button>

                    <button type="button" className="bmc-btn-ghost">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 04
            THE VAULT
        ========================================================= */}
        <section id="comp-vault" className="comp-pinned-stage">
          <div className="comp-grid-2col">
            <div className="s4-copy-col">
              <div className="comp-eyebrow">
                <span className="eyebrow-num">04</span>
                <span className="eyebrow-sep">·</span>
                THE VAULT
              </div>

              <h2 className="comp-section-title">
                TOTAL CONTROL.
                <br />
                <span className="grad-cyan-purple">ZERO BLIND SPOTS.</span>
              </h2>

              <p className="comp-lead-copy">
                Enterprise-grade security, compliance and governance — built in
                from the ground up for organizations that cannot compromise.
              </p>

              <div className="vault-bento-mini">
                <div className="vbm-item">
                  <UserCheck size={16} />
                  <span>Role-Based Access Control (RBAC)</span>
                </div>

                <div className="vbm-item">
                  <Globe2 size={16} />
                  <span>SSO / SAML Integration</span>
                </div>

                <div className="vbm-item">
                  <FileKey size={16} />
                  <span>AES-256 Encryption</span>
                </div>

                <div className="vbm-item">
                  <FileCheck size={16} />
                  <span>Audit Logs &amp; Compliance</span>
                </div>

                <div className="vbm-item">
                  <ShieldCheck size={16} />
                  <span>Workspace Governance</span>
                </div>

                <div className="vbm-item">
                  <Lock size={16} />
                  <span>Granular Permissions</span>
                </div>
              </div>
            </div>

            <div className="s4-visual-col">
              <div className="quantum-vault-dial">
                <div className="vault-mech-ring r-outer" />
                <div className="vault-mech-ring r-mid" />
                <div className="vault-mech-ring r-inner" />

                <div className="vault-crosshair-h" />
                <div className="vault-crosshair-v" />

                <div className="vault-center-shield">
                  <Lock size={34} />
                  <span>AES-256</span>
                </div>

                <div className="vault-orbit-pill vop-1">
                  <UserCheck size={13} />
                  IDENTITY
                </div>

                <div className="vault-orbit-pill vop-2">
                  <KeyRound size={13} />
                  ACCESS
                </div>

                <div className="vault-orbit-pill vop-3">
                  <Database size={13} />
                  DATA
                </div>

                <div className="vault-orbit-pill vop-4">
                  <FileCheck size={13} />
                  AUDIT
                </div>

                <div className="vault-orbit-pill vop-5">
                  <ShieldCheck size={13} />
                  GOVERNANCE
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 05
            SCALE ENGINE
        ========================================================= */}
        <section id="comp-scale" className="comp-pinned-stage">
          <div className="scale-horizon-grid" aria-hidden="true" />

          <div className="comp-grid-3col">
            <div className="s5-copy-col">
              <div className="comp-eyebrow">
                <span className="eyebrow-num">05</span>
                <span className="eyebrow-sep">·</span>
                SCALE ENGINE
              </div>

              <h2 className="comp-section-title">
                SCALE YOUR AMBITION.
                <br />
                <span className="grad-cyan-purple">NOT YOUR CHAOS.</span>
              </h2>

              <p className="comp-lead-copy">
                From growing teams to global enterprises, ZYRA scales with you —
                without the complexity.
              </p>

              <div className="comp-cta-row">
                <button
                  type="button"
                  className="btn-zyra-cyan"
                  onClick={() => navigate("/company/signup")}
                >
                  Talk to Sales
                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  className="btn-zyra-outline"
                  onClick={() => navigate("/company/signup")}
                >
                  Deploy ZYRA
                </button>
              </div>
            </div>

            {/* CENTER CITADEL */}
            <div className="s5-citadel-col">
              <div className="citadel-monolith-stage">
                <div className="spire-z-crown">
                  <span className="crown-z">Z</span>
                  <strong>ZYRA</strong>
                </div>

                <div className="citadel-spires">
                  <div className="spire-tower t-1" />
                  <div className="spire-tower t-2" />
                  <div className="spire-tower t-3" />
                  <div className="spire-tower t-center" />
                  <div className="spire-tower t-4" />
                  <div className="spire-tower t-5" />
                  <div className="spire-tower t-6" />
                </div>

                <div className="citadel-orbital-ring" />
                <div className="citadel-base-flare" />
              </div>
            </div>

            {/* RIGHT CAPABILITIES */}
            <div className="s5-Capabilities-col">
              <div className="s5-right-pill">
                <Globe2 size={16} />
                Global Teams
              </div>

              <div className="s5-right-pill">
                <Building2 size={16} />
                Multiple Departments
              </div>

              <div className="s5-right-pill">
                <InfinityIcon size={16} />
                Unlimited Projects
              </div>

              <div className="s5-right-pill">
                <BarChart4 size={16} />
                Advanced Analytics
              </div>

              <div className="s5-right-pill">
                <BrainCircuit size={16} />
                AI-Powered Intelligence
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <footer className="comp-bottom-bar">
            <div className="cbb-left">
              <strong>ZYRA</strong>
              <span>Build · Collaborate · Evolve</span>
            </div>

            <div className="cbb-right">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Security</span>
              <span>© 2026 ZYRA OS</span>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default CompanyLanding;
