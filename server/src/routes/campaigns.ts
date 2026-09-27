import { Hono } from "hono";
import { pool } from "../db";

const campaigns = new Hono();

campaigns.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, dmUserId } = body;

    if (!name || !dmUserId) {
      return c.json(
        {
          error: "Campaign name and DM user ID are required",
        },
        400
      );
    }

    const result = await pool.query(
      `
        INSERT INTO campaigns (name, description, dm_user_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [name, description ?? null, dmUserId]
    );

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    console.error("Create campaign error:", error);

    if (error.code === "23503") {
      return c.json(
        {
          error: "The specified DM user does not exist",
        },
        400
      );
    }

    return c.json(
      {
        error: "Failed to create campaign",
      },
      500
    );
  }
});

campaigns.get("/:id", async (c) => {
    try {
      const campaignId = Number(c.req.param("id"));
  
      if (!Number.isInteger(campaignId) || campaignId <= 0) {
        return c.json(
          {
            error: "Invalid campaign ID",
          },
          400
        );
      }
  
      // Get campaign + DM
      const campaignResult = await pool.query(
        `
          SELECT
            campaigns.campaign_id,
            campaigns.name,
            campaigns.description,
            campaigns.created_at,
            campaigns.updated_at,
            users.user_id AS dm_user_id,
            users.username AS dm_username,
            users.email AS dm_email
          FROM campaigns
          JOIN users
            ON campaigns.dm_user_id = users.user_id
          WHERE campaigns.campaign_id = $1
        `,
        [campaignId]
      );
  
      if (campaignResult.rows.length === 0) {
        return c.json(
          {
            error: "Campaign not found",
          },
          404
        );
      }
  
      // Get all players in the campaign
      const membersResult = await pool.query(
        `
          SELECT
            users.user_id,
            users.username,
            users.email,
            campaign_members.joined_at
          FROM campaign_members
          JOIN users
            ON campaign_members.user_id = users.user_id
          WHERE campaign_members.campaign_id = $1
          ORDER BY campaign_members.joined_at ASC
        `,
        [campaignId]
      );
  
      const campaign = campaignResult.rows[0];
  
      return c.json({
        campaignId: campaign.campaign_id,
        name: campaign.name,
        description: campaign.description,
  
        dm: {
          userId: campaign.dm_user_id,
          username: campaign.dm_username,
          email: campaign.dm_email,
        },
  
        members: membersResult.rows.map((member) => ({
          userId: member.user_id,
          username: member.username,
          email: member.email,
          joinedAt: member.joined_at,
        })),
  
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      });
    } catch (error) {
      console.error("Get campaign error:", error);
  
      return c.json(
        {
          error: "Failed to get campaign",
        },
        500
      );
    }
  });

export default campaigns;