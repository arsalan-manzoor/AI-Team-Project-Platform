const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { sendEmployeeInvitationEmail } = require("../utils/emailService");

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

    res.status(201).json({
      message: "Project workspace created successfully",
      workspace,
      membership: memberResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Workspace creation error:", error.message);

    res.status(500).json({
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

    res.status(201).json({
      message: "Company establishment request created successfully",
      establishment: result.rows[0],
    });
  } catch (error) {
    console.error("Company establishment request error:", error.message);

    res.status(500).json({
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
| Verification flow:
|
| PENDING Establishment
|       ↓
| Organization
|       ↓
| COMPANY Workspace
|       ↓
| ADMIN Membership
|       ↓
| Organization Membership
|       ↓
| Establishment VERIFIED
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

      res.status(200).json({
        message:
          "Company verified, organization created, and workspace created successfully",
        establishment: verifiedEstablishment,
        organization,
        workspace,
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

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

      res.status(500).json({
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

    const client = await pool.connect();

    try {
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
        `SELECT
           id,
           name,
           email
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

      res.status(201).json({
        message: "HR added to company workspace successfully",
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0] || null,
        user: userResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

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

      res.status(500).json({
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

      res.status(500).json({
        error: "Database error",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| Invite Employee to a Company Workspace
|--------------------------------------------------------------------------
|
| ACCOUNT + INVITATION FLOW
|
| The employee account must already exist.
|
| ADMIN:
|   Can invite HR, TEAM_LEADER, USER
|
| HR:
|   Can invite TEAM_LEADER, USER
|
| TEAM_LEADER:
|   Can invite USER only
|
| USER:
|   Cannot create employee invitations
|
| Invitation creation also creates a notification for the employee.
|
*/

router.post(
  "/company/:workspaceId/invitations",
  authMiddleware,
  async (req, res) => {
    const { workspaceId } = req.params;
    const { email, role } = req.body;

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
        // ADMIN can invite HR, TEAM_LEADER and USER.
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

      /*
      |--------------------------------------------------------------------------
      | Verify that the employee account already exists
      |--------------------------------------------------------------------------
      */

      const existingUserResult = await pool.query(
        `SELECT
           id,
           name,
           email,
           account_status
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
      |--------------------------------------------------------------------------
      | Check existing workspace membership
      |--------------------------------------------------------------------------
      */

      const existingMembershipResult = await pool.query(
        `SELECT
           id,
           role
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

      /*
      |--------------------------------------------------------------------------
      | Check pending invitation
      |--------------------------------------------------------------------------
      */

      const pendingInvitationResult = await pool.query(
        `SELECT
           id,
           expires_at
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

      /*
      |--------------------------------------------------------------------------
      | Generate secure invitation token
      |--------------------------------------------------------------------------
      */

      const invitationToken = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(invitationToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      /*
      |--------------------------------------------------------------------------
      | Create invitation
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | Create frontend invitation URL
      |--------------------------------------------------------------------------
      */

      const frontendUrl = (
        process.env.FRONTEND_URL || "http://localhost:5173"
      ).replace(/\/$/, "");

      const invitationUrl = `${frontendUrl}/employee-invitation/${invitationToken}`;

      /*
      |--------------------------------------------------------------------------
      | Send invitation email
      |--------------------------------------------------------------------------
      */

      const recipientName = existingUser.name || "there";

      try {
        await sendEmployeeInvitationEmail(
          normalizedEmail,
          recipientName,
          workspace.name,
          normalizedRole,
          invitationUrl,
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

      /*
      |--------------------------------------------------------------------------
      | Create notification
      |--------------------------------------------------------------------------
      */

      try {
        await pool.query(
          `INSERT INTO notifications
           (
             user_id,
             title,
             message
           )
           VALUES ($1, $2, $3)`,
          [
            existingUser.id,
            "Company Invitation",
            `You have been invited to join ${workspace.name} as ${normalizedRole}. Invitation ID: ${invitation.id}. Open this notification to review and accept the invitation.`,
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
| Validate Employee Invitation
|--------------------------------------------------------------------------
|
| PUBLIC ENDPOINT
|
*/

router.get("/invitations/:token", async (req, res) => {
  const { token } = req.params;

  if (!token || !token.trim()) {
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
      `
      SELECT
        employee_invitations.id,
        employee_invitations.workspace_id,
        employee_invitations.invited_email,
        employee_invitations.role,
        employee_invitations.status,
        employee_invitations.expires_at,
        employee_invitations.created_at,
        workspaces.name AS workspace_name,
        workspaces.type AS workspace_type,
        workspaces.organization_id,
        organizations.organization_id AS public_organization_id,
        organizations.name AS organization_name,
        organizations.type AS organization_type,
        organizations.verification_status AS organization_verification_status
      FROM employee_invitations
      JOIN workspaces
        ON employee_invitations.workspace_id = workspaces.id
      LEFT JOIN organizations
        ON workspaces.organization_id = organizations.id
      WHERE employee_invitations.token_hash = $1
      LIMIT 1
      `,
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
        `
        UPDATE employee_invitations
        SET status = 'EXPIRED'
        WHERE id = $1
          AND status = 'PENDING'
        `,
        [invitation.id],
      );

      return res.status(400).json({
        error: "This invitation has expired",
      });
    }

    if (invitation.workspace_type !== "COMPANY") {
      return res.status(400).json({
        error: "This invitation is not valid for an organization workspace",
      });
    }

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

      organization: {
        organization_id: invitation.public_organization_id,
        name: invitation.organization_name,
        type: invitation.organization_type,
      },

      workspace: {
        id: invitation.workspace_id,
        name: invitation.workspace_name,
        type: invitation.workspace_type,
      },
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
|
| AUTHENTICATED ENDPOINT
|
*/

router.get(
  "/invitations/id/:invitationId",
  authMiddleware,
  async (req, res) => {
    const { invitationId } = req.params;

    if (!invitationId || !Number.isInteger(Number(invitationId))) {
      return res.status(400).json({
        error: "Valid invitation ID is required",
      });
    }

    try {
      const invitationResult = await pool.query(
        `
        SELECT
          employee_invitations.id,
          employee_invitations.workspace_id,
          employee_invitations.invited_email,
          employee_invitations.role,
          employee_invitations.status,
          employee_invitations.expires_at,
          employee_invitations.created_at,
          workspaces.name AS workspace_name,
          workspaces.type AS workspace_type,
          workspaces.organization_id,
          organizations.organization_id AS public_organization_id,
          organizations.name AS organization_name,
          organizations.type AS organization_type,
          organizations.verification_status AS organization_verification_status
        FROM employee_invitations
        JOIN workspaces
          ON employee_invitations.workspace_id = workspaces.id
        LEFT JOIN organizations
          ON workspaces.organization_id = organizations.id
        WHERE employee_invitations.id = $1
        LIMIT 1
        `,
        [Number(invitationId)],
      );

      if (invitationResult.rows.length === 0) {
        return res.status(404).json({
          error: "Invitation not found",
        });
      }

      const invitation = invitationResult.rows[0];

      const userResult = await pool.query(
        `
        SELECT
          id,
          name,
          email
        FROM users
        WHERE id = $1
        `,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "Logged-in user not found",
        });
      }

      const user = userResult.rows[0];

      const invitedEmail = invitation.invited_email.trim().toLowerCase();

      const loggedInEmail = user.email.trim().toLowerCase();

      if (invitedEmail !== loggedInEmail) {
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
          `
          UPDATE employee_invitations
          SET status = 'EXPIRED'
          WHERE id = $1
            AND status = 'PENDING'
          `,
          [invitation.id],
        );

        return res.status(400).json({
          error: "This invitation has expired",
        });
      }

      if (invitation.workspace_type !== "COMPANY") {
        return res.status(400).json({
          error: "This invitation is not valid for an organization workspace",
        });
      }

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

      const membershipResult = await pool.query(
        `
        SELECT
          id,
          role
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
        `,
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

        organization: {
          organization_id: invitation.public_organization_id,
          name: invitation.organization_name,
          type: invitation.organization_type,
        },

        workspace: {
          id: invitation.workspace_id,
          name: invitation.workspace_name,
          type: invitation.workspace_type,
        },
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
|
| AUTHENTICATED ENDPOINT
|
| This endpoint is used when an employee opens a Company Invitation
| notification from inside the ZYRA application.
|
| The invitation ID is used instead of the raw email invitation token.
|
*/

router.post(
  "/invitations/id/:invitationId/accept",
  authMiddleware,
  async (req, res) => {
    const { invitationId } = req.params;

    if (!invitationId || !Number.isInteger(Number(invitationId))) {
      return res.status(400).json({
        error: "Valid invitation ID is required",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const invitationResult = await client.query(
        `
        SELECT
          employee_invitations.id,
          employee_invitations.workspace_id,
          employee_invitations.invited_email,
          employee_invitations.role,
          employee_invitations.status,
          employee_invitations.expires_at,
          employee_invitations.created_at,
          workspaces.name AS workspace_name,
          workspaces.type AS workspace_type,
          workspaces.organization_id,
          organizations.organization_id AS public_organization_id,
          organizations.name AS organization_name,
          organizations.verification_status AS organization_verification_status
        FROM employee_invitations
        JOIN workspaces
          ON employee_invitations.workspace_id = workspaces.id
        LEFT JOIN organizations
          ON workspaces.organization_id = organizations.id
        WHERE employee_invitations.id = $1
        FOR UPDATE OF employee_invitations
        `,
        [Number(invitationId)],
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
          `
          UPDATE employee_invitations
          SET status = 'EXPIRED'
          WHERE id = $1
            AND status = 'PENDING'
          `,
          [invitation.id],
        );

        await client.query("COMMIT");

        return res.status(400).json({
          error: "This invitation has expired",
        });
      }

      if (invitation.workspace_type !== "COMPANY") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This invitation is not valid for an organization workspace",
        });
      }

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

      const userResult = await client.query(
        `
        SELECT
          id,
          name,
          email
        FROM users
        WHERE id = $1
        `,
        [req.user.id],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Logged-in user not found",
        });
      }

      const user = userResult.rows[0];

      const invitedEmail = invitation.invited_email.trim().toLowerCase();

      const loggedInEmail = user.email.trim().toLowerCase();

      if (invitedEmail !== loggedInEmail) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "This invitation was issued for a different email address",
        });
      }

      const existingMembershipResult = await client.query(
        `
        SELECT
          id,
          role
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
        `,
        [invitation.workspace_id, user.id],
      );

      if (existingMembershipResult.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error: "You are already a member of this workspace",
        });
      }

      const membershipResult = await client.query(
        `
        INSERT INTO workspace_members
        (
          workspace_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          workspace_id,
          user_id,
          role,
          joined_at
        `,
        [invitation.workspace_id, user.id, invitation.role],
      );

      const organizationMemberResult = await client.query(
        `
        INSERT INTO organization_members
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
          joined_at
        `,
        [invitation.organization_id, user.id],
      );

      const acceptedInvitationResult = await client.query(
        `
        UPDATE employee_invitations
        SET status = 'ACCEPTED'
        WHERE id = $1
          AND status = 'PENDING'
        RETURNING
          id,
          workspace_id,
          invited_email,
          role,
          status,
          expires_at,
          created_at
        `,
        [invitation.id],
      );

      if (acceptedInvitationResult.rows.length === 0) {
        throw new Error("Invitation could not be marked as accepted");
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Employee invitation accepted successfully",

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },

        organization: {
          organization_id: invitation.public_organization_id,
          name: invitation.organization_name,
        },

        workspace: {
          id: invitation.workspace_id,
          name: invitation.workspace_name,
          type: invitation.workspace_type,
        },

        membership: membershipResult.rows[0],

        organization_membership: organizationMemberResult.rows[0] || null,

        invitation: acceptedInvitationResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Accept employee invitation by ID error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "You are already a member of this workspace",
        });
      }

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace, user, or organization relationship not found",
        });
      }

      return res.status(500).json({
        error: "Unable to accept employee invitation",
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
|
| EXISTING ACCOUNT FLOW
|
*/

router.post("/invitations/:token/accept", authMiddleware, async (req, res) => {
  const { token } = req.params;

  if (!token || !token.trim()) {
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
      `
        SELECT
          employee_invitations.id,
          employee_invitations.workspace_id,
          employee_invitations.invited_email,
          employee_invitations.role,
          employee_invitations.status,
          employee_invitations.expires_at,
          workspaces.name AS workspace_name,
          workspaces.type AS workspace_type,
          workspaces.organization_id,
          organizations.organization_id AS public_organization_id,
          organizations.name AS organization_name,
          organizations.verification_status AS organization_verification_status
        FROM employee_invitations
        JOIN workspaces
          ON employee_invitations.workspace_id = workspaces.id
        LEFT JOIN organizations
          ON workspaces.organization_id = organizations.id
        WHERE employee_invitations.token_hash = $1
        FOR UPDATE OF employee_invitations
        `,
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
        `
          UPDATE employee_invitations
          SET status = 'EXPIRED'
          WHERE id = $1
            AND status = 'PENDING'
          `,
        [invitation.id],
      );

      await client.query("COMMIT");

      return res.status(400).json({
        error: "This invitation has expired",
      });
    }

    if (invitation.workspace_type !== "COMPANY") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "This invitation is not valid for an organization workspace",
      });
    }

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

    const userResult = await client.query(
      `
        SELECT
          id,
          name,
          email
        FROM users
        WHERE id = $1
        `,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Logged-in user not found",
      });
    }

    const user = userResult.rows[0];

    const invitedEmail = invitation.invited_email.trim().toLowerCase();

    const loggedInEmail = user.email.trim().toLowerCase();

    if (invitedEmail !== loggedInEmail) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "This invitation was issued for a different email address",
      });
    }

    const existingMembershipResult = await client.query(
      `
        SELECT
          id,
          role
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = $2
        `,
      [invitation.workspace_id, user.id],
    );

    if (existingMembershipResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "You are already a member of this workspace",
      });
    }

    const membershipResult = await client.query(
      `
        INSERT INTO workspace_members
        (
          workspace_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          workspace_id,
          user_id,
          role,
          joined_at
        `,
      [invitation.workspace_id, user.id, invitation.role],
    );

    const organizationMemberResult = await client.query(
      `
        INSERT INTO organization_members
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
          joined_at
        `,
      [invitation.organization_id, user.id],
    );

    const acceptedInvitationResult = await client.query(
      `
        UPDATE employee_invitations
        SET status = 'ACCEPTED'
        WHERE id = $1
          AND status = 'PENDING'
        RETURNING
          id,
          workspace_id,
          invited_email,
          role,
          status,
          expires_at,
          created_at
        `,
      [invitation.id],
    );

    if (acceptedInvitationResult.rows.length === 0) {
      throw new Error("Invitation could not be marked as accepted");
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Employee invitation accepted successfully",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      organization: {
        organization_id: invitation.public_organization_id,
        name: invitation.organization_name,
      },

      workspace: {
        id: invitation.workspace_id,
        name: invitation.workspace_name,
        type: invitation.workspace_type,
      },

      membership: membershipResult.rows[0],

      organization_membership: organizationMemberResult.rows[0] || null,

      invitation: acceptedInvitationResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Accept employee invitation error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "You are already a member of this workspace",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, user, or organization relationship not found",
      });
    }

    res.status(500).json({
      error: "Unable to accept employee invitation",
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

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const client = await pool.connect();

    try {
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
        `SELECT
           id,
           name,
           email
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
         VALUES ($1, $2, 'TEAM_LEADER')
         RETURNING
           id,
           workspace_id,
           user_id,
           role,
           joined_at`,
        [workspaceId, userId],
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Team Leader added to company workspace successfully",
        membership: memberResult.rows[0],
        organization_membership: organizationMemberResult.rows[0] || null,
        user: userResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

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

      res.status(500).json({
        error: "Database error",
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

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }

  const client = await pool.connect();

  try {
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
      `SELECT
           id,
           name,
           email
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
         VALUES ($1, $2, 'USER')
         RETURNING
           id,
           workspace_id,
           user_id,
           role,
           joined_at`,
      [workspaceId, userId],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "User added to company workspace successfully",
      membership: memberResult.rows[0],
      organization_membership: organizationMemberResult.rows[0] || null,
      user: userResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

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

    res.status(500).json({
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

    res.status(201).json({
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

    res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get My Workspaces
|--------------------------------------------------------------------------
|
| Returns every workspace the logged-in user belongs to,
| together with their role in each workspace.
|
| IMPORTANT:
| Workspace role comes from workspace_members.role.
| We do NOT use users.role.
|
*/

router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         workspaces.id,
         workspaces.name,
         workspaces.type,
         workspaces.created_by,
         workspaces.created_at,
         workspace_members.role,
         workspace_members.joined_at
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.user_id = $1
       ORDER BY workspaces.created_at ASC`,
      [req.user.id],
    );

    res.json({
      workspaces: result.rows,
    });
  } catch (error) {
    console.error("Get my workspaces error:", error.message);

    res.status(500).json({
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

      res.status(500).json({
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
| Any member of a PROJECT or COMPANY workspace can view
| the members of that workspace.
|
*/

router.get("/:workspaceId/members", authMiddleware, async (req, res) => {
  try {
    const membershipResult = await pool.query(
      `SELECT workspace_members.role
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
      [req.params.workspaceId, req.user.id],
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
           workspace_members.role,
           workspace_members.joined_at
         FROM workspace_members
         JOIN users
           ON workspace_members.user_id = users.id
         WHERE workspace_members.workspace_id = $1
         ORDER BY workspace_members.joined_at ASC`,
      [req.params.workspaceId],
    );

    res.json({
      workspaceId: Number(req.params.workspaceId),
      members: membersResult.rows,
    });
  } catch (error) {
    console.error("Get workspace members error:", error.message);

    res.status(500).json({
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

      res.json({
        message: "User removed from workspace successfully",
        workspaceId: Number(workspaceId),
        userId: Number(userId),
      });
    } catch (error) {
      console.error("Remove workspace member error:", error.message);

      res.status(500).json({
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
| ADMIN / HR
|
| ADMIN:
|   Can remove HR, TEAM_LEADER and USER.
|
| HR:
|   Can remove TEAM_LEADER and USER.
|   Cannot remove another HR.
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

      if (Number(userId) === req.user.id) {
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

      res.json({
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
      await client.query("ROLLBACK");

      console.error("Remove company member error:", error.message);

      if (error.code === "23503") {
        return res.status(404).json({
          error: "Workspace or member not found",
        });
      }

      res.status(500).json({
        error: "Database error",
      });
    } finally {
      client.release();
    }
  },
);

module.exports = router;
