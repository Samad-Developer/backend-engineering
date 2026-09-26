import { pool } from "../../db.ts";

export type Customer = {
  id: string;
  name: string;
  email: string;
};

export async function findById(
  customerId: string
): Promise<Customer | null> {
  const result =
    await pool.query<Customer>(
      `
        SELECT id, name
        FROM customers
        WHERE id = $1
      `,
      [customerId]
    );

  return result.rows[0] ?? null;
}