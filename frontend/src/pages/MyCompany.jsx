import { Building2 } from "lucide-react";

import { useWorkspace } from "../context/WorkspaceContext";
import OrganizationSettingsCard from "../components/OrganizationSettingsCard";

import "../styles/MyCompany.css";

export default function MyCompany() {
  const { activeWorkspace, workspaceType } = useWorkspace();

  if (workspaceType !== "COMPANY") {
    return (
      <main className="my-company-page">
        <div className="my-company-message" role="status">
          My Company is available only in a company workspace.
        </div>
      </main>
    );
  }

  if (!activeWorkspace?.id) {
    return (
      <main className="my-company-page">
        <div className="my-company-message" role="status">
          Your company workspace is not currently available. Refresh the page and try again.
        </div>
      </main>
    );
  }

  return (
    <main className="my-company-page">
      <header className="my-company-header">
        <div className="my-company-heading-icon" aria-hidden="true">
          <Building2 size={25} />
        </div>

        <div className="my-company-heading-copy">
          <p className="my-company-eyebrow">COMPANY WORKSPACE</p>
          <h1>My Company</h1>
          <p className="my-company-description">
            View and manage your organization's profile and company details.
          </p>
        </div>
      </header>

      <section className="my-company-settings" aria-label="Company settings">
        <OrganizationSettingsCard workspaceId={activeWorkspace.id} />
      </section>
    </main>
  );
}