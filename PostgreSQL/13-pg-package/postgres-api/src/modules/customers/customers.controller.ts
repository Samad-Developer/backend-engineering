import type { Request, Response } from "express";
import { getCustomerById } from "./customers.service.ts";

export const getCustomer = async (req: Request, res: Response) => {
    const { id } = req.params;

    // get customer by id from database
    const customer = await getCustomerById(String(id)); // Replace with actual database query

    res.status(200).json({
        success: true,
        data: customer,
    });
}


