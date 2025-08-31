import { email, z } from "zod"

export const registerschema = z.object({
  firstname: z
    .string()
    .trim()
    .min(3, "First name too short")
    .max(20, "First name too long")
    .regex(/^[A-Za-z]+$/, "First name should only contain letters"),

  lastname: z
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

  passwordHash: z
    .string()
    .min(5, "Password must be at least 5 characters")
    .max(20, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
})

export const loginschema = z.object({

  email: z
    .string()
    .trim()
    .min(5, "Email too short")
    .max(50, "Email too long")
    .email("Invalid email format"),

  passwordHash: z
    .string()
    .min(5, "Password must be at least 5 characters")
    .max(20, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
})

export const updatePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(5, "Password must be at least 5 characters")
      .max(20, "Password too long"),

    newPassword: z
      .string()
      .min(5, "Password must be at least 5 characters")
      .max(20, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]+$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),

    // confirmPassword: z
    //       .string()
    //       .min(5, "Password must be at least 5 characters")
    //       .max(20, "Password too long"),
    //   })
    //   .refine((data) => data.newPassword === data.confirmPassword, {
    //     message: "New password and confirm password must match",
    //     path: ["confirmPassword"], 
  });


export const profileSchema = z.object({
  subjects: z.array(z.string()).min(1, "At least one subject is required"),
  learningStyle: z.string().min(2, "Learning style is required"),
  availability: z.array(z.string()).min(1, "At least one availability slot is required"),
  goals: z.string().min(5, "Goals should be at least 5 characters long"),
});