import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { paystackPayment } from "../../../drizzle";

export const paystackLogs = pgTable(
    "payment_logs",
    {
        id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
        paymentId: uuid("payment_id").references(() => paystackPayment.id, {
            onDelete: "cascade",
        }),
        // Primary transaction reference from Paystack
        reference: varchar("reference", { length: 100 }).notNull(),
        

        event: varchar("event", { length: 100 }), // initialize, verify, webhook, etc.
        status: varchar("status", { length: 50 }),
        request: jsonb("request"),
        response: jsonb("response"),
        ipAddress: varchar("ip_address", { length: 45 }),

        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        paymentIdIdx: index("idx_ps_logs_payment_id").on(table.paymentId),
        eventIdx: index("idx_ps_logs_event").on(table.event),
    }),
);