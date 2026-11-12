// will be using pg admin postgresql for this test

import { sql } from "drizzle-orm";
import { boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { varchar } from "drizzle-orm/pg-core";
import { pgTable, uuid } from "drizzle-orm/pg-core";
import { userRoleEnum } from "../../../Enums";


const userTable = pgTable("users", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

    name: varchar("name", { length: 100 }).notNull(),

    email: varchar("email", { length: 255 }).notNull().unique(),

    password: varchar("password", { length: 255 }).notNull(),

    otp: varchar("otp", { length: 6 }),

    otpExpiry: timestamp("otp_expiry"),

    isVerified: boolean("is_verified").default(false),

    role: userRoleEnum("role").default("user"),

    isDeleted: boolean("is_deleted").default(false),

    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").defaultNow(),

    updatedAt: timestamp("updated_at").defaultNow(),

    loginAttempts: integer("login_attempts").default(0),

    lockUntil: timestamp("lock_until")
})

export { userTable };