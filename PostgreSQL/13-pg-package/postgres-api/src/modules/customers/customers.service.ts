import { findById } from './customers.repository.ts';

export async function getCustomerById(customerId: string) {
    // Implementation for fetching customer by ID
    const customer = await findById(customerId); // Replace with actual database query

    if (!customer) {
        throw new Error(`Customer with ID ${customerId} not found`);
    }

    return customer;
}