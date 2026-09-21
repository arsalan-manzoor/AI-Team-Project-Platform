function Profile() {
  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <div>
          <h1>My Profile</h1>
          <p>Manage your ZYRA account information.</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-main">
          <div className="profile-large-avatar">A</div>

          <div className="profile-main-info">
            <h2>Arsalan Manzoor</h2>
            <p>Workspace Member</p>
            <span>ZYRA Core Team</span>
          </div>
        </div>

        <div className="profile-divider" />

        <div className="profile-details">
          <div className="profile-detail">
            <span className="profile-detail-label">Full Name</span>
            <strong>Arsalan Manzoor</strong>
          </div>

          <div className="profile-detail">
            <span className="profile-detail-label">Email</span>
            <strong>arsalan@zyra.local</strong>
          </div>

          <div className="profile-detail">
            <span className="profile-detail-label">Role</span>
            <strong>Workspace Member</strong>
          </div>

          <div className="profile-detail">
            <span className="profile-detail-label">Team</span>
            <strong>ZYRA Core Team</strong>
          </div>
        </div>

        <div className="profile-actions">
          <button type="button" className="profile-edit-button">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
