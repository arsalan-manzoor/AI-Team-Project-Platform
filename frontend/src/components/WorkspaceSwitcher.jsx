import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";

function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspace,
    workspaceRole,
    switchWorkspace,
    loading,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="workspace-switcher">
        <div className="workspace-switcher-trigger">
          <div className="workspace-switcher-info">
            <strong>Loading workspace...</strong>
            <span>Please wait</span>
          </div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return null;
  }

  function handleWorkspaceSelect(workspaceId) {
    switchWorkspace(workspaceId);
    setIsOpen(false);
  }

  return (
    <div
      className="workspace-switcher"
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        className="workspace-switcher-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="workspace-switcher-icon">
          {activeWorkspace.type === "COMPANY" ? "C" : "P"}
        </div>

        <div className="workspace-switcher-info">
          <strong>{activeWorkspace.name}</strong>
          <span>{workspaceRole}</span>
        </div>

        <ChevronDown
          size={16}
          className={isOpen ? "workspace-chevron-open" : ""}
        />
      </button>

      {isOpen && (
        <div
          className="workspace-switcher-menu"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="workspace-menu-heading">
            <span>YOUR WORKSPACES</span>
          </div>

          {workspaces.map((workspace) => {
            const isActive =
              String(workspace.id) === String(activeWorkspace.id);

            return (
              <button
                key={workspace.id}
                type="button"
                className={`workspace-option ${
                  isActive ? "workspace-option-active" : ""
                }`}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                role="menuitem"
              >
                <div className="workspace-option-icon">
                  {workspace.type === "COMPANY" ? "C" : "P"}
                </div>

                <div className="workspace-option-info">
                  <strong>{workspace.name}</strong>
                  <span>{workspace.role}</span>
                </div>

                {isActive && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WorkspaceSwitcher;
