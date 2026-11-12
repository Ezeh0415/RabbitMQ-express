import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "staff", "user"]);

export const userOutPutEnum = pgEnum("email_status", [
    "pending",
    "completed",
    "failed",
])