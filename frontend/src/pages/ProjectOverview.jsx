function ProjectOverview() {
  return (
    <div>
      <h2>Project Overview</h2>

      <p>View your project's progress and important information.</p>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Tasks</h3>
          <p>0</p>
        </div>

        <div className="dashboard-card">
          <h3>Completed</h3>
          <p>0</p>
        </div>

        <div className="dashboard-card">
          <h3>Pending</h3>
          <p>0</p>
        </div>

        <div className="dashboard-card">
          <h3>Team Members</h3>
          <p>0</p>
        </div>
      </div>
    </div>
  );
}

export default ProjectOverview;
