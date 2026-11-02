import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "../styles/OrganizationSettingsCard.css";

const emptyForm = {
  name: "",
  website: "",
  industry: "",
  companySize: "",
  country: "",
  address: "",
};

function formFromOrganization(organization = {}) {
  return {
    name: organization.name || "",
    website: organization.website || "",
    industry: organization.industry || "",
    companySize: organization.company_size || "",
    country: organization.country || "",
    address: organization.address || "",
  };
}

function getVerificationStatusPresentation(status) {
  const label =
    typeof status === "string" && status.trim()
      ? status.trim()
      : "UNKNOWN";

  const normalizedStatus = label.toUpperCase();

  if (normalizedStatus === "VERIFIED") {
    return {
      label,
      className: "is-verified",
    };
  }

  if (normalizedStatus === "PENDING") {
    return {
      label,
      className: "is-pending",
    };
  }

  if (normalizedStatus === "REJECTED") {
    return {
      label,
      className: "is-rejected",
    };
  }

  // Preserve other backend statuses without incorrectly treating
  // them as pending.
  return {
    label,
    className: "is-neutral",
  };
}

export default function OrganizationSettingsCard({ workspaceId }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setProfile(null);
      setForm(emptyForm);
      setEditing(false);
      setError("");
      setNotice("");

      if (!workspaceId) {
        setError("No active Company workspace was found.");
        setLoading(false);
        return;
      }

      try {
        const result = await apiRequest(
          `/workspaces/company/${workspaceId}/organization`,
        );

        if (cancelled) return;

        setProfile(result);
        setForm(formFromOrganization(result?.organization));
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
              "Unable to load organization details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setNotice("");
  }

  function cancelEdit() {
    setForm(formFromOrganization(profile?.organization));
    setEditing(false);
    setError("");
    setNotice("");
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!profile?.can_manage) {
      setError(
        "Only a Company ADMIN can update organization details.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/workspaces/company/${workspaceId}/organization`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            website: form.website.trim(),
            industry: form.industry.trim(),
            companySize: form.companySize.trim(),
            country: form.country.trim(),
            address: form.address.trim(),
          }),
        },
      );

      const organization =
        result?.organization || profile?.organization;

      setProfile((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          organization,
          workspace: {
            ...previous.workspace,
            name:
              organization?.name || previous.workspace?.name,
          },
        };
      });

      setForm(formFromOrganization(organization));
      setEditing(false);

      setNotice(
        result?.message ||
          "Organization profile updated successfully.",
      );
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to save organization details.",
      );
    } finally {
      setSaving(false);
    }
  }

  const organization = profile?.organization;

  const verificationStatus = getVerificationStatusPresentation(
    organization?.verification_status,
  );

  return (
    <section
      className="zyra-org-settings"
      aria-labelledby="zyra-org-settings-title"
      aria-busy={loading || saving}
    >
      <div className="zyra-org-settings-heading">
        <div>
          <span className="zyra-org-settings-eyebrow">
            ORGANIZATION SETTINGS
          </span>

          <h2 id="zyra-org-settings-title">
            {organization?.name || "Company profile"}
          </h2>

          <p>
            Review and manage your organization information.
          </p>
        </div>

        {profile?.can_manage && !editing && (
          <button
            type="button"
            className="zyra-org-primary-button"
            onClick={() => {
              setError("");
              setNotice("");
              setEditing(true);
            }}
            disabled={loading || !organization}
          >
            Edit organization
          </button>
        )}
      </div>

      {error && (
        <div
          className="zyra-org-message is-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="zyra-org-message is-success"
          role="status"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <p className="zyra-org-loading" role="status">
          Loading organization details...
        </p>
      ) : !organization ? (
        <p className="zyra-org-loading">
          Organization details are unavailable for this workspace.
        </p>
      ) : editing ? (
        <form className="zyra-org-form" onSubmit={saveProfile}>
          <label>
            <span>Company name</span>
            <input
              required
              minLength={2}
              maxLength={255}
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <label>
            <span>Website</span>
            <input
              type="url"
              placeholder="https://yourcompany.com"
              value={form.website}
              onChange={(event) =>
                updateField("website", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <label>
            <span>Industry</span>
            <input
              maxLength={120}
              value={form.industry}
              onChange={(event) =>
                updateField("industry", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <label>
            <span>Company size</span>
            <input
              maxLength={80}
              value={form.companySize}
              onChange={(event) =>
                updateField("companySize", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <label>
            <span>Country</span>
            <input
              maxLength={120}
              value={form.country}
              onChange={(event) =>
                updateField("country", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <label className="zyra-org-wide-field">
            <span>Address</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.address}
              onChange={(event) =>
                updateField("address", event.target.value)
              }
              disabled={saving}
            />
          </label>

          <div className="zyra-org-form-actions">
            <button
              type="button"
              className="zyra-org-secondary-button"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="zyra-org-primary-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="zyra-org-details-grid">
          <div className="zyra-org-detail">
            <span>Official email</span>
            <strong>
              {organization.official_email || "Not provided"}
            </strong>
          </div>

          <div className="zyra-org-detail">
            <span>Official domain</span>
            <strong>
              {organization.official_domain || "Not provided"}
            </strong>
          </div>

          <div className="zyra-org-detail">
            <span>Industry</span>
            <strong>
              {organization.industry || "Not provided"}
            </strong>
          </div>

          <div className="zyra-org-detail">
            <span>Company size</span>
            <strong>
              {organization.company_size || "Not provided"}
            </strong>
          </div>

          <div className="zyra-org-detail">
            <span>Country</span>
            <strong>
              {organization.country || "Not provided"}
            </strong>
          </div>

          <div className="zyra-org-detail">
            <span>Website</span>

            {organization.website ? (
              <a
                href={organization.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {organization.website}
              </a>
            ) : (
              <strong>Not provided</strong>
            )}
          </div>

          <div className="zyra-org-detail">
            <span>Verification status</span>

            <strong
              className={`zyra-org-status ${verificationStatus.className}`}
            >
              {verificationStatus.label}
            </strong>
          </div>

          <div className="zyra-org-detail zyra-org-address">
            <span>Address</span>
            <strong>
              {organization.address || "Not provided"}
            </strong>
          </div>

          <p className="zyra-org-footnote">
            Official email and domain are read-only. Only a Company
            ADMIN can edit the profile.
          </p>
        </div>
      )}
    </section>
  );
}