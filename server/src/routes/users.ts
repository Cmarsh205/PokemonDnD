import { Hono } from "hono";
import { pool } from "../db";

const users = new Hono();

users.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { username, email } = body;

    if (!username || !email) {
      return c.json(
        {
          error: "Username and email are required",
        },
        400
      );
    }

    const result = await pool.query(
      `
        INSERT INTO users (username, email)
        VALUES ($1, $2)
        RETURNING *
      `,
      [username, email]
    );

    return c.json(result.rows[0], 201);
  } catch (error: any) {
    console.error("Create user error:", error);

    if (error.code === "23505") {
      return c.json(
        {
          error: "A user with that username or email already exists",
        },
        409
      );
    }

    return c.json(
      {
        error: "Failed to create user",
      },
      500
    );
  }
});

export default users;