import z from "zod";

export const paymentValidation = z.object({
    paymentReference: z.string().optional(),
    email: z.email(),
    amount: z.number()
})