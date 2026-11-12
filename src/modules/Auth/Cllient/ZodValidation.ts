import { z } from "zod";

export const signUpDto = z
    .object({
        name: z.string(),
        email: z.email().toLowerCase(),
        password: z.string().min(6, "password must be up to 6 or more")
    });

