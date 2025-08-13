import { email, z } from "zod"

export const registerschema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "First name too short")
        .max(20, "First name too long")
        .regex(/^[A-Za-z]+$/, "First name should only contain letters"),

    email: z
        .string()
        .trim()
        .min(5, "Email too short")
        .max(50, "Email too long")
        .email("Invalid email format"),

    passwordhash: z
        .string()
        .min(5, "Password must be at least 5 characters")
        .max(20, "Password too long")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]+$/,
            "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
        ),
})
