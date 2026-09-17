import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function MainLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            <svg
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="ZYRA logo"
            >
              <defs>
                <linearGradient
                  id="zyraGradient"
                  x1="8"
                  y1="56"
                  x2="56"
                  y2="8"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#3B82F6" />
                  <stop offset="0.5" stopColor="#6366F1" />
                  <stop offset="1" stopColor="#C084FC" />
                </linearGradient>

                <linearGradient
                  id="zyraHighlight"
                  x1="10"
                  y1="8"
                  x2="54"
                  y2="56"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" stopColor="#60A5FA" />
                  <stop offset="0.5" stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#A855F7" />
                </linearGradient>
              </defs>

              <path
                d="
                  M 10 8
                  H 54
                  C 57 8 58 11 56 13
                  L 20 51
                  H 54
                  C 57 51 58 54 56 56
                  H 10
                  C 7 56 6 53 8 51
                  L 44 13
                  H 10
                  C 7 13 7 8 10 8
                  Z
                "
                fill="url(#zyraGradient)"
              />

              <path
                d="
                  M 10 8
                  H 54
                  C 56 8 57 9 57 11
                  C 57 12 56 13 55 14
                  L 20 51
                  H 10
                  L 44 13
                  H 10
                  C 8 13 8 8 10 8
                  Z
                "
                fill="url(#zyraHighlight)"
                opacity="0.45"
              />
            </svg>
          </div>

          <div className="brand-text">
            <h1>ZYRA</h1>
            <span>Intelligent Project Workspace</span>
          </div>
        </div>

        <div className="header-right">
          <Navbar />
        </div>
      </header>

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
