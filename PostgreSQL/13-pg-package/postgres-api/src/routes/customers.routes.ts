import { Router } from "express";
import { pool } from "../db.ts";
import { getCustomer} from "../modules/customers/customers.controller.ts"

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
        FROM customers
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

router.get("/:id", getCustomer);

type CreateCustomerBody = {
  name: string;
  id: number;
};

router.post("/", async (req, res) => {
  try {
    const { name, id } = req.body as CreateCustomerBody;

    if (!name || !id) {
      return res.status(400).json({
        message: "Name and id are required",
      });
    }

    const result = await pool.query<Customer>(
      `
        INSERT INTO customers (id, name)
        VALUES ($1, $2)
        RETURNING id, name
      `,
      [id, name]
    );

    res.status(201).json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error"
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const customerId = Number(req.params.id);

    const result = await pool.query<Customer>(
      `
        DELETE FROM customers
        WHERE id = $1
        RETURNING id, name
      `,
      [customerId]
    );

    console.log("Delete query result:", result);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json({
      message: "Customer deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;