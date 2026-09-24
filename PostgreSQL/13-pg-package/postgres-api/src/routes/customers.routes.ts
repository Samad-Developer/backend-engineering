import { Router } from "express";
import { pool } from "../db.ts";

const router = Router();

type Customer = {
  id: number;
  name: string;
};

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query<Customer>(
      `
        SELECT id, name
        FROM users
        ORDER BY id
      `
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch customers:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
});

export default router;