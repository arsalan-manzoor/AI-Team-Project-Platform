import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import "../styles/individual.css";

import {
  FolderKanban,
  CheckSquare,
  Sparkles,
  LayoutDashboard,
  Activity,
  MonitorSmartphone,
  User,
  Plus,
  Rocket,
  Target,
  Zap,
  ShieldCheck,
  Columns,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  Clock3,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const NAV_SECTIONS = [
  { id: "ind-hero", num: "01", label: "Workspace" },
  { id: "ind-features", num: "02", label: "Features" },
  { id: "ind-steps", num: "03", label: "How It Works" },
  { id: "ind-ambitions", num: "04", label: "Why ZYRA" },
  { id: "ind-cta", num: "05", label: "Launch" },
];

const FEATURES = [
  {
    icon: FolderKanban,
    title: "Project Management",
    desc: "Plan, organize and track your projects effortlessly.",
    tag: "LIVE SYNC",
  },
  {
    icon: LayoutDashboard,
    title: "Personal Dashboard",
    desc: "See your progress, stay focused and celebrate milestones.",
    tag: "COMMAND",
  },
  {
    icon: CheckSquare,
    title: "Smart Task Management",
    desc: "Keep your tasks, deadlines and priorities in check.",
    tag: "WORKFLOW",
  },
  {
    icon: Activity,
    title: "Activity & Insights",
    desc: "Track what matters, understand your patterns, improve over time.",
    tag: "TELEMETRY",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    desc: "Get intelligent suggestions, insights and help — anytime.",
    tag: "NEURAL AI",
  },
  {
    icon: MonitorSmartphone,
    title: "Cross-Device Access",
    desc: "Work from anywhere, on any device, seamlessly.",
    tag: "CLOUD OS",
  },
];

const STEPS = [
  {
    num: "01",
    icon: User,
    title: "1. Sign Up",
    desc: "Create your account in seconds.",
    preview: "Account verified • Solo profile ready",
  },
  {
    num: "02",
    icon: Plus,
    title: "2. Set Up",
    desc: "Create your workspace and add your projects.",
    preview: "Workspace initialized • 3 projects linked",
  },
  {
    num: "03",
    icon: Rocket,
    title: "3. Get Productive",
    desc: "Organize tasks, collaborate and make progress.",
    preview: "Sprint velocity +34% • 0 bottlenecks",
  },
  {
    num: "04",
    icon: Sparkles,
    title: "4. Let AI Help",
    desc: "Receive smart suggestions, insights and support.",
    preview: "AI Co-Pilot active • Next priority queued",
  },
];

const AMBITIONS = [
  {
    icon: Target,
    title: "Focus",
    desc: "Less chaos. More clarity.",
    metric: "99.4%",
  },
  {
    icon: Zap,
    title: "Productivity",
    desc: "Work smarter, not harder.",
    metric: "3.2x",
  },
  {
    icon: User,
    title: "Personalized",
    desc: "Built for your goals, your way.",
    metric: "100%",
  },
  {
    icon: ShieldCheck,
    title: "Secure",
    desc: "Your data, your control.",
    metric: "AES-256",
  },
  {
    icon: Columns,
    title: "Modern UI",
    desc: "A clean, beautiful experience.",
    metric: "60 FPS",
  },
  {
    icon: RefreshCcw,
    title: "Always Evolving",
    desc: "New features, smarter tools, for you.",
    metric: "24/7",
  },
];

function IndividualLanding() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const lenisRef = useRef(null);

  const [activeSection, setActiveSection] = useState(0);

  // =========================================================
  // SCROLL RESTORATION FIX
  // =========================================================
  // Start this page at the top when it mounts.
  //
  // This prevents the browser or ScrollTrigger from restoring
  // a previous scroll position that conflicts with pinned
  // sections and Lenis smooth scrolling.
  // =========================================================

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;

    let firstFrame = 0;
    let secondFrame = 0;

    // Prevent browser history from restoring an old position
    // while this landing page is active.
    window.history.scrollRestoration = "manual";

    // Clear scroll positions remembered by GSAP.
    ScrollTrigger.clearScrollMemory("manual");

    // Immediately place the page at the top.
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    // Wait for the page and its animation effects to initialize.
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        // Synchronize Lenis with the top position if initialized.
        if (lenisRef.current) {
          lenisRef.current.scrollTo(0, {
            immediate: true,
          });
        }

        window.scrollTo({
          top: 0,
          left: 0,
          behavior: "auto",
        });

        // Clear cached positions before recalculating triggers.
        ScrollTrigger.clearScrollMemory("manual");
        ScrollTrigger.refresh();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);

      // Restore the previous browser setting when leaving.
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  // =========================================================
  // SMOOTH SCROLL SETUP — LENIS
  // =========================================================

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
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
      lenisRef.current = null;
    };
  }, []);

  // =========================================================
  // SECTION NAVIGATION
  // =========================================================

  const scrollToSection = (id) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    if (lenisRef.current) {
      lenisRef.current.scrollTo(element, {
        offset: 0,
        duration: 1.4,
      });
    } else {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // =========================================================
  // GSAP SCROLL-DRIVEN ANIMATIONS
  // =========================================================

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // -------------------------------------------------------
      // 1. Initial Hero Entrance Animation
      // -------------------------------------------------------

      const introTl = gsap.timeline();

      introTl
        .fromTo(
          ".exact-eyebrow",
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "power3.out",
          },
          0.1,
        )
        .fromTo(
          ".exact-title",
          { y: 28, opacity: 0, filter: "blur(6px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
          },
          0.25,
        )
        .fromTo(
          ".exact-subtitle",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
          },
          0.4,
        )
        .fromTo(
          ".exact-buttons",
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            ease: "power3.out",
          },
          0.55,
        )
        .fromTo(
          ".exact-curve-container",
          { y: 80, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.4,
            ease: "power2.out",
          },
          0.3,
        );

      // -------------------------------------------------------
      // 2. Top Scroll Progress Bar
      // -------------------------------------------------------

      gsap.to(".ind-scroll-progress-bar", {
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
      // 3. Desktop Scroll Animations
      // -------------------------------------------------------

      const mm = gsap.matchMedia();

      mm.add("(min-width: 901px)", () => {
        // SECTION 01: HERO PARALLAX

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#ind-hero",
            start: "top top",
            end: "+=100%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(0);
              }
            },
          },
        });

        heroTl.to(
          ".hero-scroll-wrapper",
          {
            y: -120,
            opacity: 0,
            scale: 0.95,
            filter: "blur(8px)",
            duration: 1,
            ease: "none",
          },
          0,
        );

        // SECTION 02: WHAT YOU GET

        const featTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#ind-features",
            start: "top top",
            end: "+=100%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(1);
              }
            },
          },
        });

        featTl
          .fromTo(
            ".feat-stage-left",
            { x: -50, opacity: 0, filter: "blur(4px)" },
            {
              x: 0,
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.6,
              ease: "power3.out",
            },
            0,
          )
          .fromTo(
            ".ind-feat-card",
            {
              y: 60,
              opacity: 0,
              rotateX: 15,
              scale: 0.95,
              transformPerspective: 1200,
            },
            {
              y: 0,
              opacity: 1,
              rotateX: 0,
              scale: 1,
              stagger: 0.1,
              duration: 0.75,
              ease: "power3.out",
            },
            0.1,
          )
          .fromTo(
            ".feat-card-meter-fill",
            { scaleX: 0 },
            {
              scaleX: 1,
              stagger: 0.1,
              duration: 0.5,
            },
            0.4,
          );

        // SECTION 03: HOW IT WORKS

        const stepsTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#ind-steps",
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(2);
              }
            },
          },
        });

        stepsTl
          .fromTo(
            ".steps-stage-header",
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.4,
            },
            0,
          )
          .fromTo(
            ".steps-laser-fill",
            {
              scaleX: 0,
              transformOrigin: "left center",
            },
            {
              scaleX: 1,
              duration: 1.6,
              ease: "none",
            },
            0.2,
          )
          .fromTo(
            ".ind-step-card",
            {
              y: 40,
              opacity: 0,
              scale: 0.95,
            },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              stagger: 0.35,
              duration: 0.55,
              ease: "back.out(1.2)",
            },
            0.2,
          )
          .fromTo(
            ".ind-step-orb",
            {
              boxShadow: "0 0 0px rgba(34,211,238,0)",
              borderColor: "rgba(255,255,255,0.1)",
            },
            {
              boxShadow: "0 0 25px rgba(167,139,250,0.5)",
              borderColor: "#a78bfa",
              stagger: 0.35,
              duration: 0.45,
            },
            0.25,
          );

        // SECTION 04: WHY ZYRA

        const ambTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#ind-ambitions",
            start: "top top",
            end: "+=100%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(3);
              }
            },
          },
        });

        ambTl
          .fromTo(
            ".amb-stage-left",
            { x: -40, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.5,
            },
            0,
          )
          .fromTo(
            ".ind-ambition-tile",
            { y: 50, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.1,
              duration: 0.7,
              ease: "power3.out",
            },
            0.15,
          );

        // SECTION 05: FINAL CTA

        const ctaTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#ind-cta",
            start: "top top",
            end: "+=80%",
            pin: true,
            scrub: 1,
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(4);
              }
            },
          },
        });

        ctaTl
          .fromTo(
            ".cta-z-monolith",
            {
              scale: 0.8,
              opacity: 0,
              y: 40,
            },
            {
              scale: 1,
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: "power3.out",
            },
            0,
          )
          .fromTo(
            ".cta-horizon-mountains",
            { y: 50, opacity: 0.5 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
            },
            0,
          )
          .fromTo(
            ".cta-main-copy",
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.6,
            },
            0.2,
          );
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div className="ind-page" ref={containerRef}>
      {/* TOP SCROLL PROGRESS BAR */}

      <div
        className="ind-scroll-progress-bar"
        aria-hidden="true"
      />

      {/* RIGHT-HAND SECTION PROGRESS HUD */}

      <aside
        className="ind-section-hud"
        aria-label="Section navigation"
      >
        {NAV_SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            className={`ind-hud-btn ${
              activeSection === idx ? "active" : ""
            }`}
            onClick={() => scrollToSection(sec.id)}
          >
            <span className="ind-hud-num">{sec.num}</span>
            <span className="ind-hud-label">{sec.label}</span>
            <span className="ind-hud-pip" />
          </button>
        ))}
      </aside>

      {/* FIXED AMBIENT SPACE BACKGROUND */}

      <div className="ind-ambient-bg" aria-hidden="true">
        <div className="ind-ambient-orb orb-purple" />
        <div className="ind-ambient-orb orb-cyan" />
        <div className="ind-stars-layer" />
      </div>

      {/* TOP NAVBAR */}

      <header className="ind-navbar">
        <button
          type="button"
          className="ind-brand-btn"
          onClick={() => navigate("/")}
        >
          <span className="ind-brand-z">Z</span>

          <span className="ind-brand-text">
            <strong>ZYRA</strong>
            <small>Individual Workspace</small>
          </span>
        </button>

        <nav className="ind-nav-links">
          <button
            type="button"
            className={activeSection === 1 ? "active" : ""}
            onClick={() => scrollToSection("ind-features")}
          >
            Features
          </button>

          <button
            type="button"
            className={activeSection === 2 ? "active" : ""}
            onClick={() => scrollToSection("ind-steps")}
          >
            How It Works
          </button>

          <button
            type="button"
            className={activeSection === 3 ? "active" : ""}
            onClick={() => scrollToSection("ind-ambitions")}
          >
            Why ZYRA
          </button>

          <button
            type="button"
            className={activeSection === 4 ? "active" : ""}
            onClick={() => scrollToSection("ind-cta")}
          >
            Get Started
          </button>
        </nav>

        <div className="ind-nav-actions">
          <button
            type="button"
            className="ind-back-hub-btn"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={13} />
            Main Hub
          </button>

          <button
            type="button"
            className="ind-signin-btn"
            onClick={() => navigate("/login")}
          >
            Sign In
          </button>

          <button
            type="button"
            className="ind-signup-btn"
            onClick={() => navigate("/signup")}
          >
            Sign Up
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main>
        {/* =====================================================
            SECTION 01: HERO — GLOWING RADIANT CURVE
        ===================================================== */}

        <section className="ind-pin-section" id="ind-hero">
          <div className="hero-ambient-glow" />

          <div className="hero-scroll-wrapper">
            <div className="hero-content-block">
              <div className="exact-eyebrow">
                <Sparkles size={12} />
                AI-Powered Data & Automation Platform
              </div>

              <h1 className="exact-title">
                Smarter AI Workflows for
                <br />
                Modern Teams
              </h1>

              <p className="exact-subtitle">
                Manage, analyze, and automate your AI operations in one
                powerful workspace.
                <br />
                Track performance, generate outputs, and gain insights — all in
                real time.
              </p>

              <div className="exact-buttons">
                <button
                  type="button"
                  className="exact-btn-primary"
                  onClick={() => navigate("/signup")}
                >
                  Start with Individual
                </button>

                <button
                  type="button"
                  className="exact-btn-secondary"
                  onClick={() => scrollToSection("ind-features")}
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* GLOWING CURVE */}

            <div className="exact-curve-container">
              <div className="exact-curve-arc">
                <div className="exact-curve-inner-glow" />
                <div className="exact-curve-stars" />
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION 02: WHAT YOU GET
        ===================================================== */}

        <section className="ind-pin-section" id="ind-features">
          <div className="ind-stage-container features-layout">
            <div className="feat-stage-left">
              <span className="ind-section-eyebrow">
                WHAT YOU GET
              </span>

              <h2>
                Everything You Need in{" "}
                <span className="ind-grad-text">One Place</span>
              </h2>

              <p>
                ZYRA gives you the tools to stay focused, organized and
                productive — all in a clean, modern workspace built for
                individuals.
              </p>

              <div className="feat-holo-emblem">
                <div className="emblem-ring ring-1" />
                <div className="emblem-ring ring-2" />
                <div className="emblem-z-core">Z</div>
                <span className="emblem-caption">
                  Plan. Build. Grow.
                </span>
              </div>

              <div className="feat-script-note">
                More than just tasks.
                <span className="script-underline" />
              </div>
            </div>

            <div className="feat-stage-right">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;

                return (
                  <div key={feat.title} className="ind-feat-card">
                    <div className="ifc-top">
                      <div className="ifc-icon">
                        <Icon size={19} />
                      </div>

                      <span className="ifc-tag">{feat.tag}</span>
                    </div>

                    <h3>{feat.title}</h3>
                    <p>{feat.desc}</p>

                    <div className="feat-card-meter">
                      <div className="feat-card-meter-fill" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION 03: HOW IT WORKS
        ===================================================== */}

        <section className="ind-pin-section" id="ind-steps">
          <div className="ind-stage-container steps-layout">
            <div className="steps-stage-header">
              <span className="ind-section-eyebrow">
                HOW IT WORKS
              </span>

              <h2>
                Simple Steps.{" "}
                <span className="ind-grad-text">Big Results.</span>
              </h2>

              <p>
                Get started in minutes and turn your ideas into real progress
                with the power of ZYRA.
              </p>
            </div>

            <div className="steps-timeline-stage">
              <div className="steps-laser-track">
                <div className="steps-laser-fill" />
              </div>

              <div className="steps-cards-grid">
                {STEPS.map((st) => {
                  const Icon = st.icon;

                  return (
                    <div key={st.num} className="ind-step-card">
                      <div className="ind-step-orb">
                        <Icon size={22} />
                        <span className="step-num-badge">
                          {st.num}
                        </span>
                      </div>

                      <h3>{st.title}</h3>
                      <p>{st.desc}</p>

                      <div className="step-live-preview">
                        <Clock3 size={11} />
                        <span>{st.preview}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION 04: WHY ZYRA
        ===================================================== */}

        <section className="ind-pin-section" id="ind-ambitions">
          <div className="ind-stage-container ambitions-layout">
            <div className="amb-stage-left">
              <span className="ind-section-eyebrow">
                WHY ZYRA
              </span>

              <h2>
                Built for Your{" "}
                <span className="ind-grad-text">Ambitions</span>
              </h2>

              <p>
                ZYRA isn’t just a tool — it’s your partner in building a better,
                more productive you. Start solo and invite collaborators
                whenever your project scales.
              </p>

              <div className="amb-cta-box">
                <button
                  type="button"
                  className="exact-btn-primary"
                  onClick={() => navigate("/signup")}
                >
                  Create Free Workspace
                </button>
              </div>
            </div>

            <div className="amb-stage-grid">
              {AMBITIONS.map((amb) => {
                const Icon = amb.icon;

                return (
                  <div key={amb.title} className="ind-ambition-tile">
                    <div className="iat-header">
                      <div className="iat-icon">
                        <Icon size={20} />
                      </div>

                      <span className="iat-metric">
                        {amb.metric}
                      </span>
                    </div>

                    <h3>{amb.title}</h3>
                    <p>{amb.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION 05: FINAL CTA
        ===================================================== */}

        <section className="ind-pin-section" id="ind-cta">
          <div className="cta-cosmic-sky" aria-hidden="true" />
          <div className="cta-shooting-star" aria-hidden="true" />
          <div className="cta-horizon-mountains" aria-hidden="true" />

          <div className="ind-stage-container cta-finale-layout">
            <div className="cta-z-monolith">
              <div className="monolith-aura" />
              <div className="monolith-z-letter">Z</div>
            </div>

            <div className="cta-main-copy">
              <span className="ind-section-eyebrow center-eyebrow">
                YOUR JOURNEY STARTS HERE
              </span>

              <h2>
                Build Your Best Workday <br />
                with <span className="ind-grad-text">ZYRA</span>
              </h2>

              <p>
                Join thousands of creators, students and independent builders
                who are already working smarter with ZYRA.
              </p>

              <div className="exact-buttons">
                <button
                  type="button"
                  className="exact-btn-primary"
                  onClick={() => navigate("/signup")}
                >
                  Sign Up Free
                </button>

                <button
                  type="button"
                  className="exact-btn-secondary"
                  onClick={() => navigate("/login")}
                >
                  Sign In to Workspace
                </button>
              </div>
            </div>

            <div className="cta-handwritten-corner">
              Your goals.
              <br />
              Our AI.
              <span className="script-underline" />
            </div>

            <footer className="ind-bottom-footer">
              <div className="ibf-left">
                <span className="ibf-z">Z</span>
                <strong>ZYRA</strong>
                <span>// Individual Workspace</span>
              </div>

              <div className="ibf-center">
                Start independently. Collaborate when you need to. Work
                intelligently.
              </div>

              <div className="ibf-right">© 2026 ZYRA OS</div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

export default IndividualLanding;