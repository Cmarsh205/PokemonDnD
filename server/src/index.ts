import { Hono } from "hono";
import { serve } from "@hono/node-server";

import { pool } from "./db";
import users from "./routes/users";
import campaigns from "./routes/campaigns";
import invites from "./routes/invites";

const app = new Hono();

// -----------------------
// Health
// -----------------------

app.get("/api/health", async (c) => {
  try {
    const result = await pool.query("SELECT NOW()");

    return c.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return c.json(
      {
        status: "error",
        database: "disconnected",
      },
      500
    );
  }
});

// -----------------------
// Routes
// -----------------------

app.route("/api/users", users);
app.route("/api/campaigns", campaigns);
app.route("/api/invites", invites);

// -----------------------
// Start Server
// -----------------------

serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server running on http://localhost:3000");