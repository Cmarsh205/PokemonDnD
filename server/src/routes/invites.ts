import { Hono } from "hono";
import { pool } from "../db";
import { randomUUID } from "crypto";

const invites = new Hono();

// Create a new invite
invites.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { campaignId } = body;

    if (!campaignId) {
      return c.json(
        {
          error: "Campaign ID is required",
        },
        400
      );
    }

    const inviteCode = randomUUID();

    const result = await pool.query(
      `
        INSERT INTO invites (campaign_id, invite_code)
        VALUES ($1, $2)
        RETURNING *
      `,
      [campaignId, inviteCode]
    );

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    console.error("Create invite error:", error);

    if (error.code === "23503") {
      return c.json(
        {
          error: "Campaign does not exist",
        },
        404
      );
    }

    return c.json(
      {
        error: "Failed to create invite",
      },
      500
    );
  }
});

// Get/validate an invite
invites.get("/:code", async (c) => {
  try {
    const code = c.req.param("code");

    const result = await pool.query(
      `
        SELECT
          invites.invite_id,
          invites.invite_code,
          invites.created_at,
          invites.expires_at,
          campaigns.campaign_id,
          campaigns.name AS campaign_name,
          campaigns.description
        FROM invites
        JOIN campaigns
          ON invites.campaign_id = campaigns.campaign_id
        WHERE invites.invite_code = $1
      `,
      [code]
    );

    if (result.rows.length === 0) {
      return c.json(
        {
          error: "Invite not found",
        },
        404
      );
    }

    const invite = result.rows[0];

    // We'll make use of this once invites have expiration dates.
    if (
      invite.expires_at &&
      new Date(invite.expires_at) < new Date()
    ) {
      return c.json(
        {
          error: "Invite has expired",
        },
        410
      );
    }

    return c.json(invite);
  } catch (error) {
    console.error("Get invite error:", error);

    return c.json(
      {
        error: "Failed to get invite",
      },
      500
    );
  }
});

// Join a campaign using an invite code
invites.post("/:code/join", async (c) => {
    try {
      const code = c.req.param("code");
  
      const body = await c.req.json();
      const { userId } = body;
  
      if (!userId) {
        return c.json(
          {
            error: "User ID is required",
          },
          400
        );
      }
  
      // Find the invite
      const inviteResult = await pool.query(
        `
          SELECT campaign_id, expires_at
          FROM invites
          WHERE invite_code = $1
        `,
        [code]
      );
  
      if (inviteResult.rows.length === 0) {
        return c.json(
          {
            error: "Invite not found",
          },
          404
        );
      }
  
      const invite = inviteResult.rows[0];
  
      // Check expiration
      if (
        invite.expires_at &&
        new Date(invite.expires_at) < new Date()
      ) {
        return c.json(
          {
            error: "Invite has expired",
          },
          410
        );
      }
  
      // Add player to campaign
      const memberResult = await pool.query(
        `
          INSERT INTO campaign_members (campaign_id, user_id)
          VALUES ($1, $2)
          RETURNING *
        `,
        [invite.campaign_id, userId]
      );
  
      return c.json(
        {
          message: "Successfully joined campaign",
          member: memberResult.rows[0],
        },
        201
      );
    } catch (error: any) {
      console.error("Join campaign error:", error);
  
      // Duplicate campaign member
      if (error.code === "23505") {
        return c.json(
          {
            error: "User is already a member of this campaign",
          },
          409
        );
      }
  
      // Invalid user ID
      if (error.code === "23503") {
        return c.json(
          {
            error: "User does not exist",
          },
          404
        );
      }
  
      return c.json(
        {
          error: "Failed to join campaign",
        },
        500
      );
    }
  });

export default invites;