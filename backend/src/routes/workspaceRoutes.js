const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const {
  sendEmployeeInvitationEmail,
  sendIndividualInvitationEmail,
} = require("../utils/emailService");

const router = express.Router();

const generateOrganizationId = () => {
  return `ZYRA-ORG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

/*
|--------------------------------------------------------------------------
| Create a Project Workspace
|--------------------------------------------------------------------------
*/

router.post("/", authMiddleware, async (req, res) => {
  const { name, type } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: "Workspace name is required",
    });
  }

  if (type !== "PROJECT") {
    return res.status(400).json({
      error: "Only PROJECT workspaces can be created through this endpoint",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workspaceResult = await client.query(
      `INSERT INTO workspaces (name, type, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, type, created_by, created_at`,
      [name.trim(), "PROJECT", req.user.id],
    );

    const workspace = workspaceResult.rows[0];

    const memberResult = await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, workspace_id, user_id, role, joined_at`,
      [workspace.id, req.user.id, "TEAM_LEADER"],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Project workspace created successfully",
      workspace,
      membership: memberResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Workspace creation rollback error:",
        rollbackError.message,
      );
    }

    console.error("Workspace creation error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/*
|--------------------------------------------------------------------------
| Request Company Establishment
|--------------------------------------------------------------------------
*/

router.post("/company/establish", authMiddleware, async (req, res) => {
  const { companyName, authorizedEmail } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({
      error: "Company name is required",
    });
  }

  if (!authorizedEmail || !authorizedEmail.trim()) {
    return res.status(400).json({
      error: "Authorized email is required",
    });
  }

  try {
    const existingRequest = await pool.query(
      `SELECT id
       FROM company_establishments
       WHERE requested_by = $1
         AND verification_status = 'PENDING'
       LIMIT 1`,
      [req.user.id],
    );

    if (existingRequest.rows.length > 0) {
      return res.status(409).json({
        error: "You already have a pending company establishment request",
      });
    }

    const result = await pool.query(
      `INSERT INTO company_establishments
       (
         company_name,
         authorized_email,
         verification_status,
         requested_by,
         organization_type
       )
       VALUES ($1, $2, 'PENDING', $3, 'COMPANY')
       RETURNING
         id,
         company_name,
         authorized_email,
         verification_status,
         requested_by,
         organization_type,
         created_at`,
      [companyName.trim(), authorizedEmail.trim().toLowerCase(), req.user.id],
    );

    return res.status(201).json({
      message: "Company establishment request created successfully",
      establishment: result.rows[0],
    });
  } catch (error) {
    console.error("Company establishment request error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Development Verification of Company Establishment
|--------------------------------------------------------------------------
|
| DEVELOPMENT ONLY
|
*/

router.post(
  "/company/establish/:establishmentId/verify",
  authMiddleware,
  async (req, res) => {
    const { establishmentId } = req.params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const establishmentResult = await client.query(
        `SELECT
           id,
           company_name,
           authorized_email,
           authorized_representative_name,
           organization_type,
           verification_status,
           requested_by,
           organization_id,
           created_at
         FROM company_establishments
         WHERE id = $1
           AND requested_by = $2
         FOR UPDATE`,
        [establishmentId, req.user.id],
      );

      if (establishmentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Company establishment request not found",
        });
      }

      const establishment = establishmentResult.rows[0];

      if (establishment.verification_status !== "PENDING") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Company establishment request is already verified",
        });
      }

      const generatedOrganizationId = generateOrganizationId();

      const officialDomain = establishment.authorized_email.includes("@")
        ? establishment.authorized_email.split("@")[1].toLowerCase()
        : null;

      const organizationResult = await client.query(
        `INSERT INTO organizations
         (
           organization_id,
           name,
           type,
           official_email,
           official_domain,
           verification_status,
           created_by
         )
         VALUES ($1, $2, $3, $4, $5, 'VERIFIED', $6)
         RETURNING
           id,
           organization_id,
           name,
           type,
           official_email,
           official_domain,
           verification_status,
           created_by,
           created_at`,
        [
          generatedOrganizationId,
          establishment.company_name,
          establishment.organization_type,
          establishment.authorized_email,
          officialDomain,
          establishment.requested_by,
        ],
      );

      const organization = organizationResult.rows[0];

      const workspaceResult = await client.query(
        `INSERT INTO workspaces
         (
           name,
           type,
           created_by,
           organization_id
         )
         VALUES ($1, 'COMPANY', $2, $3)
         RETURNING
           id,
           name,
           type,
           created_by,
           organization_id,
           created_at`,
        [
          establishment.company_name,
          establishment.requested_by,
          organization.id,
        ],
      );

      const workspace = workspaceResult.rows[0];

      const memberResult = await client.query(
        `INSERT INTO workspace_members
         (workspace_id, user_id, role)
         VALUES ($1, $2, 'ADMIN')
         RETURNING
           id,
           workspace_id,
           user_id,
           role,
           joined_at`,
        [workspace.id, establishment.requested_by],
      );

      const organizationMemberResult = await client.query(
        `INSERT INTO organization_members
         (
           organization_id,
           user_id
         )
         VALUES ($1, $2)
         RETURNING
           id,
           organization_id,
           user_id,
           joined_at`,
        [organization.id, establishment.requested_by],
      );

      const establishmentUpdateResult = await client.query(
        `UPDATE company_establishments
         SET
           verification_status = 'VERIFIED',
           organization_id = $1
         WHERE id = $2
         RETURNING
           id,
           company_name,
           authorized_email,
           authorized_representative_name,
           organization_type,
           verification_status,
           requested_by,
           organization_id,
           created_at`,
        [organization.id, establishment.id],
      );

      const verifiedEstablishment = establishmentUpdateResult.rows[0];

      await client.query("COMMIT");

      return res.status(200).json({
        message:
          "Company verified, organization created, and workspace created successfully",
        establishment: verifiedEstablishment,
        organization,
        workspace,
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Company verification rollback error:",
          rollbackError.message,
        );
      }

      console.error("Company establishment verification error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "Organization identifier already exists",
        });
      }

      if (error.code === "23503") {
        return res.status(400).json({
          error: "Invalid organization or user relationship",
        });
      }

      if (error.code === "23514") {
        return res.status(400).json({
          error: "Invalid organization verification data",
        });
      }

      return res.status(500).json({
        error: "Database error",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Add HR to a Company Workspace
|--------------------------------------------------------------------------
|
| ADMIN ONLY
|
*/

router.post(
  "/company/:workspaceId/members",
  authMiddleware,
  async (req, res) => {
    const { userId, role } = req.body;
    const { workspaceId } = req.params;
    const client = await pool.connect();

    try {
      if (!userId) {
        return res.status(400).json({
          error: "User ID is required",
        });
      }

      if (role !== "HR") {
        return res.status(400).json({
          error: "Only HR members can be added through this endpoint",
        });
      }

      await client.query("BEGIN");

      const adminResult = await client.query(
        `SELECT
           workspace_members.id,
           workspace_members.role,
           workspaces.organization_id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         JOIN organizations
           ON workspaces.organization_id = organizations.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'ADMIN'
           AND workspaces.type = 'COMPANY'
           AND organizations.verification_status = 'VERIFIED'`,
        [workspaceId, req.user.id],
      );

      if (adminResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only a Company ADMIN can add HR members",
        });
      }

      const workspace = adminResult.rows[0];

      const userResult = await client.query(
        `SELECT id, name, email
         FROM users
         WHERE id = $1`,
        [userId],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "User not found",
        });
      }

      const organizationMemberResult = await client.query(
        `INSERT INTO organization_members
         (
           organization_id,
           user_id
         )
         VALUES ($1, $2)
         ON CONFLICT (organization_id, user_id) DO NOTHING
         RETURNING
           id,
           organization_id,
           user_id,
           joined_at`,
        [workspace.organization_id, userId],
      );

      const memberResult = await client.query(
        `INSERT INTO workspace_members
         (
           workspace_id,
           user_id,
           role
         )
         VALUES ($1, $2, 'HR')
         RETURNING
           id,
           workspace_id,
           user_id,
           role,
           joined_at`,
        [workspaceId, userId],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "HR added to company workspace successfully",
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0] || null,
        user: userResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Add company HR rollback error:", rollbackError.message);
      }

      console.error("Add company HR error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "User is already a member of this workspace",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace, organization, or user not found",
        });
      }

      return res.status(500).json({
        error: "Database error",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Update Employee Account Status
|--------------------------------------------------------------------------
|
| ADMIN ONLY
|
*/

router.patch(
  "/company/:workspaceId/members/:userId/status",
  authMiddleware,
  async (req, res) => {
    const { workspaceId, userId } = req.params;
    const { account_status } = req.body;

    if (!account_status) {
      return res.status(400).json({
        error: "Account status is required",
      });
    }

    const normalizedStatus = account_status.trim().toUpperCase();

    if (!["ACTIVE", "SUSPENDED"].includes(normalizedStatus)) {
      return res.status(400).json({
        error: "Account status must be ACTIVE or SUSPENDED",
      });
    }

    try {
      const adminResult = await pool.query(
        `SELECT
           workspace_members.id,
           workspace_members.role
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'ADMIN'
           AND workspaces.type = 'COMPANY'`,
        [workspaceId, req.user.id],
      );

      if (adminResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only a Company ADMIN can update employee account status",
        });
      }

      const memberResult = await pool.query(
        `SELECT
           workspace_members.id,
           workspace_members.user_id,
           workspace_members.role,
           users.name,
           users.email,
           users.account_status
         FROM workspace_members
         JOIN users
           ON workspace_members.user_id = users.id
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type = 'COMPANY'`,
        [workspaceId, userId],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Employee is not a member of this company workspace",
        });
      }

      const member = memberResult.rows[0];

      if (member.role === "ADMIN") {
        return res.status(403).json({
          error:
            "Company ADMIN accounts cannot be suspended through this endpoint",
        });
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET account_status = $1
         WHERE id = $2
         RETURNING
           id,
           name,
           email,
           account_status`,
        [normalizedStatus, userId],
      );

      return res.status(200).json({
        message:
          normalizedStatus === "SUSPENDED"
            ? "Employee account suspended successfully"
            : "Employee account activated successfully",
        user: updateResult.rows[0],
      });
    } catch (error) {
      console.error("Update employee account status error:", error.message);

      return res.status(500).json({
        error: "Database error",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Invite Employee to a Company Workspace
|--------------------------------------------------------------------------
*/

router.post(
  "/company/:workspaceId/invitations",
  authMiddleware,
  async (req, res) => {
    const { workspaceId } = req.params;
    const { email, role, temporaryPassword } = req.body || {};

    if (!email || !email.trim()) {
      return res.status(400).json({
        error: "Employee email is required",
      });
    }

    if (!role) {
      return res.status(400).json({
        error: "Employee role is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();

    if (normalizedRole === "ADMIN") {
      return res.status(400).json({
        error: "ADMIN cannot be assigned through employee invitations",
      });
    }

    if (!["HR", "TEAM_LEADER", "USER"].includes(normalizedRole)) {
      return res.status(400).json({
        error: "Invalid employee invitation role",
      });
    }

    try {
      const requesterResult = await pool.query(
        `SELECT
           workspaces.id,
           workspaces.name,
           workspaces.type,
           workspaces.organization_id,
           workspace_members.role
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type = 'COMPANY'`,
        [workspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        return res.status(403).json({
          error:
            "You are not authorized to create invitations for this company workspace",
        });
      }

      const workspace = requesterResult.rows[0];
      const requesterRole = workspace.role;

      if (requesterRole === "ADMIN") {
        // ADMIN can invite HR, TEAM_LEADER, and USER.
      } else if (requesterRole === "HR") {
        if (!["TEAM_LEADER", "USER"].includes(normalizedRole)) {
          return res.status(403).json({
            error: "Company HR can only invite Team Leaders or Users",
          });
        }
      } else if (requesterRole === "TEAM_LEADER") {
        if (normalizedRole !== "USER") {
          return res.status(403).json({
            error: "Company Team Leaders can only invite Users",
          });
        }
      } else {
        return res.status(403).json({
          error:
            "Only Company ADMIN, HR, or TEAM_LEADER can create employee invitations",
        });
      }

      const existingUserResult = await pool.query(
        `SELECT
           id,
           name,
           email,
           account_status,
           must_change_password,
           password AS password_hash
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedEmail],
      );

      if (existingUserResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "No ZYRA account exists for this email. Create the employee account first, then send the company invitation.",
        });
      }

      const existingUser = existingUserResult.rows[0];

      if (existingUser.account_status !== "ACTIVE") {
        return res.status(403).json({
          error:
            "This employee account is not active and cannot receive a company invitation",
          account_status: existingUser.account_status,
        });
      }

      /*
       * A newly created employee account must receive its original
       * temporary password in the invitation request so the email can
       * contain the same credentials that were used to create the account.
       * Verify it against the stored bcrypt hash before sending it.
       *
       * Existing accounts that have already changed their password do not
       * need a temporary password; the email tells them to use their
       * existing ZYRA password.
       */
      let emailTemporaryPassword = null;

      if (existingUser.must_change_password) {
        if (
          typeof temporaryPassword !== "string" ||
          temporaryPassword.length === 0
        ) {
          return res.status(400).json({
            error:
              "The employee account requires its temporary password before the invitation can be emailed.",
            must_change_password: true,
          });
        }

        if (Buffer.byteLength(temporaryPassword, "utf8") > 72) {
          return res.status(400).json({
            error:
              "The temporary password exceeds the supported password length.",
          });
        }

        const temporaryPasswordMatches = await bcrypt.compare(
          temporaryPassword,
          existingUser.password_hash,
        );

        if (!temporaryPasswordMatches) {
          return res.status(401).json({
            error:
              "The supplied temporary password does not match this employee account.",
          });
        }

        emailTemporaryPassword = temporaryPassword;
      }

      const existingMembershipResult = await pool.query(
        `SELECT id, role
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2`,
        [workspaceId, existingUser.id],
      );

      if (existingMembershipResult.rows.length > 0) {
        return res.status(409).json({
          error: "This user is already a member of the company workspace",
        });
      }

      const pendingInvitationResult = await pool.query(
        `SELECT id, expires_at
         FROM employee_invitations
         WHERE workspace_id = $1
           AND invited_email = $2
           AND status = 'PENDING'
         ORDER BY created_at DESC
         LIMIT 1`,
        [workspaceId, normalizedEmail],
      );

      if (pendingInvitationResult.rows.length > 0) {
        const existingInvitation = pendingInvitationResult.rows[0];

        if (new Date(existingInvitation.expires_at) > new Date()) {
          return res.status(409).json({
            error: "A pending invitation already exists for this email",
          });
        }

        await pool.query(
          `UPDATE employee_invitations
           SET status = 'EXPIRED'
           WHERE id = $1`,
          [existingInvitation.id],
        );
      }

      const invitationToken = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(invitationToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const invitationResult = await pool.query(
        `INSERT INTO employee_invitations
         (
           workspace_id,
           invited_email,
           invited_by,
           role,
           token_hash,
           status,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
         RETURNING
           id,
           workspace_id,
           invited_email,
           invited_by,
           role,
           status,
           expires_at,
           created_at`,
        [
          workspaceId,
          normalizedEmail,
          req.user.id,
          normalizedRole,
          tokenHash,
          expiresAt,
        ],
      );

      const invitation = invitationResult.rows[0];

      const frontendUrl = (
        process.env.FRONTEND_URL || "http://localhost:5173"
      ).replace(/\/+$/, "");

      // Company employees must always begin at the separate Company Login.
      // They change a temporary password first, then manually accept the
      // pending invitation from their authenticated ZYRA account.
      const companyLoginUrl = `${frontendUrl}/company/login`;

      try {
        await sendEmployeeInvitationEmail(
          normalizedEmail,
          existingUser.name || "there",
          workspace.name,
          normalizedRole,
          emailTemporaryPassword,
          companyLoginUrl,
        );
      } catch (emailError) {
        await pool.query(
          `UPDATE employee_invitations
           SET status = 'CANCELLED'
           WHERE id = $1`,
          [invitation.id],
        );

        console.error("Employee invitation email error:", emailError.message);

        return res.status(500).json({
          error: "Invitation could not be sent. Please try again.",
        });
      }

      try {
        await pool.query(
          `INSERT INTO notifications
           (
             user_id,
             title,
             message,
             notification_type,
             reference_id
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            existingUser.id,
            "Company Invitation",
            `You have been invited to join ${workspace.name} as ${normalizedRole}. Invitation ID: ${invitation.id}. Open this notification to review and accept the invitation.`,
            "EMPLOYEE_INVITATION",
            invitation.id,
          ],
        );
      } catch (notificationError) {
        console.error(
          "Employee invitation notification error:",
          notificationError.message,
        );
      }

      return res.status(201).json({
        message:
          "Employee invitation sent successfully and notification created",
        invitation: {
          id: invitation.id,
          workspace_id: invitation.workspace_id,
          invited_email: invitation.invited_email,
          invited_by: invitation.invited_by,
          role: invitation.role,
          status: invitation.status,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
        },
        account: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          account_status: existingUser.account_status,
        },
        notification: {
          title: "Company Invitation",
          invitation_id: invitation.id,
        },
      });
    } catch (error) {
      console.error("Create employee invitation error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "An invitation with this token already exists",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace or user relationship not found",
        });
      }

      return res.status(500).json({
        error: "Database error",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get Projects for an Individual Workspace
|--------------------------------------------------------------------------
*/

router.get(
  "/individual/:workspaceId/projects",
  authMiddleware,
  async (req, res) => {
    const normalizedWorkspaceId = Number(req.params.workspaceId);

    if (
      !Number.isInteger(normalizedWorkspaceId) ||
      normalizedWorkspaceId <= 0
    ) {
      return res.status(400).json({
        error: "A valid Individual workspace ID is required",
      });
    }

    try {
      const requesterResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.type AS workspace_type,
           wm.role AS requester_role,
           (
             UPPER(TRIM(wm.role::TEXT)) = 'TEAM_LEADER'
             OR EXISTS (
               SELECT 1
               FROM workspace_member_roles wmr
               WHERE wmr.workspace_member_id = wm.id
                 AND UPPER(TRIM(wmr.role::TEXT)) = 'TEAM_LEADER'
             )
           ) AS is_team_leader
         FROM workspace_members wm
         JOIN workspaces w
           ON w.id = wm.workspace_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
           AND w.type = 'INDIVIDUAL'
         LIMIT 1`,
        [normalizedWorkspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this Individual workspace",
        });
      }

      if (!requesterResult.rows[0].is_team_leader) {
        return res.status(403).json({
          error:
            "Only the Individual Team Leader can view projects for invitations",
        });
      }

      const projectsResult = await pool.query(
        `SELECT
           p.id,
           p.name,
           p.description,
           p.team_id,
           p.created_by,
           p.created_at
         FROM projects p
         JOIN teams t
           ON t.id = p.team_id
         WHERE t.workspace_id = $1
         ORDER BY p.created_at DESC NULLS LAST, p.id DESC`,
        [normalizedWorkspaceId],
      );

      return res.status(200).json(projectsResult.rows);
    } catch (error) {
      console.error("Get Individual workspace projects error:", error.message);

      return res.status(500).json({
        error: "Unable to load projects for this Individual workspace",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get Projects Assigned to the Current Individual User
|--------------------------------------------------------------------------
|
| This is the endpoint used by UserDash.jsx.
| It returns only projects linked to accepted invitations for the
| currently logged-in user.
|
*/

router.get(
  "/individual/:workspaceId/my-assigned-projects",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Individual workspace ID is required",
      });
    }

    try {
      const userResult = await pool.query(
        `SELECT
           id,
           email,
           account_status,
           must_change_password
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "Your ZYRA account could not be found",
        });
      }

      const user = userResult.rows[0];

      if (user.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: "Your ZYRA account is not active",
        });
      }

      if (user.must_change_password) {
        return res.status(403).json({
          error: "Please change your initial password before viewing projects",
          must_change_password: true,
        });
      }

      const membershipResult = await pool.query(
        `SELECT
           w.id,
           w.name,
           w.type,
           wm.role
         FROM workspace_members wm
         JOIN workspaces w
           ON w.id = wm.workspace_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
         LIMIT 1`,
        [workspaceId, user.id],
      );

      if (membershipResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this workspace",
        });
      }

      const workspace = membershipResult.rows[0];

      if (workspace.type !== "INDIVIDUAL" || workspace.role !== "USER") {
        return res.status(403).json({
          error:
            "This endpoint is only available to USER members of an Individual workspace",
        });
      }

      const projectsResult = await pool.query(
        `SELECT DISTINCT
           p.id,
           p.name,
           p.description,
           p.team_id,
           p.created_by,
           p.created_at,
           t.workspace_id
         FROM employee_invitations ei
         JOIN projects p
           ON p.id = ei.project_id
         JOIN teams t
           ON t.id = p.team_id
         WHERE ei.workspace_id = $1
           AND LOWER(TRIM(ei.invited_email)) = LOWER(TRIM($2))
           AND ei.status = 'ACCEPTED'
           AND ei.project_id IS NOT NULL
           AND t.workspace_id = $1
         ORDER BY
           p.created_at DESC NULLS LAST,
           p.id DESC`,
        [workspaceId, user.email],
      );

      return res.status(200).json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          role: workspace.role,
        },
        projects: projectsResult.rows,
      });
    } catch (error) {
      console.error("Get assigned Individual projects error:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve your assigned projects",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Invite a Member to an Individual Workspace
|--------------------------------------------------------------------------
*/

router.post(
  "/individual/:workspaceId/invitations",
  authMiddleware,
  async (req, res) => {
    const { workspaceId } = req.params;
    const { email, role, projectId, temporaryPassword } = req.body || {};
    const parsedProjectId = Number(projectId);

    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
      return res.status(400).json({
        message: "A valid projectId is required.",
      });
    }

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        error: "Member email is required",
      });
    }

    if (typeof role !== "string" || !role.trim()) {
      return res.status(400).json({
        error: "Member role is required",
      });
    }

    const normalizedWorkspaceId = Number(workspaceId);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();

    if (
      !Number.isInteger(normalizedWorkspaceId) ||
      normalizedWorkspaceId <= 0
    ) {
      return res.status(400).json({
        error: "A valid Individual workspace ID is required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Please enter a valid email address",
      });
    }

    if (!["TEAM_LEADER", "USER"].includes(normalizedRole)) {
      return res.status(400).json({
        error: "An Individual Team Leader can invite TEAM_LEADER or USER only",
      });
    }

    try {
      const requesterResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.type AS workspace_type,
           wm.role AS requester_role,
           (
             UPPER(TRIM(wm.role::TEXT)) = 'TEAM_LEADER'
             OR EXISTS (
               SELECT 1
               FROM workspace_member_roles wmr
               WHERE wmr.workspace_member_id = wm.id
                 AND UPPER(TRIM(wmr.role::TEXT)) = 'TEAM_LEADER'
             )
           ) AS is_team_leader
         FROM workspace_members wm
         JOIN workspaces w
           ON w.id = wm.workspace_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
           AND w.type = 'INDIVIDUAL'
         LIMIT 1`,
        [normalizedWorkspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this Individual workspace",
        });
      }

      const workspace = requesterResult.rows[0];

      if (!workspace.is_team_leader) {
        return res.status(403).json({
          error: "Only the Individual Team Leader can create invitations",
        });
      }

      const projectResult = await pool.query(
        `SELECT
           p.id,
           p.name,
           p.description
         FROM projects p
         JOIN teams t
           ON t.id = p.team_id
         WHERE p.id = $1
           AND t.workspace_id = $2
         LIMIT 1`,
        [parsedProjectId, normalizedWorkspaceId],
      );

      if (projectResult.rows.length === 0) {
        return res.status(400).json({
          error: "The selected project does not belong to this workspace",
        });
      }

      const project = projectResult.rows[0];

      const existingUserResult = await pool.query(
        `SELECT
           id,
           name,
           email,
           account_status,
           must_change_password,
           password AS password_hash
         FROM users
         WHERE LOWER(TRIM(email)) = $1
         LIMIT 1`,
        [normalizedEmail],
      );

      if (existingUserResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "No ZYRA account exists for this email. Create the member account first.",
        });
      }

      const existingUser = existingUserResult.rows[0];

      if (existingUser.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: "This account is not active and cannot receive an invitation",
          account_status: existingUser.account_status,
        });
      }

      let individualTemporaryPassword = null;

      if (existingUser.must_change_password) {
        if (
          typeof temporaryPassword !== "string" ||
          temporaryPassword.length === 0
        ) {
          return res.status(400).json({
            error:
              "The member account requires its temporary password before the invitation can be emailed.",
            must_change_password: true,
          });
        }

        if (Buffer.byteLength(temporaryPassword, "utf8") > 72) {
          return res.status(400).json({
            error:
              "The temporary password exceeds the supported password length.",
          });
        }

        const temporaryPasswordMatches = await bcrypt.compare(
          temporaryPassword,
          existingUser.password_hash,
        );

        if (!temporaryPasswordMatches) {
          return res.status(401).json({
            error:
              "The supplied temporary password does not match this member account.",
          });
        }

        individualTemporaryPassword = temporaryPassword;
      }

      const existingMembershipResult = await pool.query(
        `SELECT id
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2
         LIMIT 1`,
        [normalizedWorkspaceId, existingUser.id],
      );

      if (existingMembershipResult.rows.length > 0) {
        return res.status(409).json({
          error: "This user is already a member of this workspace",
        });
      }

      const pendingInvitationResult = await pool.query(
        `SELECT id, expires_at
         FROM employee_invitations
         WHERE workspace_id = $1
           AND LOWER(TRIM(invited_email)) = $2
           AND status = 'PENDING'
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalizedWorkspaceId, normalizedEmail],
      );

      if (pendingInvitationResult.rows.length > 0) {
        const existingInvitation = pendingInvitationResult.rows[0];

        if (new Date(existingInvitation.expires_at) > new Date()) {
          return res.status(409).json({
            error: "A pending invitation already exists for this email",
          });
        }

        await pool.query(
          `UPDATE employee_invitations
           SET status = 'EXPIRED'
           WHERE id = $1
             AND status = 'PENDING'`,
          [existingInvitation.id],
        );
      }

      const invitationToken = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(invitationToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const invitationResult = await pool.query(
        `INSERT INTO employee_invitations
         (
           workspace_id,
           project_id,
           invited_email,
           invited_by,
           role,
           token_hash,
           status,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
         RETURNING
           id,
           workspace_id,
           project_id,
           invited_email,
           invited_by,
           role,
           status,
           expires_at,
           created_at`,
        [
          normalizedWorkspaceId,
          parsedProjectId,
          normalizedEmail,
          req.user.id,
          normalizedRole,
          tokenHash,
          expiresAt,
        ],
      );

      const invitation = invitationResult.rows[0];

      const frontendUrl = (
        process.env.FRONTEND_URL || "http://localhost:5173"
      ).replace(/\/+$/, "");

      const individualLoginUrl = `${frontendUrl}/login?email=${encodeURIComponent(normalizedEmail)}`;

      try {
        await sendIndividualInvitationEmail(
          normalizedEmail,
          existingUser.name || "there",
          workspace.workspace_name,
          normalizedRole,
          individualTemporaryPassword,
          individualLoginUrl,
        );
      } catch (emailError) {
        await pool.query(
          `UPDATE employee_invitations
           SET status = 'CANCELLED'
           WHERE id = $1
             AND status = 'PENDING'`,
          [invitation.id],
        );

        console.error("Individual invitation email error:", emailError.message);

        return res.status(500).json({
          error:
            "The Individual invitation could not be sent. Please try again.",
        });
      }

      try {
        await pool.query(
          `INSERT INTO notifications
           (
             user_id,
             title,
             message,
             notification_type,
             reference_id
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            existingUser.id,
            "Individual Workspace Invitation",
            `You have been invited to join ${workspace.workspace_name} as ${normalizedRole}. Invitation ID: ${invitation.id}. Review and accept the invitation after changing your initial password if required.`,
            "EMPLOYEE_INVITATION",
            invitation.id,
          ],
        );
      } catch (notificationError) {
        console.error(
          "Individual invitation notification error:",
          notificationError.message,
        );
      }

      return res.status(201).json({
        message: "Individual invitation sent successfully",
        invitation,
        account: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          account_status: existingUser.account_status,
        },
        workspace: {
          id: workspace.workspace_id,
          name: workspace.workspace_name,
          type: workspace.workspace_type,
        },
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
        },
        membership_created: false,
        next_step:
          "The member must complete any required initial password change and explicitly accept this invitation.",
      });
    } catch (error) {
      console.error("Create Individual invitation error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "A duplicate invitation or membership already exists",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace, project, or user relationship not found",
        });
      }

      return res.status(500).json({
        error: "Unable to create the Individual invitation. Please try again.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get Individual Workspace Invitation Counts and Details
|--------------------------------------------------------------------------
*/

router.get(
  "/individual/:workspaceId/invitations",
  authMiddleware,
  async (req, res) => {
    const normalizedWorkspaceId = Number(req.params.workspaceId);

    if (
      !Number.isInteger(normalizedWorkspaceId) ||
      normalizedWorkspaceId <= 0
    ) {
      return res.status(400).json({
        error: "A valid Individual workspace ID is required",
      });
    }

    try {
      const requesterResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.type AS workspace_type,
           wm.role AS requester_role,
           (
             UPPER(TRIM(wm.role::TEXT)) = 'TEAM_LEADER'
             OR EXISTS (
               SELECT 1
               FROM workspace_member_roles wmr
               WHERE wmr.workspace_member_id = wm.id
                 AND UPPER(TRIM(wmr.role::TEXT)) = 'TEAM_LEADER'
             )
           ) AS is_team_leader
         FROM workspace_members wm
         JOIN workspaces w
           ON w.id = wm.workspace_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
           AND w.type = 'INDIVIDUAL'
         LIMIT 1`,
        [normalizedWorkspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this Individual workspace",
        });
      }

      const workspace = requesterResult.rows[0];

      if (!workspace.is_team_leader) {
        return res.status(403).json({
          error: "Only the Individual Team Leader can view invitation details",
        });
      }

      const countsResult = await pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE status = 'PENDING'
               AND expires_at > CURRENT_TIMESTAMP
           )::int AS pending_count,
           COUNT(*) FILTER (
             WHERE status = 'ACCEPTED'
           )::int AS accepted_count
         FROM employee_invitations
         WHERE workspace_id = $1`,
        [normalizedWorkspaceId],
      );

      const counts = countsResult.rows[0];

      const invitationsResult = await pool.query(
        `SELECT
           ei.id,
           ei.workspace_id,
           ei.project_id,
           ei.invited_email,
           COALESCE(
             NULLIF(TRIM(u.name), ''),
             ei.invited_email
           ) AS invitee_name,
           ei.role,
           ei.status,
           ei.expires_at,
           ei.created_at,
           p.name AS project_name
         FROM employee_invitations ei
         LEFT JOIN users u
           ON LOWER(TRIM(u.email)) = LOWER(TRIM(ei.invited_email))
         LEFT JOIN projects p
           ON p.id = ei.project_id
         WHERE ei.workspace_id = $1
           AND (
             (
               ei.status = 'PENDING'
               AND ei.expires_at > CURRENT_TIMESTAMP
             )
             OR ei.status = 'ACCEPTED'
           )
         ORDER BY
           CASE
             WHEN ei.status = 'PENDING' THEN 0
             ELSE 1
           END,
           ei.created_at DESC`,
        [normalizedWorkspaceId],
      );

      return res.status(200).json({
        message: "Invitation details retrieved successfully",
        workspace: {
          id: workspace.workspace_id,
          name: workspace.workspace_name,
          type: workspace.workspace_type,
        },
        counts: {
          pending: counts.pending_count,
          accepted: counts.accepted_count,
        },
        invitations: invitationsResult.rows,
      });
    } catch (error) {
      console.error(
        "Get Individual workspace invitation details error:",
        error.message,
      );

      return res.status(500).json({
        error: "Unable to retrieve invitation details",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get My Pending Invitations
|--------------------------------------------------------------------------
*/

router.get("/my-invitations", authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, email, account_status, must_change_password
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "Your ZYRA account could not be found",
      });
    }

    const user = userResult.rows[0];

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: "Your ZYRA account is not active",
      });
    }

    if (user.must_change_password) {
      return res.status(403).json({
        error:
          "Please change your initial password before reviewing invitations",
        must_change_password: true,
      });
    }

    const result = await pool.query(
      `SELECT
         ei.id AS invitation_id,
         ei.project_id,
         ei.workspace_id,
         ei.invited_email,
         ei.role,
         ei.status,
         ei.expires_at,
         ei.created_at,
         p.name AS project_name,
         p.team_id AS project_team_id,
         w.name AS workspace_name,
         w.type AS workspace_type,
         o.name AS organization_name,
         o.organization_id AS public_organization_id
       FROM employee_invitations ei
       JOIN workspaces w
         ON w.id = ei.workspace_id
       LEFT JOIN organizations o
         ON o.id = w.organization_id
       LEFT JOIN projects p
         ON p.id = ei.project_id
       WHERE LOWER(TRIM(ei.invited_email)) = LOWER(TRIM($1))
         AND ei.status = 'PENDING'
         AND ei.expires_at > CURRENT_TIMESTAMP
         AND (
           w.type = 'INDIVIDUAL'
           OR (
             w.type = 'COMPANY'
             AND o.verification_status = 'VERIFIED'
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM workspace_members wm
           WHERE wm.workspace_id = ei.workspace_id
             AND wm.user_id = $2
         )
       ORDER BY ei.created_at DESC`,
      [user.email, user.id],
    );

    return res.status(200).json({
      invitations: result.rows,
    });
  } catch (error) {
    console.error("Get pending invitations error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve your pending invitations",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Validate Employee Invitation by Token
|--------------------------------------------------------------------------
*/

router.get("/invitations/:token", async (req, res) => {
  const { token } = req.params;

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      error: "Invitation token is required",
    });
  }

  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const invitationResult = await pool.query(
      `SELECT
         ei.id,
         ei.project_id,
         ei.workspace_id,
         ei.invited_email,
         ei.role,
         ei.status,
         ei.expires_at,
         ei.created_at,
         ip.name AS project_name,
         ip.team_id AS project_team_id,
         it.workspace_id AS project_workspace_id,
         w.name AS workspace_name,
         w.type AS workspace_type,
         w.organization_id,
         o.organization_id AS public_organization_id,
         o.name AS organization_name,
         o.type AS organization_type,
         o.verification_status AS organization_verification_status
       FROM employee_invitations ei
       JOIN workspaces w
         ON ei.workspace_id = w.id
       LEFT JOIN organizations o
         ON w.organization_id = o.id
       LEFT JOIN projects ip
         ON ip.id = ei.project_id
       LEFT JOIN teams it
         ON it.id = ip.team_id
       WHERE ei.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        error: "Invalid or expired invitation",
      });
    }

    const invitation = invitationResult.rows[0];

    if (invitation.status !== "PENDING") {
      return res.status(400).json({
        error: "This invitation is no longer active",
        status: invitation.status,
      });
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      await pool.query(
        `UPDATE employee_invitations
         SET status = 'EXPIRED'
         WHERE id = $1
           AND status = 'PENDING'`,
        [invitation.id],
      );

      return res.status(400).json({
        error: "This invitation has expired",
      });
    }

    if (!["INDIVIDUAL", "COMPANY"].includes(invitation.workspace_type)) {
      return res.status(400).json({
        error: "This invitation has an unsupported workspace type",
      });
    }

    if (invitation.workspace_type === "COMPANY") {
      if (!invitation.organization_id || !invitation.public_organization_id) {
        return res.status(400).json({
          error: "Organization information is unavailable for this invitation",
        });
      }

      if (invitation.organization_verification_status !== "VERIFIED") {
        return res.status(400).json({
          error: "This organization is not currently verified",
        });
      }
    }

    return res.status(200).json({
      message: "Invitation is valid",
      invitation: {
        id: invitation.id,
        email: invitation.invited_email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      },
      organization:
        invitation.workspace_type === "COMPANY"
          ? {
              organization_id: invitation.public_organization_id,
              name: invitation.organization_name,
              type: invitation.organization_type,
            }
          : null,
      workspace: {
        id: invitation.workspace_id,
        name: invitation.workspace_name,
        type: invitation.workspace_type,
      },
      project: invitation.project_id
        ? {
            id: invitation.project_id,
            name: invitation.project_name,
            team_id: invitation.project_team_id,
          }
        : null,
    });
  } catch (error) {
    console.error("Invitation validation error:", error.message);

    return res.status(500).json({
      error: "Unable to validate invitation",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Validate Employee Invitation by ID
|--------------------------------------------------------------------------
*/

router.get(
  "/invitations/id/:invitationId",
  authMiddleware,
  async (req, res) => {
    const invitationId = Number(req.params.invitationId);

    if (!Number.isInteger(invitationId) || invitationId <= 0) {
      return res.status(400).json({
        error: "Valid invitation ID is required",
      });
    }

    try {
      const invitationResult = await pool.query(
        `SELECT
           ei.id,
           ei.project_id,
           ei.workspace_id,
           ei.invited_email,
           ei.role,
           ei.status,
           ei.expires_at,
           ei.created_at,
           ip.name AS project_name,
           ip.team_id AS project_team_id,
           it.workspace_id AS project_workspace_id,
           w.name AS workspace_name,
           w.type AS workspace_type,
           w.organization_id,
           o.organization_id AS public_organization_id,
           o.name AS organization_name,
           o.type AS organization_type,
           o.verification_status AS organization_verification_status
         FROM employee_invitations ei
         JOIN workspaces w
           ON ei.workspace_id = w.id
         LEFT JOIN organizations o
           ON w.organization_id = o.id
         LEFT JOIN projects ip
           ON ip.id = ei.project_id
         LEFT JOIN teams it
           ON it.id = ip.team_id
         WHERE ei.id = $1
         LIMIT 1`,
        [invitationId],
      );

      if (invitationResult.rows.length === 0) {
        return res.status(404).json({
          error: "Invitation not found",
        });
      }

      const invitation = invitationResult.rows[0];

      const userResult = await pool.query(
        `SELECT id, name, email, account_status, must_change_password
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "Logged-in user not found",
        });
      }

      const user = userResult.rows[0];

      if (user.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: "Your ZYRA account is not active",
        });
      }

      if (user.must_change_password) {
        return res.status(403).json({
          error: "Change your initial password before reviewing invitations",
          must_change_password: true,
        });
      }

      if (
        invitation.invited_email.trim().toLowerCase() !==
        user.email.trim().toLowerCase()
      ) {
        return res.status(403).json({
          error: "This invitation was issued for a different email address",
        });
      }

      if (invitation.status !== "PENDING") {
        return res.status(400).json({
          error: "This invitation is no longer active",
          status: invitation.status,
        });
      }

      if (new Date(invitation.expires_at) <= new Date()) {
        await pool.query(
          `UPDATE employee_invitations
           SET status = 'EXPIRED'
           WHERE id = $1
             AND status = 'PENDING'`,
          [invitation.id],
        );

        return res.status(400).json({
          error: "This invitation has expired",
        });
      }

      if (!["INDIVIDUAL", "COMPANY"].includes(invitation.workspace_type)) {
        return res.status(400).json({
          error: "This invitation has an unsupported workspace type",
        });
      }

      if (invitation.workspace_type === "COMPANY") {
        if (!invitation.organization_id || !invitation.public_organization_id) {
          return res.status(400).json({
            error:
              "Organization information is unavailable for this invitation",
          });
        }

        if (invitation.organization_verification_status !== "VERIFIED") {
          return res.status(400).json({
            error: "This organization is not currently verified",
          });
        }
      }

      const membershipResult = await pool.query(
        `SELECT id, role
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2
         LIMIT 1`,
        [invitation.workspace_id, user.id],
      );

      if (membershipResult.rows.length > 0) {
        return res.status(409).json({
          error: "You are already a member of this workspace",
        });
      }

      return res.status(200).json({
        message: "Invitation is valid",
        invitation: {
          id: invitation.id,
          email: invitation.invited_email,
          role: invitation.role,
          status: invitation.status,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
        },
        organization:
          invitation.workspace_type === "COMPANY"
            ? {
                organization_id: invitation.public_organization_id,
                name: invitation.organization_name,
                type: invitation.organization_type,
              }
            : null,
        workspace: {
          id: invitation.workspace_id,
          name: invitation.workspace_name,
          type: invitation.workspace_type,
        },
        project: invitation.project_id
          ? {
              id: invitation.project_id,
              name: invitation.project_name,
              team_id: invitation.project_team_id,
            }
          : null,
      });
    } catch (error) {
      console.error("Invitation validation by ID error:", error.message);

      return res.status(500).json({
        error: "Unable to validate invitation",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Accept Employee Invitation by ID
|--------------------------------------------------------------------------
*/

router.post(
  "/invitations/id/:invitationId/accept",
  authMiddleware,
  async (req, res) => {
    const invitationId = Number(req.params.invitationId);

    if (!Number.isInteger(invitationId) || invitationId <= 0) {
      return res.status(400).json({
        error: "Valid invitation ID is required",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const invitationResult = await client.query(
        `SELECT
           ei.id,
           ei.workspace_id,
           ei.project_id,
           ei.invited_by,
           ei.invited_email,
           ei.role,
           ei.status,
           ei.expires_at,
           ei.created_at,
           ip.name AS project_name,
           ip.team_id AS project_team_id,
           it.workspace_id AS project_workspace_id,
           w.name AS workspace_name,
           w.type AS workspace_type,
           w.organization_id,
           o.organization_id AS public_organization_id,
           o.name AS organization_name,
           o.verification_status AS organization_verification_status
         FROM employee_invitations ei
         JOIN workspaces w
           ON ei.workspace_id = w.id
         LEFT JOIN organizations o
           ON w.organization_id = o.id
         LEFT JOIN projects ip
           ON ip.id = ei.project_id
         LEFT JOIN teams it
           ON it.id = ip.team_id
         WHERE ei.id = $1
         FOR UPDATE OF ei`,
        [invitationId],
      );

      if (invitationResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Invitation not found",
        });
      }

      const invitation = invitationResult.rows[0];

      if (invitation.status !== "PENDING") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This invitation is no longer active",
          status: invitation.status,
        });
      }

      if (new Date(invitation.expires_at) <= new Date()) {
        await client.query(
          `UPDATE employee_invitations
           SET status = 'EXPIRED'
           WHERE id = $1
             AND status = 'PENDING'`,
          [invitation.id],
        );

        await client.query("COMMIT");

        return res.status(400).json({
          error: "This invitation has expired",
        });
      }

      if (!["INDIVIDUAL", "COMPANY"].includes(invitation.workspace_type)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This invitation has an unsupported workspace type",
        });
      }

      if (invitation.workspace_type === "COMPANY") {
        if (!invitation.organization_id || !invitation.public_organization_id) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error: "Organization information is unavailable",
          });
        }

        if (invitation.organization_verification_status !== "VERIFIED") {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error: "This organization is not currently verified",
          });
        }
      }

      const userResult = await client.query(
        `SELECT id, name, email, account_status, must_change_password
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Logged-in user not found",
        });
      }

      const user = userResult.rows[0];

      if (user.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Your ZYRA account is not active",
        });
      }

      if (user.must_change_password) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Change your initial password before accepting invitations",
          must_change_password: true,
        });
      }

      if (
        invitation.invited_email.trim().toLowerCase() !==
        user.email.trim().toLowerCase()
      ) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "This invitation was issued for a different email address",
        });
      }

      let project = null;
      let teamMembership = null;

      if (invitation.workspace_type === "INDIVIDUAL") {
        if (
          !invitation.project_id ||
          !invitation.project_team_id ||
          Number(invitation.project_workspace_id) !==
            Number(invitation.workspace_id)
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "This Individual invitation has no valid assigned project. Ask the Team Leader to send a new invitation with a project selected.",
          });
        }

        project = {
          id: invitation.project_id,
          name: invitation.project_name,
          team_id: invitation.project_team_id,
        };
      }

      const existingMembershipResult = await client.query(
        `SELECT id, role
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2
         LIMIT 1`,
        [invitation.workspace_id, user.id],
      );

      if (existingMembershipResult.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error: "You are already a member of this workspace",
        });
      }

      const membershipResult = await client.query(
        `INSERT INTO workspace_members
         (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING id, workspace_id, user_id, role, joined_at`,
        [invitation.workspace_id, user.id, invitation.role],
      );

      let organizationMember = null;

      if (invitation.workspace_type === "COMPANY") {
        const organizationMemberResult = await client.query(
          `INSERT INTO organization_members
           (organization_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (organization_id, user_id) DO NOTHING
           RETURNING id, organization_id, user_id, joined_at`,
          [invitation.organization_id, user.id],
        );

        organizationMember = organizationMemberResult.rows[0] || null;
      }

      /*
       * Automatically assign a Team Leader to the active HR who invited them
       * when they accept a Company invitation. ADMIN invitations are not
       * automatically associated with an HR; Admin can assign them separately.
       */

      if (
        invitation.workspace_type === "COMPANY" &&
        invitation.role === "TEAM_LEADER" &&
        invitation.invited_by &&
        invitation.organization_id
      ) {
        const inviterResult = await client.query(
          `SELECT wm.role, u.account_status
           FROM workspace_members wm
           JOIN users u ON u.id = wm.user_id
           WHERE wm.workspace_id = $1
             AND wm.user_id = $2
           LIMIT 1`,
          [invitation.workspace_id, invitation.invited_by],
        );

        const inviter = inviterResult.rows[0];

        if (
          inviter &&
          inviter.role === "HR" &&
          inviter.account_status === "ACTIVE"
        ) {
          await client.query(
            `INSERT INTO organization_hr_team_leader_assignments
             (organization_id, hr_user_id, team_leader_user_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, team_leader_user_id)
             DO UPDATE SET
               hr_user_id = EXCLUDED.hr_user_id,
               assigned_by = EXCLUDED.assigned_by,
               updated_at = CURRENT_TIMESTAMP`,
            [
              invitation.organization_id,
              invitation.invited_by,
              user.id,
              invitation.invited_by,
            ],
          );

          console.log(
            `HR ${invitation.invited_by} assigned to Team Leader ${user.id} in organization ${invitation.organization_id}`,
          );
        }
      }

      if (invitation.workspace_type === "INDIVIDUAL" && project) {
        const teamMembershipResult = await client.query(
          `INSERT INTO team_members
           (team_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING team_id, user_id`,
          [project.team_id, user.id],
        );

        if (teamMembershipResult.rows.length > 0) {
          teamMembership = teamMembershipResult.rows[0];
        } else {
          const existingTeamMembershipResult = await client.query(
            `SELECT team_id, user_id
             FROM team_members
             WHERE team_id = $1
               AND user_id = $2
             LIMIT 1`,
            [project.team_id, user.id],
          );

          teamMembership = existingTeamMembershipResult.rows[0] || null;
        }
      }

      const acceptedInvitationResult = await client.query(
        `UPDATE employee_invitations
         SET status = 'ACCEPTED'
         WHERE id = $1
           AND status = 'PENDING'
         RETURNING
           id,
           project_id,
           workspace_id,
           invited_email,
           role,
           status,
           expires_at,
           created_at`,
        [invitation.id],
      );

      if (acceptedInvitationResult.rows.length === 0) {
        throw new Error("Invitation could not be marked as accepted");
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Invitation accepted successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        organization:
          invitation.workspace_type === "COMPANY"
            ? {
                organization_id: invitation.public_organization_id,
                name: invitation.organization_name,
              }
            : null,
        workspace: {
          id: invitation.workspace_id,
          name: invitation.workspace_name,
          type: invitation.workspace_type,
        },
        project,
        membership: membershipResult.rows[0],
        organization_membership: organizationMember,
        team_membership: teamMembership,
        invitation: acceptedInvitationResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Accept invitation rollback error:",
          rollbackError.message,
        );
      }

      console.error("Accept employee invitation by ID error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "You are already a member of this workspace",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error:
            "Workspace, project, team, user, or organization relationship not found",
        });
      }

      return res.status(500).json({
        error: "Unable to accept invitation",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Decline Employee Invitation by ID
|--------------------------------------------------------------------------
*/

router.post(
  "/invitations/id/:invitationId/decline",
  authMiddleware,
  async (req, res) => {
    const invitationId = Number(req.params.invitationId);

    if (!Number.isInteger(invitationId) || invitationId <= 0) {
      return res.status(400).json({
        error: "Valid invitation ID is required",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const invitationResult = await client.query(
        `SELECT
           id,
           invited_email,
           status,
           expires_at
         FROM employee_invitations
         WHERE id = $1
         FOR UPDATE`,
        [invitationId],
      );

      if (invitationResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Invitation not found",
        });
      }

      const invitation = invitationResult.rows[0];

      const userResult = await client.query(
        `SELECT
           id,
           email,
           account_status,
           must_change_password
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Logged-in user not found",
        });
      }

      const user = userResult.rows[0];

      if (user.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Your ZYRA account is not active",
        });
      }

      if (user.must_change_password) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Change your initial password before reviewing invitations",
          must_change_password: true,
        });
      }

      if (
        invitation.invited_email.trim().toLowerCase() !==
        user.email.trim().toLowerCase()
      ) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "This invitation was issued for a different email address",
        });
      }

      if (invitation.status !== "PENDING") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This invitation is no longer active",
          status: invitation.status,
        });
      }

      if (new Date(invitation.expires_at) <= new Date()) {
        await client.query(
          `UPDATE employee_invitations
           SET status = 'EXPIRED'
           WHERE id = $1
             AND status = 'PENDING'`,
          [invitation.id],
        );

        await client.query("COMMIT");

        return res.status(400).json({
          error: "This invitation has expired",
        });
      }

      const cancelledInvitationResult = await client.query(
        `UPDATE employee_invitations
         SET status = 'CANCELLED'
         WHERE id = $1
           AND status = 'PENDING'
         RETURNING
           id,
           workspace_id,
           invited_email,
           role,
           status,
           expires_at,
           created_at`,
        [invitation.id],
      );

      if (cancelledInvitationResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "The invitation could not be declined because it is no longer pending",
        });
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Invitation declined successfully",
        invitation: cancelledInvitationResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Decline invitation rollback error:",
          rollbackError.message,
        );
      }

      console.error("Decline employee invitation error:", error.message);

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Invitation or user relationship not found",
        });
      }

      return res.status(500).json({
        error: "Unable to decline invitation",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Accept Employee Invitation by Token
|--------------------------------------------------------------------------
*/

router.post("/invitations/:token/accept", authMiddleware, async (req, res) => {
  const { token } = req.params;

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      error: "Invitation token is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    const invitationResult = await client.query(
      `SELECT
         ei.id,
         ei.project_id,
         ei.workspace_id,
         ei.invited_by,
         ei.invited_email,
         ei.role,
         ei.status,
         ei.expires_at,
         ei.created_at,
         ip.name AS project_name,
         ip.team_id AS project_team_id,
         it.workspace_id AS project_workspace_id,
         w.name AS workspace_name,
         w.type AS workspace_type,
         w.organization_id,
         o.organization_id AS public_organization_id,
         o.name AS organization_name,
         o.verification_status AS organization_verification_status
       FROM employee_invitations ei
       JOIN workspaces w
         ON ei.workspace_id = w.id
       LEFT JOIN organizations o
         ON w.organization_id = o.id
       LEFT JOIN projects ip
         ON ip.id = ei.project_id
       LEFT JOIN teams it
         ON it.id = ip.team_id
       WHERE ei.token_hash = $1
       FOR UPDATE OF ei`,
      [tokenHash],
    );

    if (invitationResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Invalid or expired invitation",
      });
    }

    const invitation = invitationResult.rows[0];

    if (invitation.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "This invitation is no longer active",
        status: invitation.status,
      });
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      await client.query(
        `UPDATE employee_invitations
         SET status = 'EXPIRED'
         WHERE id = $1
           AND status = 'PENDING'`,
        [invitation.id],
      );

      await client.query("COMMIT");

      return res.status(400).json({
        error: "This invitation has expired",
      });
    }

    if (!["INDIVIDUAL", "COMPANY"].includes(invitation.workspace_type)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "This invitation has an unsupported workspace type",
      });
    }

    if (invitation.workspace_type === "COMPANY") {
      if (!invitation.organization_id || !invitation.public_organization_id) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Organization information is unavailable",
        });
      }

      if (invitation.organization_verification_status !== "VERIFIED") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This organization is not currently verified",
        });
      }
    }

    const userResult = await client.query(
      `SELECT id, name, email, account_status, must_change_password
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Logged-in user not found",
      });
    }

    const user = userResult.rows[0];

    if (user.account_status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Your ZYRA account is not active",
      });
    }

    if (user.must_change_password) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Change your initial password before accepting invitations",
        must_change_password: true,
      });
    }

    if (
      invitation.invited_email.trim().toLowerCase() !==
      user.email.trim().toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "This invitation was issued for a different email address",
      });
    }

    let project = null;
    let teamMembership = null;

    if (invitation.workspace_type === "INDIVIDUAL") {
      if (
        !invitation.project_id ||
        !invitation.project_team_id ||
        Number(invitation.project_workspace_id) !==
          Number(invitation.workspace_id)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "This Individual invitation has no valid assigned project. Ask the Team Leader to send a new invitation with a project selected.",
        });
      }

      project = {
        id: invitation.project_id,
        name: invitation.project_name,
        team_id: invitation.project_team_id,
      };
    }

    const existingMembershipResult = await client.query(
      `SELECT id, role
       FROM workspace_members
       WHERE workspace_id = $1
         AND user_id = $2
       LIMIT 1`,
      [invitation.workspace_id, user.id],
    );

    if (existingMembershipResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "You are already a member of this workspace",
      });
    }

    const membershipResult = await client.query(
      `INSERT INTO workspace_members
       (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, workspace_id, user_id, role, joined_at`,
      [invitation.workspace_id, user.id, invitation.role],
    );

    let organizationMember = null;

    if (invitation.workspace_type === "COMPANY") {
      const organizationMemberResult = await client.query(
        `INSERT INTO organization_members
         (organization_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (organization_id, user_id) DO NOTHING
         RETURNING id, organization_id, user_id, joined_at`,
        [invitation.organization_id, user.id],
      );

      organizationMember = organizationMemberResult.rows[0] || null;
    }

    /*
     * Automatically assign a Team Leader to the active HR who invited them
     * when they accept a Company invitation. ADMIN invitations are not
     * automatically associated with an HR; Admin can assign them separately.
     */

    if (
      invitation.workspace_type === "COMPANY" &&
      invitation.role === "TEAM_LEADER" &&
      invitation.invited_by &&
      invitation.organization_id
    ) {
      const inviterResult = await client.query(
        `SELECT wm.role, u.account_status
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
         LIMIT 1`,
        [invitation.workspace_id, invitation.invited_by],
      );

      const inviter = inviterResult.rows[0];

      if (
        inviter &&
        inviter.role === "HR" &&
        inviter.account_status === "ACTIVE"
      ) {
        await client.query(
          `INSERT INTO organization_hr_team_leader_assignments
           (organization_id, hr_user_id, team_leader_user_id, assigned_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, team_leader_user_id)
           DO UPDATE SET
             hr_user_id = EXCLUDED.hr_user_id,
             assigned_by = EXCLUDED.assigned_by,
             updated_at = CURRENT_TIMESTAMP`,
          [
            invitation.organization_id,
            invitation.invited_by,
            user.id,
            invitation.invited_by,
          ],
        );

        console.log(
          `HR ${invitation.invited_by} assigned to Team Leader ${user.id} in organization ${invitation.organization_id}`,
        );
      }
    }

    if (invitation.workspace_type === "INDIVIDUAL" && project) {
      const teamMembershipResult = await client.query(
        `INSERT INTO team_members
         (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING team_id, user_id`,
        [project.team_id, user.id],
      );

      if (teamMembershipResult.rows.length > 0) {
        teamMembership = teamMembershipResult.rows[0];
      } else {
        const existingTeamMembershipResult = await client.query(
          `SELECT team_id, user_id
           FROM team_members
           WHERE team_id = $1
             AND user_id = $2
           LIMIT 1`,
          [project.team_id, user.id],
        );

        teamMembership = existingTeamMembershipResult.rows[0] || null;
      }
    }

    const acceptedInvitationResult = await client.query(
      `UPDATE employee_invitations
       SET status = 'ACCEPTED'
       WHERE id = $1
         AND status = 'PENDING'
       RETURNING
         id,
         project_id,
         workspace_id,
         invited_email,
         role,
         status,
         expires_at,
         created_at`,
      [invitation.id],
    );

    if (acceptedInvitationResult.rows.length === 0) {
      throw new Error("Invitation could not be marked as accepted");
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Invitation accepted successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      organization:
        invitation.workspace_type === "COMPANY"
          ? {
              organization_id: invitation.public_organization_id,
              name: invitation.organization_name,
            }
          : null,
      workspace: {
        id: invitation.workspace_id,
        name: invitation.workspace_name,
        type: invitation.workspace_type,
      },
      project,
      membership: membershipResult.rows[0],
      organization_membership: organizationMember,
      team_membership: teamMembership,
      invitation: acceptedInvitationResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Accept invitation rollback error:", rollbackError.message);
    }

    console.error("Accept employee invitation error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "You are already a member of this workspace",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error:
          "Workspace, project, team, user, or organization relationship not found",
      });
    }

    return res.status(500).json({
      error: "Unable to accept invitation",
    });
  } finally {
    client.release();
  }
});

/*
|--------------------------------------------------------------------------
| Add TEAM_LEADER to a Company Workspace
|--------------------------------------------------------------------------
|
| HR ONLY
|
*/

router.post(
  "/company/:workspaceId/team-leaders",
  authMiddleware,
  async (req, res) => {
    const { userId } = req.body;
    const { workspaceId } = req.params;
    const client = await pool.connect();

    try {
      if (!userId) {
        return res.status(400).json({
          error: "User ID is required",
        });
      }

      await client.query("BEGIN");

      const hrResult = await client.query(
        `SELECT
           workspace_members.id,
           workspaces.organization_id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         JOIN organizations
           ON workspaces.organization_id = organizations.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'HR'
           AND workspaces.type = 'COMPANY'
           AND organizations.verification_status = 'VERIFIED'`,
        [workspaceId, req.user.id],
      );

      if (hrResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only Company HR can add Team Leaders",
        });
      }

      const workspace = hrResult.rows[0];

      const userResult = await client.query(
        `SELECT id, name, email
         FROM users
         WHERE id = $1`,
        [userId],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "User not found",
        });
      }

      const organizationMemberResult = await client.query(
        `INSERT INTO organization_members
         (organization_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (organization_id, user_id) DO NOTHING
         RETURNING id, organization_id, user_id, joined_at`,
        [workspace.organization_id, userId],
      );

      const memberResult = await client.query(
        `INSERT INTO workspace_members
         (workspace_id, user_id, role)
         VALUES ($1, $2, 'TEAM_LEADER')
         RETURNING id, workspace_id, user_id, role, joined_at`,
        [workspaceId, userId],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Team Leader added to company workspace successfully",
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0] || null,
        user: userResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Add company Team Leader rollback error:",
          rollbackError.message,
        );
      }

      console.error("Add company Team Leader error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "User is already a member of this workspace",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace, organization, or user not found",
        });
      }

      return res.status(500).json({
        error: "Database error",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get HR and Team Leader Assignments
|--------------------------------------------------------------------------
|
| ADMIN: Can see all assignments within the company.
| HR: Can see the Team Leaders assigned to them.
| TEAM_LEADER: Can see their assigned HR.
|
*/

router.get(
  "/company/:workspaceId/hr-team-leader-assignments",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    try {
      const accessResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.organization_id,
           wm.role AS requester_role
         FROM workspaces w
         JOIN organizations o
           ON o.id = w.organization_id
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this verified Company workspace",
        });
      }

      const access = accessResult.rows[0];
      const requesterRole = access.requester_role;

      if (!["ADMIN", "HR", "TEAM_LEADER"].includes(requesterRole)) {
        return res.status(403).json({
          error:
            "Only Company ADMIN, HR, and TEAM_LEADER can view these assignments",
        });
      }

      let visibilityCondition = "";
      const queryParams = [access.organization_id];

      if (requesterRole === "HR") {
        visibilityCondition = "AND a.hr_user_id = $2";
        queryParams.push(req.user.id);
      } else if (requesterRole === "TEAM_LEADER") {
        visibilityCondition = "AND a.team_leader_user_id = $2";
        queryParams.push(req.user.id);
      }

      const assignmentsResult = await pool.query(
        `SELECT
           a.id AS assignment_id,
           a.organization_id,

           a.hr_user_id,
           hr.name AS hr_name,
           hr.email AS hr_email,
           hr.account_status AS hr_account_status,

           a.team_leader_user_id,
           tl.name AS team_leader_name,
           tl.email AS team_leader_email,
           tl.account_status AS team_leader_account_status,

           a.assigned_by,
           assigner.name AS assigned_by_name,

           a.created_at,
           a.updated_at

         FROM organization_hr_team_leader_assignments a

         JOIN users hr
           ON hr.id = a.hr_user_id

         JOIN users tl
           ON tl.id = a.team_leader_user_id

         LEFT JOIN users assigner
           ON assigner.id = a.assigned_by

         WHERE a.organization_id = $1
           ${visibilityCondition}

         ORDER BY
           LOWER(hr.name),
           LOWER(tl.name),
           a.id`,
        queryParams,
      );

      return res.status(200).json({
        message: "HR reporting assignments retrieved successfully",
        workspaceId: access.workspace_id,
        organizationId: access.organization_id,
        assignments: assignmentsResult.rows,
      });
    } catch (error) {
      console.error("Get HR reporting assignments error:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve HR reporting assignments",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Assign or Reassign a Team Leader to an HR
|--------------------------------------------------------------------------
|
| COMPANY ADMIN ONLY
|
*/

router.post(
  "/company/:workspaceId/hr-team-leader-assignments",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);
    const { hrUserId, teamLeaderUserId } = req.body || {};

    const normalizedHrUserId = Number(hrUserId);
    const normalizedTeamLeaderUserId = Number(teamLeaderUserId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    if (
      !Number.isInteger(normalizedHrUserId) ||
      normalizedHrUserId <= 0 ||
      !Number.isInteger(normalizedTeamLeaderUserId) ||
      normalizedTeamLeaderUserId <= 0
    ) {
      return res.status(400).json({
        error: "Valid HR and Team Leader user IDs are required",
      });
    }

    if (normalizedHrUserId === normalizedTeamLeaderUserId) {
      return res.status(400).json({
        error: "An HR cannot be assigned as their own Team Leader",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /*
       * Confirm that the requester is the ADMIN of this
       * verified Company workspace.
       */

      const adminResult = await client.query(
        `SELECT
           w.id AS workspace_id,
           w.organization_id
         FROM workspaces w
         JOIN organizations o
           ON o.id = w.organization_id
         JOIN workspace_members admin_member
           ON admin_member.workspace_id = w.id
         WHERE w.id = $1
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'
           AND admin_member.user_id = $2
           AND admin_member.role = 'ADMIN'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (adminResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only a Company ADMIN can assign Team Leaders to HRs",
        });
      }

      const workspace = adminResult.rows[0];

      /*
       * Validate that both selected users belong to this
       * exact Company workspace and have the correct roles.
       */

      const selectedMembersResult = await client.query(
        `SELECT
           wm.user_id,
           wm.role,
           u.name,
           u.email,
           u.account_status
         FROM workspace_members wm
         JOIN users u
           ON u.id = wm.user_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = ANY($2::integer[])`,
        [
          workspace.workspace_id,
          [normalizedHrUserId, normalizedTeamLeaderUserId],
        ],
      );

      const selectedMembers = selectedMembersResult.rows;

      const hrMember = selectedMembers.find(
        (member) => Number(member.user_id) === normalizedHrUserId,
      );

      const teamLeaderMember = selectedMembers.find(
        (member) => Number(member.user_id) === normalizedTeamLeaderUserId,
      );

      if (!hrMember || hrMember.role !== "HR") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "The selected HR must have the HR role in this Company workspace",
        });
      }

      if (hrMember.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "The selected HR account is not active",
        });
      }

      if (!teamLeaderMember || teamLeaderMember.role !== "TEAM_LEADER") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "The selected Team Leader must have the TEAM_LEADER role in this Company workspace",
        });
      }

      if (teamLeaderMember.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "The selected Team Leader account is not active",
        });
      }

      /*
       * Each Team Leader can have only one HR assignment
       * within an organization.
       *
       * If an assignment already exists, update it instead
       * of creating a duplicate.
       */

      const assignmentResult = await client.query(
        `INSERT INTO organization_hr_team_leader_assignments
         (
           organization_id,
           hr_user_id,
           team_leader_user_id,
           assigned_by
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (
           organization_id,
           team_leader_user_id
         )
         DO UPDATE SET
           hr_user_id = EXCLUDED.hr_user_id,
           assigned_by = EXCLUDED.assigned_by,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          workspace.organization_id,
          normalizedHrUserId,
          normalizedTeamLeaderUserId,
          req.user.id,
        ],
      );

      /*
       * Return the saved relationship with the HR and
       * Team Leader names for verification.
       */

      const savedAssignmentResult = await client.query(
        `SELECT
           a.id AS assignment_id,
           a.organization_id,
           a.hr_user_id,
           hr.name AS hr_name,
           hr.email AS hr_email,
           a.team_leader_user_id,
           tl.name AS team_leader_name,
           tl.email AS team_leader_email,
           a.assigned_by,
           assigner.name AS assigned_by_name,
           a.created_at,
           a.updated_at
         FROM organization_hr_team_leader_assignments a
         JOIN users hr
           ON hr.id = a.hr_user_id
         JOIN users tl
           ON tl.id = a.team_leader_user_id
         LEFT JOIN users assigner
           ON assigner.id = a.assigned_by
         WHERE a.id = $1`,
        [assignmentResult.rows[0].id],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Team Leader successfully assigned to the HR",
        assignment: savedAssignmentResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("HR assignment rollback error:", rollbackError.message);
      }

      console.error("Assign Team Leader to HR error:", error.message);

      if (error.code === "23503") {
        return res.status(400).json({
          error:
            "The selected organization, HR, Team Leader, or assigning user does not exist",
        });
      }

      return res.status(500).json({
        error: "Unable to save the HR reporting assignment",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Add USER to a Company Workspace
|--------------------------------------------------------------------------
|
| TEAM_LEADER ONLY
|
*/

router.post("/company/:workspaceId/users", authMiddleware, async (req, res) => {
  const { userId } = req.body;
  const { workspaceId } = req.params;
  const client = await pool.connect();

  try {
    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    await client.query("BEGIN");

    const leaderResult = await client.query(
      `SELECT
         workspace_members.id,
         workspaces.organization_id
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       JOIN organizations
         ON workspaces.organization_id = organizations.id
       WHERE workspace_members.workspace_id = $1
         AND workspace_members.user_id = $2
         AND workspace_members.role = 'TEAM_LEADER'
         AND workspaces.type = 'COMPANY'
         AND organizations.verification_status = 'VERIFIED'`,
      [workspaceId, req.user.id],
    );

    if (leaderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Only Company Team Leaders can add Users",
      });
    }

    const workspace = leaderResult.rows[0];

    const userResult = await client.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "User not found",
      });
    }

    const organizationMemberResult = await client.query(
      `INSERT INTO organization_members
       (organization_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (organization_id, user_id) DO NOTHING
       RETURNING id, organization_id, user_id, joined_at`,
      [workspace.organization_id, userId],
    );

    const memberResult = await client.query(
      `INSERT INTO workspace_members
       (workspace_id, user_id, role)
       VALUES ($1, $2, 'USER')
       RETURNING id, workspace_id, user_id, role, joined_at`,
      [workspaceId, userId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "User added to company workspace successfully",
      membership: memberResult.rows[0],
      organization_membership: organizationMemberResult.rows[0] || null,
      user: userResult.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Add company User rollback error:", rollbackError.message);
    }

    console.error("Add company User error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "User is already a member of this workspace",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, organization, or user not found",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/*
|--------------------------------------------------------------------------
| Add a USER to a Project Workspace
|--------------------------------------------------------------------------
*/

router.post("/:workspaceId/members", authMiddleware, async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }

  try {
    const leaderResult = await pool.query(
      `SELECT workspace_members.id
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.workspace_id = $1
         AND workspace_members.user_id = $2
         AND workspace_members.role = 'TEAM_LEADER'
         AND workspaces.type = 'PROJECT'`,
      [req.params.workspaceId, req.user.id],
    );

    if (leaderResult.rows.length === 0) {
      return res.status(403).json({
        error: "Only the Project Team Leader can add users",
      });
    }

    const userResult = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const memberResult = await pool.query(
      `INSERT INTO workspace_members
       (workspace_id, user_id, role)
       VALUES ($1, $2, 'USER')
       RETURNING id, workspace_id, user_id, role, joined_at`,
      [req.params.workspaceId, userId],
    );

    return res.status(201).json({
      message: "User added to workspace successfully",
      membership: memberResult.rows[0],
    });
  } catch (error) {
    console.error("Add workspace member error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "User is already a member of this workspace",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace or user not found",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get My Workspaces
|--------------------------------------------------------------------------
*/

router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         w.id,
         w.name,
         w.type,
         w.created_by,
         w.created_at,
         COALESCE(
           role_data.preferred_role,
           UPPER(TRIM(wm.role::TEXT))
         ) AS role,
         COALESCE(role_data.roles, ARRAY[]::TEXT[]) AS roles,
         wm.joined_at
       FROM workspace_members wm
       JOIN workspaces w
         ON wm.workspace_id = w.id
       LEFT JOIN LATERAL (
         SELECT
           ARRAY_AGG(
             available.role_name
             ORDER BY available.role_priority, available.role_name
           ) AS roles,
           (
             ARRAY_AGG(
               available.role_name
               ORDER BY available.role_priority, available.role_name
             )
           )[1] AS preferred_role
         FROM (
           SELECT DISTINCT
             UPPER(TRIM(role_source.role_value)) AS role_name,
             CASE UPPER(TRIM(role_source.role_value))
               WHEN 'ADMIN' THEN 1
               WHEN 'HR' THEN 2
               WHEN 'TEAM_LEADER' THEN 3
               WHEN 'USER' THEN 4
               ELSE 99
             END AS role_priority
           FROM (
             SELECT wm.role::TEXT AS role_value

             UNION ALL

             SELECT wmr.role::TEXT AS role_value
             FROM workspace_member_roles wmr
             WHERE wmr.workspace_member_id = wm.id
           ) role_source
           WHERE role_source.role_value IS NOT NULL
             AND TRIM(role_source.role_value) <> ''
         ) available
       ) role_data ON TRUE
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [req.user.id],
    );

    return res.status(200).json({
      workspaces: result.rows,
    });
  } catch (error) {
    console.error("Get my workspaces error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get Organization Members
|--------------------------------------------------------------------------
|
| ADMIN / HR
|
*/

/*
|--------------------------------------------------------------------------
| Get Company Organization Profile
|--------------------------------------------------------------------------
*/

router.get(
  "/company/:workspaceId/organization",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res
        .status(400)
        .json({ error: "A valid Company workspace ID is required." });
    }

    try {
      const result = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           wm.role AS membership_role,
           o.id AS organization_pk,
           o.organization_id AS public_organization_id,
           o.name,
           o.type,
           o.official_email,
           o.official_domain,
           o.address,
           o.verification_status,
           o.website,
           o.industry,
           o.company_size,
           o.country,
           o.created_at
         FROM workspaces w
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         JOIN organizations o
           ON o.id = w.organization_id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND w.type = 'COMPANY'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Company workspace not found or you are not a member.",
        });
      }

      const row = result.rows[0];

      return res.status(200).json({
        organization: {
          id: row.organization_pk,
          organization_id: row.public_organization_id,
          name: row.name,
          type: row.type,
          official_email: row.official_email,
          official_domain: row.official_domain,
          address: row.address,
          verification_status: row.verification_status,
          website: row.website,
          industry: row.industry,
          company_size: row.company_size,
          country: row.country,
          created_at: row.created_at,
        },
        workspace: {
          id: row.workspace_id,
          name: row.workspace_name,
        },
        membership_role: row.membership_role,
        can_manage: row.membership_role === "ADMIN",
      });
    } catch (error) {
      console.error("Get Company organization profile error:", error.message);

      return res.status(500).json({
        error: "Unable to load Company organization details.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Update Company Organization Profile
|--------------------------------------------------------------------------
|
| Only a Company ADMIN can update profile fields.
| Official email and domain are intentionally immutable here.
|
*/

router.patch(
  "/company/:workspaceId/organization",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);
    const body = req.body || {};

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res
        .status(400)
        .json({ error: "A valid Company workspace ID is required." });
    }

    const updates = [];
    const values = [];

    const addUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

    if (has("name") || has("companyName")) {
      const name = String(body.name ?? body.companyName ?? "").trim();

      if (name.length < 2 || name.length > 255) {
        return res.status(400).json({
          error: "Company name must be between 2 and 255 characters.",
        });
      }

      addUpdate("name", name);
    }

    if (has("website")) {
      const rawWebsite = String(body.website ?? "").trim();
      let website = null;

      if (rawWebsite) {
        try {
          const parsedWebsite = new URL(rawWebsite);

          if (!["http:", "https:"].includes(parsedWebsite.protocol)) {
            throw new Error("Unsupported protocol");
          }

          website = parsedWebsite.toString();
        } catch {
          return res.status(400).json({
            error: "Please enter a valid Company website URL.",
          });
        }
      }

      addUpdate("website", website);
    }

    if (has("industry")) {
      const industry = String(body.industry ?? "").trim();

      if (industry.length > 120) {
        return res.status(400).json({
          error: "Industry must be 120 characters or fewer.",
        });
      }

      addUpdate("industry", industry || null);
    }

    if (has("companySize") || has("company_size")) {
      const companySize = String(
        body.companySize ?? body.company_size ?? "",
      ).trim();

      if (companySize.length > 80) {
        return res.status(400).json({
          error: "Company size must be 80 characters or fewer.",
        });
      }

      addUpdate("company_size", companySize || null);
    }

    if (has("country")) {
      const country = String(body.country ?? "").trim();

      if (country.length > 120) {
        return res.status(400).json({
          error: "Country must be 120 characters or fewer.",
        });
      }

      addUpdate("country", country || null);
    }

    if (has("address")) {
      const address = String(body.address ?? "").trim();

      if (address.length > 4000) {
        return res.status(400).json({
          error: "Address must be 4000 characters or fewer.",
        });
      }

      addUpdate("address", address || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "Provide at least one editable profile field.",
      });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const accessResult = await client.query(
        `SELECT
           w.id AS workspace_id,
           w.organization_id,
           wm.role AS membership_role
         FROM workspaces w
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         JOIN organizations o
           ON o.id = w.organization_id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND w.type = 'COMPANY'
         FOR UPDATE OF w, o`,
        [workspaceId, req.user.id],
      );

      if (accessResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          error: "Company workspace not found or you are not a member.",
        });
      }

      const access = accessResult.rows[0];

      if (access.membership_role !== "ADMIN") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error: "Only a Company ADMIN can update organization details.",
        });
      }

      values.push(access.organization_id);
      const organizationIdParameter = `$${values.length}`;

      const updatedResult = await client.query(
        `UPDATE organizations
         SET ${updates.join(", ")}
         WHERE id = ${organizationIdParameter}
         RETURNING
           id, organization_id, name, type, official_email, official_domain,
           address, verification_status, website, industry, company_size,
           country, created_at`,
        values,
      );

      const organization = updatedResult.rows[0];

      if (updates.some((update) => update.startsWith("name = "))) {
        await client.query(
          `UPDATE workspaces
           SET name = $1
           WHERE organization_id = $2
             AND type = 'COMPANY'`,
          [organization.name, access.organization_id],
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        message: "Company organization profile updated successfully.",
        organization,
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Organization profile rollback error:",
            rollbackError.message,
          );
        }
      }

      console.error(
        "Update Company organization profile error:",
        error.message,
      );

      return res.status(500).json({
        error: "Unable to update Company organization details.",
      });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/company/:workspaceId/organization-members",
  authMiddleware,
  async (req, res) => {
    const { workspaceId } = req.params;

    try {
      const requesterResult = await pool.query(
        `SELECT
           workspace_members.id,
           workspace_members.role,
           workspaces.id AS workspace_id,
           workspaces.name AS workspace_name,
           workspaces.type AS workspace_type,
           workspaces.organization_id,
           organizations.organization_id AS public_organization_id,
           organizations.name AS organization_name,
           organizations.type AS organization_type,
           organizations.verification_status
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         JOIN organizations
           ON workspaces.organization_id = organizations.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role IN ('ADMIN', 'HR')
           AND workspaces.type = 'COMPANY'
           AND organizations.verification_status = 'VERIFIED'`,
        [workspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        return res.status(403).json({
          error:
            "Only Company ADMIN and HR members can view organization members",
        });
      }

      const workspace = requesterResult.rows[0];

      const membersResult = await pool.query(
        `SELECT
           organization_members.id AS organization_membership_id,
           organization_members.organization_id,
           organization_members.user_id,
           users.name,
           users.email,
           users.account_status,
           organization_members.joined_at AS organization_joined_at,
           workspace_members.id AS workspace_membership_id,
           workspace_members.role AS workspace_role,
           workspace_members.joined_at AS workspace_joined_at
         FROM organization_members
         JOIN users
           ON organization_members.user_id = users.id
         LEFT JOIN workspace_members
           ON workspace_members.user_id = organization_members.user_id
          AND workspace_members.workspace_id = $2
         WHERE organization_members.organization_id = $1
         ORDER BY organization_members.joined_at ASC`,
        [workspace.organization_id, workspaceId],
      );

      return res.status(200).json({
        organization: {
          id: workspace.organization_id,
          organization_id: workspace.public_organization_id,
          name: workspace.organization_name,
          type: workspace.organization_type,
          verification_status: workspace.verification_status,
        },
        workspace: {
          id: workspace.workspace_id,
          name: workspace.workspace_name,
          type: workspace.workspace_type,
        },
        members: membersResult.rows,
      });
    } catch (error) {
      console.error("Get organization members error:", error.message);

      return res.status(500).json({
        error: "Database error",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get Workspace Members
|--------------------------------------------------------------------------
|
| Any member of a PROJECT, COMPANY, or INDIVIDUAL workspace can
| view its members.
|
*/

router.get("/:workspaceId/members", authMiddleware, async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);

  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return res.status(400).json({
      error: "A valid workspace ID is required",
    });
  }

  try {
    const membershipResult = await pool.query(
      `SELECT workspace_members.role
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.workspace_id = $1
         AND workspace_members.user_id = $2
         AND workspaces.type IN ('PROJECT', 'COMPANY', 'INDIVIDUAL')
       LIMIT 1`,
      [workspaceId, req.user.id],
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        error: "You are not a member of this workspace",
      });
    }

    const membersResult = await pool.query(
      `SELECT
         workspace_members.id,
         workspace_members.workspace_id,
         workspace_members.user_id,
         users.name,
         users.email,
         users.account_status,
         workspace_members.role,
         workspace_members.joined_at
       FROM workspace_members
       JOIN users
         ON workspace_members.user_id = users.id
       WHERE workspace_members.workspace_id = $1
       ORDER BY workspace_members.joined_at ASC`,
      [workspaceId],
    );

    return res.status(200).json({
      workspaceId,
      members: membersResult.rows,
    });
  } catch (error) {
    console.error("Get workspace members error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Remove a USER from a Project Workspace
|--------------------------------------------------------------------------
*/

router.delete(
  "/:workspaceId/members/:userId",
  authMiddleware,
  async (req, res) => {
    const { workspaceId, userId } = req.params;

    try {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type = 'PROJECT'`,
        [workspaceId, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Project Team Leader can remove users",
        });
      }

      const memberResult = await pool.query(
        `SELECT id, user_id, role
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2`,
        [workspaceId, userId],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Workspace member not found",
        });
      }

      if (memberResult.rows[0].role !== "USER") {
        return res.status(400).json({
          error: "Only workspace users can be removed",
        });
      }

      await pool.query(
        `DELETE FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2`,
        [workspaceId, userId],
      );

      return res.status(200).json({
        message: "User removed from workspace successfully",
        workspaceId,
        userId: Number(userId),
      });
    } catch (error) {
      console.error("Remove workspace member error:", error.message);

      return res.status(500).json({
        error: "Database error",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Remove a Member from a Company Workspace
|--------------------------------------------------------------------------
|
| ADMIN:
|   Can remove HR, TEAM_LEADER, and USER.
|
| HR:
|   Can remove TEAM_LEADER and USER, but not another HR.
|
| ADMIN cannot be removed.
|
*/

router.delete(
  "/company/:workspaceId/members/:userId",
  authMiddleware,
  async (req, res) => {
    const { workspaceId, userId } = req.params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const requesterResult = await client.query(
        `SELECT
           workspace_members.role,
           workspaces.organization_id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         JOIN organizations
           ON workspaces.organization_id = organizations.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type = 'COMPANY'
           AND organizations.verification_status = 'VERIFIED'`,
        [workspaceId, req.user.id],
      );

      if (requesterResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "You are not authorized to remove company members",
        });
      }

      const requesterRole = requesterResult.rows[0].role;
      const organizationId = requesterResult.rows[0].organization_id;

      if (!["ADMIN", "HR"].includes(requesterRole)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only Company ADMIN or HR can remove members",
        });
      }

      if (Number(userId) === Number(req.user.id)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "You cannot remove yourself from the company workspace",
        });
      }

      const memberResult = await client.query(
        `SELECT
           workspace_members.id,
           workspace_members.user_id,
           workspace_members.role,
           users.name,
           users.email
         FROM workspace_members
         JOIN users
           ON workspace_members.user_id = users.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2`,
        [workspaceId, userId],
      );

      if (memberResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Workspace member not found",
        });
      }

      const targetMember = memberResult.rows[0];

      if (targetMember.role === "ADMIN") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Company ADMIN cannot be removed",
        });
      }

      if (requesterRole === "HR" && targetMember.role === "HR") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "HR cannot remove another HR member",
        });
      }

      await client.query(
        `DELETE FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2`,
        [workspaceId, userId],
      );

      const remainingWorkspaceResult = await client.query(
        `SELECT COUNT(*) AS count
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.user_id = $1
           AND workspaces.organization_id = $2
           AND workspaces.type = 'COMPANY'`,
        [userId, organizationId],
      );

      const remainingCompanyWorkspaces = Number(
        remainingWorkspaceResult.rows[0].count,
      );

      if (remainingCompanyWorkspaces === 0) {
        await client.query(
          `DELETE FROM organization_members
           WHERE organization_id = $1
             AND user_id = $2`,
          [organizationId, userId],
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Company member removed successfully",
        workspaceId: Number(workspaceId),
        userId: Number(userId),
        organization_membership_removed: remainingCompanyWorkspaces === 0,
        user: {
          id: targetMember.user_id,
          name: targetMember.name,
          email: targetMember.email,
          role: targetMember.role,
        },
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Remove company member rollback error:",
          rollbackError.message,
        );
      }

      console.error("Remove company member error:", error.message);

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace or member not found",
        });
      }

      return res.status(500).json({
        error: "Database error",
      });
    } finally {
      client.release();
    }
  },
);

/*
|--------------------------------------------------------------------------
| Get Company Reporting Structure
|--------------------------------------------------------------------------
|
| ADMIN:
|   Sees all HRs, their assigned Team Leaders, and Users assigned to each
|   Team Leader. Also sees Team Leaders without an HR and Users without a
|   Team Leader.
|
| HR:
|   Sees only the Team Leaders assigned to that HR and their Users.
|
| TEAM_LEADER:
|   Sees only Users assigned to that Team Leader.
|
*/

router.get(
  "/company/:workspaceId/reporting-structure",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    try {
      const accessResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.organization_id,
           o.name AS organization_name,
           o.organization_id AS public_organization_id,
           wm.role AS requester_role
         FROM workspaces w
         JOIN organizations o
           ON o.id = w.organization_id
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this verified Company workspace",
        });
      }

      const workspace = accessResult.rows[0];
      const viewerRole = String(workspace.requester_role || "").toUpperCase();

      if (!["ADMIN", "HR", "TEAM_LEADER"].includes(viewerRole)) {
        return res.status(403).json({
          error:
            "Only Company ADMIN, HR, and TEAM_LEADER can view the reporting structure",
        });
      }

      const membersResult = await pool.query(
        `SELECT
           wm.user_id,
           wm.role,
           u.name,
           u.email,
           u.account_status
         FROM workspace_members wm
         JOIN users u
           ON u.id = wm.user_id
         WHERE wm.workspace_id = $1
         ORDER BY
           CASE UPPER(TRIM(wm.role::TEXT))
             WHEN 'ADMIN' THEN 1
             WHEN 'HR' THEN 2
             WHEN 'TEAM_LEADER' THEN 3
             WHEN 'USER' THEN 4
             ELSE 5
           END,
           LOWER(COALESCE(u.name, '')),
           wm.user_id`,
        [workspaceId],
      );

      const members = membersResult.rows.map((member) => ({
        ...member,
        user_id: Number(member.user_id),
        role: String(member.role || "").toUpperCase(),
      }));

      const memberById = new Map(
        members.map((member) => [member.user_id, member]),
      );

      const hrMembers = members.filter((member) => member.role === "HR");
      const teamLeaderMembers = members.filter(
        (member) => member.role === "TEAM_LEADER",
      );
      const userMembers = members.filter((member) => member.role === "USER");

      const hrAssignmentsResult = await pool.query(
        `SELECT
           a.hr_user_id,
           a.team_leader_user_id
         FROM organization_hr_team_leader_assignments a
         JOIN workspace_members hr_member
           ON hr_member.workspace_id = $2
          AND hr_member.user_id = a.hr_user_id
          AND UPPER(TRIM(hr_member.role::TEXT)) = 'HR'
         JOIN workspace_members leader_member
           ON leader_member.workspace_id = $2
          AND leader_member.user_id = a.team_leader_user_id
          AND UPPER(TRIM(leader_member.role::TEXT)) = 'TEAM_LEADER'
         WHERE a.organization_id = $1
         ORDER BY a.hr_user_id, a.team_leader_user_id`,
        [workspace.organization_id, workspaceId],
      );

      const teamLeaderAssignmentsResult = await pool.query(
        `SELECT
           a.team_leader_user_id,
           a.user_id
         FROM organization_team_leader_user_assignments a
         JOIN workspace_members leader_member
           ON leader_member.workspace_id = $2
          AND leader_member.user_id = a.team_leader_user_id
          AND UPPER(TRIM(leader_member.role::TEXT)) = 'TEAM_LEADER'
         JOIN workspace_members user_member
           ON user_member.workspace_id = $2
          AND user_member.user_id = a.user_id
          AND UPPER(TRIM(user_member.role::TEXT)) = 'USER'
         WHERE a.organization_id = $1
         ORDER BY a.team_leader_user_id, a.user_id`,
        [workspace.organization_id, workspaceId],
      );

      const hrByLeader = new Map();
      const leadersByHr = new Map();

      for (const assignment of hrAssignmentsResult.rows) {
        const hrUserId = Number(assignment.hr_user_id);
        const leaderUserId = Number(assignment.team_leader_user_id);

        if (!memberById.has(hrUserId) || !memberById.has(leaderUserId)) {
          continue;
        }

        hrByLeader.set(leaderUserId, hrUserId);

        if (!leadersByHr.has(hrUserId)) {
          leadersByHr.set(hrUserId, new Set());
        }

        leadersByHr.get(hrUserId).add(leaderUserId);
      }

      const usersByLeader = new Map();
      const assignedUserIds = new Set();

      for (const assignment of teamLeaderAssignmentsResult.rows) {
        const leaderUserId = Number(assignment.team_leader_user_id);
        const userId = Number(assignment.user_id);

        if (!memberById.has(leaderUserId) || !memberById.has(userId)) {
          continue;
        }

        if (!usersByLeader.has(leaderUserId)) {
          usersByLeader.set(leaderUserId, new Set());
        }

        usersByLeader.get(leaderUserId).add(userId);
        assignedUserIds.add(userId);
      }

      const toUserNode = (member) => ({
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        account_status: member.account_status,
      });

      const createTeamLeaderNode = (leaderMember) => {
        const userIds = usersByLeader.get(leaderMember.user_id) || new Set();
        const assignedUsers = [...userIds]
          .map((userId) => memberById.get(userId))
          .filter(Boolean)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          )
          .map(toUserNode);

        return {
          ...toUserNode(leaderMember),
          users: assignedUsers,
          user_count: assignedUsers.length,
        };
      };

      const createHrNode = (hrMember) => {
        const leaderIds = leadersByHr.get(hrMember.user_id) || new Set();
        const assignedLeaders = [...leaderIds]
          .map((leaderId) => memberById.get(leaderId))
          .filter(Boolean)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          )
          .map(createTeamLeaderNode);

        return {
          ...toUserNode(hrMember),
          team_leaders: assignedLeaders,
          team_leader_count: assignedLeaders.length,
          user_count: assignedLeaders.reduce(
            (total, leader) => total + leader.user_count,
            0,
          ),
        };
      };

      let hierarchy = [];
      let myTeamLeader = null;
      let unassignedTeamLeaders = [];
      let unassignedUsers = [];

      if (viewerRole === "ADMIN") {
        hierarchy = hrMembers
          .slice()
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          )
          .map(createHrNode);

        unassignedTeamLeaders = teamLeaderMembers
          .filter((leader) => !hrByLeader.has(leader.user_id))
          .slice()
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          )
          .map(createTeamLeaderNode);

        unassignedUsers = userMembers
          .filter((user) => !assignedUserIds.has(user.user_id))
          .slice()
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          )
          .map(toUserNode);
      } else if (viewerRole === "HR") {
        const ownHr = hrMembers.find(
          (member) => member.user_id === Number(req.user.id),
        );

        hierarchy = ownHr ? [createHrNode(ownHr)] : [];
      } else if (viewerRole === "TEAM_LEADER") {
        const ownTeamLeader = teamLeaderMembers.find(
          (member) => member.user_id === Number(req.user.id),
        );

        myTeamLeader = ownTeamLeader
          ? createTeamLeaderNode(ownTeamLeader)
          : null;
      }

      const visibleCounts =
        viewerRole === "ADMIN"
          ? {
              hr: hrMembers.length,
              team_leaders: teamLeaderMembers.length,
              users: userMembers.length,
              unassigned_team_leaders: unassignedTeamLeaders.length,
              unassigned_users: unassignedUsers.length,
            }
          : viewerRole === "HR"
            ? {
                hr: hierarchy.length,
                team_leaders: hierarchy.reduce(
                  (total, hr) => total + hr.team_leader_count,
                  0,
                ),
                users: hierarchy.reduce(
                  (total, hr) => total + hr.user_count,
                  0,
                ),
                unassigned_team_leaders: 0,
                unassigned_users: 0,
              }
            : {
                hr: 0,
                team_leaders: myTeamLeader ? 1 : 0,
                users: myTeamLeader ? myTeamLeader.user_count : 0,
                unassigned_team_leaders: 0,
                unassigned_users: 0,
              };

      return res.status(200).json({
        message: "Company reporting structure retrieved successfully",
        company: {
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          organization_id: workspace.organization_id,
          organization_public_id: workspace.public_organization_id,
          organization_name: workspace.organization_name,
        },
        viewer_role: viewerRole,
        hierarchy,
        my_team_leader: myTeamLeader,
        unassigned_team_leaders: unassignedTeamLeaders,
        unassigned_users: unassignedUsers,
        counts: visibleCounts,
      });
    } catch (error) {
      console.error("Get Company reporting structure error:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve the Company reporting structure",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------| Assign or Reassign a User to a Company Team Leader
|--------------------------------------------------------------------------
|
| ADMIN:
|   Can assign/reassign any USER to any Team Leader in the workspace.
|
| HR:
|   Can assign/reassign Users only to Team Leaders assigned to that HR.
|   Reassignment must remain within that HR's Team Leader group.
|
| TEAM_LEADER:
|   Can assign an unassigned USER to themselves. They cannot take a User
|   already assigned to another Team Leader.
|
*/

router.post(
  "/company/:workspaceId/team-leader-user-assignments",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);
    const { teamLeaderUserId, userId } = req.body || {};
    const normalizedUserId = Number(userId);
    const requestedTeamLeaderId =
      teamLeaderUserId === undefined ||
      teamLeaderUserId === null ||
      teamLeaderUserId === ""
        ? null
        : Number(teamLeaderUserId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return res.status(400).json({
        error: "A valid User ID is required",
      });
    }

    if (
      requestedTeamLeaderId !== null &&
      (!Number.isInteger(requestedTeamLeaderId) || requestedTeamLeaderId <= 0)
    ) {
      return res.status(400).json({
        error: "A valid Team Leader user ID is required",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const accessResult = await client.query(
        `SELECT
           w.id AS workspace_id,
           w.name AS workspace_name,
           w.organization_id,
           o.name AS organization_name,
           wm.role AS requester_role
         FROM workspaces w
         JOIN organizations o
           ON o.id = w.organization_id
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (accessResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "You are not a member of this verified Company workspace",
        });
      }

      const workspace = accessResult.rows[0];
      const requesterRole = String(
        workspace.requester_role || "",
      ).toUpperCase();

      if (!["ADMIN", "HR", "TEAM_LEADER"].includes(requesterRole)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "Only Company ADMIN, HR, and TEAM_LEADER can assign Users to Team Leaders",
        });
      }

      let normalizedTeamLeaderId;

      if (requesterRole === "TEAM_LEADER") {
        if (
          requestedTeamLeaderId !== null &&
          requestedTeamLeaderId !== Number(req.user.id)
        ) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "A Team Leader can only assign Users to themselves",
          });
        }

        normalizedTeamLeaderId = Number(req.user.id);
      } else {
        if (requestedTeamLeaderId === null) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "Team Leader user ID is required for ADMIN or HR assignments",
          });
        }

        normalizedTeamLeaderId = requestedTeamLeaderId;
      }

      if (normalizedTeamLeaderId === normalizedUserId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "A Team Leader cannot be assigned as their own User",
        });
      }

      const selectedMembersResult = await client.query(
        `SELECT
           wm.user_id,
           UPPER(TRIM(wm.role::TEXT)) AS role,
           u.name,
           u.email,
           u.account_status
         FROM workspace_members wm
         JOIN users u
           ON u.id = wm.user_id
         WHERE wm.workspace_id = $1
           AND wm.user_id = ANY($2::integer[])`,
        [workspaceId, [normalizedTeamLeaderId, normalizedUserId]],
      );

      const selectedMembers = selectedMembersResult.rows;
      const teamLeaderMember = selectedMembers.find(
        (member) => Number(member.user_id) === normalizedTeamLeaderId,
      );
      const userMember = selectedMembers.find(
        (member) => Number(member.user_id) === normalizedUserId,
      );

      if (!teamLeaderMember || teamLeaderMember.role !== "TEAM_LEADER") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "The selected Team Leader must have the TEAM_LEADER role in this Company workspace",
        });
      }

      if (teamLeaderMember.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "The selected Team Leader account is not active",
        });
      }

      if (!userMember || userMember.role !== "USER") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "The selected employee must have the USER role in this Company workspace",
        });
      }

      if (userMember.account_status !== "ACTIVE") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "The selected User account is not active",
        });
      }

      if (requesterRole === "HR") {
        const targetLeaderHrResult = await client.query(
          `SELECT hr_user_id
           FROM organization_hr_team_leader_assignments
           WHERE organization_id = $1
             AND team_leader_user_id = $2
           LIMIT 1`,
          [workspace.organization_id, normalizedTeamLeaderId],
        );

        if (
          targetLeaderHrResult.rows.length === 0 ||
          Number(targetLeaderHrResult.rows[0].hr_user_id) !==
            Number(req.user.id)
        ) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error:
              "HR can assign Users only to Team Leaders assigned to that HR",
          });
        }
      }

      const existingAssignmentResult = await client.query(
        `SELECT team_leader_user_id
         FROM organization_team_leader_user_assignments
         WHERE organization_id = $1
           AND user_id = $2
         FOR UPDATE`,
        [workspace.organization_id, normalizedUserId],
      );

      const existingAssignment = existingAssignmentResult.rows[0] || null;
      const previousTeamLeaderId = existingAssignment
        ? Number(existingAssignment.team_leader_user_id)
        : null;

      if (
        requesterRole === "TEAM_LEADER" &&
        previousTeamLeaderId !== null &&
        previousTeamLeaderId !== normalizedTeamLeaderId
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "You cannot take a User who is already assigned to another Team Leader",
        });
      }

      if (
        requesterRole === "HR" &&
        previousTeamLeaderId !== null &&
        previousTeamLeaderId !== normalizedTeamLeaderId
      ) {
        const previousLeaderHrResult = await client.query(
          `SELECT hr_user_id
           FROM organization_hr_team_leader_assignments
           WHERE organization_id = $1
             AND team_leader_user_id = $2
           LIMIT 1`,
          [workspace.organization_id, previousTeamLeaderId],
        );

        if (
          previousLeaderHrResult.rows.length === 0 ||
          Number(previousLeaderHrResult.rows[0].hr_user_id) !==
            Number(req.user.id)
        ) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error:
              "HR can reassign a User only within their own Team Leader group",
          });
        }
      }

      const assignmentResult = await client.query(
        `INSERT INTO organization_team_leader_user_assignments
         (
           organization_id,
           team_leader_user_id,
           user_id,
           assigned_by
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, user_id)
         DO UPDATE SET
           team_leader_user_id = EXCLUDED.team_leader_user_id,
           assigned_by = EXCLUDED.assigned_by,
           updated_at = CURRENT_TIMESTAMP
         RETURNING
           id,
           organization_id,
           team_leader_user_id,
           user_id,
           assigned_by,
           created_at,
           updated_at`,
        [
          workspace.organization_id,
          normalizedTeamLeaderId,
          normalizedUserId,
          req.user.id,
        ],
      );

      const savedAssignment = assignmentResult.rows[0];

      await client.query("COMMIT");

      return res.status(200).json({
        message:
          previousTeamLeaderId === normalizedTeamLeaderId
            ? "User assignment saved successfully"
            : "User successfully assigned to the Team Leader",
        company: {
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          organization_id: workspace.organization_id,
          organization_name: workspace.organization_name,
        },
        assignment: {
          id: savedAssignment.id,
          organization_id: savedAssignment.organization_id,
          team_leader_user_id: savedAssignment.team_leader_user_id,
          team_leader_name: teamLeaderMember.name,
          team_leader_email: teamLeaderMember.email,
          user_id: savedAssignment.user_id,
          user_name: userMember.name,
          user_email: userMember.email,
          assigned_by: savedAssignment.assigned_by,
          assigned_by_name: req.user.name || null,
          created_at: savedAssignment.created_at,
          updated_at: savedAssignment.updated_at,
        },
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Team Leader/User assignment rollback error:",
          rollbackError.message,
        );
      }

      console.error("Assign User to Team Leader error:", error.message);

      if (error.code === "23503") {
        return res.status(400).json({
          error:
            "The selected organization, Team Leader, User, or assigning account does not exist",
        });
      }

      if (error.code === "23514") {
        return res.status(400).json({
          error:
            "The Team Leader/User assignment violates a database constraint",
        });
      }

      return res.status(500).json({
        error: "Unable to save the Team Leader/User assignment",
      });
    } finally {
      client.release();
    }
  },
);
/* ============================================================
   GET AVAILABLE TEAM LEADERS FOR AN HR
   ============================================================ */

router.get(
  "/company/:workspaceId/available-team-leaders",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    try {
      const hrResult = await pool.query(
        `SELECT
           w.id AS workspace_id,
           w.organization_id,
           wm.role AS requester_role,
           u.account_status
         FROM workspaces w
         JOIN organizations o
           ON o.id = w.organization_id
         JOIN workspace_members wm
           ON wm.workspace_id = w.id
         JOIN users u
           ON u.id = wm.user_id
         WHERE w.id = $1
           AND wm.user_id = $2
           AND wm.role = 'HR'
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'
         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (hrResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only Company HR members can access available Team Leaders",
        });
      }

      const hr = hrResult.rows[0];

      if (hr.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: "Your HR account is not active",
        });
      }

      const leadersResult = await pool.query(
        `SELECT
           wm.user_id,
           u.name,
           u.email,
           u.account_status,
           wm.role AS workspace_role

         FROM workspace_members wm

         JOIN users u
           ON u.id = wm.user_id

         WHERE wm.workspace_id = $1
           AND wm.role = 'TEAM_LEADER'
           AND u.account_status = 'ACTIVE'

           AND NOT EXISTS (
             SELECT 1
             FROM organization_hr_team_leader_assignments a
             WHERE a.organization_id = $2
               AND a.team_leader_user_id = wm.user_id
           )

         ORDER BY LOWER(u.name), wm.user_id`,
        [hr.workspace_id, hr.organization_id],
      );

      return res.status(200).json({
        message: "Available Team Leaders retrieved successfully",
        team_leaders: leadersResult.rows,
      });
    } catch (error) {
      console.error("Available Team Leaders loading error:", error.message);

      return res.status(500).json({
        error: "Unable to load available Team Leaders",
      });
    }
  },
);

/* ============================================================
   HR ADDS A TEAM LEADER TO THEIR REPORTING GROUP
   ============================================================ */

router.post(
  "/company/:workspaceId/my-team-leaders",
  authMiddleware,
  async (req, res) => {
    const workspaceId = Number(req.params.workspaceId);

    const teamLeaderUserId = Number(req.body?.teamLeaderUserId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        error: "A valid Company workspace ID is required",
      });
    }

    if (!Number.isInteger(teamLeaderUserId) || teamLeaderUserId <= 0) {
      return res.status(400).json({
        error: "A valid Team Leader user ID is required",
      });
    }

    if (teamLeaderUserId === Number(req.user.id)) {
      return res.status(400).json({
        error: "You cannot assign yourself as a Team Leader",
      });
    }

    const client = await pool.connect();

    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      /* -----------------------------------------------
         VERIFY REQUESTING HR
      ----------------------------------------------- */

      const hrResult = await client.query(
        `SELECT
           w.id AS workspace_id,
           w.organization_id,
           wm.user_id AS hr_user_id

         FROM workspaces w

         JOIN organizations o
           ON o.id = w.organization_id

         JOIN workspace_members wm
           ON wm.workspace_id = w.id

         JOIN users u
           ON u.id = wm.user_id

         WHERE w.id = $1
           AND wm.user_id = $2
           AND wm.role = 'HR'
           AND u.account_status = 'ACTIVE'
           AND w.type = 'COMPANY'
           AND o.verification_status = 'VERIFIED'

         LIMIT 1`,
        [workspaceId, req.user.id],
      );

      if (hrResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error: "Only active Company HR members can add Team Leaders",
        });
      }

      const hr = hrResult.rows[0];

      /* -----------------------------------------------
         VERIFY SELECTED TEAM LEADER
      ----------------------------------------------- */

      const leaderResult = await client.query(
        `SELECT
           wm.user_id,
           wm.role,
           u.name,
           u.email,
           u.account_status

         FROM workspace_members wm

         JOIN users u
           ON u.id = wm.user_id

         WHERE wm.workspace_id = $1
           AND wm.user_id = $2
           AND wm.role = 'TEAM_LEADER'
           AND u.account_status = 'ACTIVE'

         FOR UPDATE OF wm, u`,
        [hr.workspace_id, teamLeaderUserId],
      );

      if (leaderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          error:
            "The selected active Team Leader does not belong to this Company workspace",
        });
      }

      /* -----------------------------------------------
         CHECK EXISTING HR ASSIGNMENT

         A Team Leader can belong to only one HR
         reporting group in the same organization.

         Admin can still reassign them through the
         existing Admin-only assignment endpoint.
      ----------------------------------------------- */

      const existingAssignment = await client.query(
        `SELECT
           id,
           hr_user_id

         FROM organization_hr_team_leader_assignments

         WHERE organization_id = $1
           AND team_leader_user_id = $2

         LIMIT 1`,
        [hr.organization_id, teamLeaderUserId],
      );

      if (existingAssignment.rows.length > 0) {
        const existingHrId = existingAssignment.rows[0].hr_user_id;

        await client.query("ROLLBACK");
        transactionStarted = false;

        if (Number(existingHrId) === Number(req.user.id)) {
          return res.status(409).json({
            error: "This Team Leader is already assigned to you",
          });
        }

        return res.status(409).json({
          error:
            "This Team Leader is already assigned to another HR. Contact your Company Admin if reassignment is required.",
        });
      }

      /* -----------------------------------------------
         SAVE HR ↔ TEAM LEADER RELATIONSHIP
      ----------------------------------------------- */

      const assignmentResult = await client.query(
        `INSERT INTO organization_hr_team_leader_assignments
         (
           organization_id,
           hr_user_id,
           team_leader_user_id,
           assigned_by
         )

         VALUES ($1, $2, $3, $4)

         ON CONFLICT (
           organization_id,
           team_leader_user_id
         )
         DO NOTHING

         RETURNING id, organization_id, hr_user_id, team_leader_user_id, assigned_by, created_at`,
        [hr.organization_id, req.user.id, teamLeaderUserId, req.user.id],
      );

      if (assignmentResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          error: "This Team Leader has already been assigned to an HR",
        });
      }

      const savedAssignment = await client.query(
        `SELECT
           a.id AS assignment_id,
           a.organization_id,

           a.hr_user_id,
           hr.name AS hr_name,
           hr.email AS hr_email,

           a.team_leader_user_id,
           tl.name AS team_leader_name,
           tl.email AS team_leader_email,

           a.assigned_by,
           a.created_at,
           a.updated_at

         FROM organization_hr_team_leader_assignments a

         JOIN users hr
           ON hr.id = a.hr_user_id

         JOIN users tl
           ON tl.id = a.team_leader_user_id

         WHERE a.id = $1`,
        [assignmentResult.rows[0].id],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message: "Team Leader added to your workspace successfully",
        assignment: savedAssignment.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Team Leader assignment rollback error:",
            rollbackError.message,
          );
        }
      }

      console.error("HR add Team Leader error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "This Team Leader is already assigned to an HR",
        });
      }

      if (error.code === "23503") {
        return res.status(400).json({
          error: "Invalid Company, HR, or Team Leader relationship",
        });
      }

      return res.status(500).json({
        error: "Unable to add Team Leader to your workspace",
      });
    } finally {
      client.release();
    }
  },
);
/* ============================================================
   GET MY PORTAL ACCESS

   Used by Individual and Company login to determine
   which portals the authenticated account can access.
============================================================ */

router.get("/my-portal-access", authMiddleware, async (req, res) => {
  try {
    // 1. Get the authenticated user's account information.

    const userResult = await pool.query(
      `SELECT
           id,
           email,
           account_status,
           must_change_password
         FROM users
         WHERE id = $1
         LIMIT 1`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "Your ZYRA account could not be found",
      });
    }

    const user = userResult.rows[0];

    if (String(user.account_status || "").toUpperCase() !== "ACTIVE") {
      return res.status(403).json({
        error: "Your ZYRA account is not active",
      });
    }

    // 2. Get actual active workspace memberships.

    const membershipsResult = await pool.query(
      `SELECT DISTINCT
           UPPER(TRIM(w.type::TEXT)) AS portal

         FROM workspace_members wm

         JOIN workspaces w
           ON w.id = wm.workspace_id

         WHERE wm.user_id = $1
           AND UPPER(TRIM(w.type::TEXT))
               IN ('INDIVIDUAL', 'COMPANY')`,
      [req.user.id],
    );

    const memberships = membershipsResult.rows.map((row) => row.portal);

    // 3. Get valid pending invitations.

    const invitationsResult = await pool.query(
      `SELECT DISTINCT
           UPPER(TRIM(w.type::TEXT)) AS portal

         FROM employee_invitations ei

         JOIN workspaces w
           ON w.id = ei.workspace_id

         LEFT JOIN organizations o
           ON o.id = w.organization_id

         WHERE LOWER(TRIM(ei.invited_email)) =
               LOWER(TRIM($1))

           AND ei.status = 'PENDING'

           AND ei.expires_at > CURRENT_TIMESTAMP

           AND UPPER(TRIM(w.type::TEXT))
               IN ('INDIVIDUAL', 'COMPANY')

           AND (
             UPPER(TRIM(w.type::TEXT)) = 'INDIVIDUAL'

             OR (
               UPPER(TRIM(w.type::TEXT)) = 'COMPANY'
               AND o.verification_status = 'VERIFIED'
             )
           )

           AND NOT EXISTS (
             SELECT 1
             FROM workspace_members existing_member
             WHERE existing_member.workspace_id = ei.workspace_id
               AND existing_member.user_id = $2
           )`,
      [user.email, user.id],
    );

    const pendingInvitations = invitationsResult.rows.map((row) => row.portal);

    // 4. Combine available portals without duplicates.

    const availablePortals = [
      ...new Set([...memberships, ...pendingInvitations]),
    ];

    // 5. Return the response expected by Login.jsx.

    return res.status(200).json({
      available_portals: availablePortals,
      memberships: memberships,
      pending_invitations: pendingInvitations,
      must_change_password: user.must_change_password === true,
    });
  } catch (error) {
    console.error("Get portal access error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve your portal access",
    });
  }
});
module.exports = router;
