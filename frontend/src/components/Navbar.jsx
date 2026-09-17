import { Bell, Search } from "lucide-react";

function Navbar() {
  return (
    <nav className="zyra-navbar">
      <div className="navbar-search">
        <Search size={17} />

        <input type="text" placeholder="Search ZYRA..." />
      </div>

      <button className="navbar-icon-btn">
        <Bell size={19} />
      </button>

      <div className="navbar-profile">
        <div className="profile-avatar">A</div>

        <div className="profile-info">
          <strong>Arsalan</strong>
          <span>Workspace Member</span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
