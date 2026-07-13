import { z } from "zod";

export const studentLoginInputSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginInputSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const bulkStudentCreateInputSchema = z.object({
  students: z
    .array(
      z.object({
        studentId: z
          .string()
          .min(1, "Student ID is required")
          .regex(/^[A-Za-z0-9-]+$/, "Student ID must be alphanumeric/hyphens"),
        name: z.string().min(1, "Name is required"),
      }),
    )
    .min(1, "At least one student is required"),
});

export type StudentLoginInput = z.infer<typeof studentLoginInputSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>;
export type BulkStudentCreateInput = z.infer<typeof bulkStudentCreateInputSchema>;
