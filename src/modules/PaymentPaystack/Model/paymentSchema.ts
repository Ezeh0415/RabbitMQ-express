import { sql } from "drizzle-orm";
import { jsonb, pgTable, uuid } from "drizzle-orm/pg-core";
import { paymentEnum } from "../../Enums";
import { userTable } from "../../Auth/Cllient/Model/UserSchema";
import { varchar } from "drizzle-orm/pg-core";
import { integer } from "drizzle-orm/pg-core";
import { numeric } from "drizzle-orm/pg-core";
import { text } from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";

export const paystackPayment = pgTable(
    "payments",
    {
        id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

        // userId: uuid("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),

        paymentReference: varchar("payment_reference", { length: 100 }).notNull().unique(),

        trxRef: varchar("trx_ref", { length: 100 }),

        accessCode: varchar("assess_code", { length: 100 }).notNull(),

        // ========== PAYMENT DETAILS ==========
        // Amount in kobo (Paystack's smallest unit)
        amount: integer("amount").notNull(),

        // Amount in original currency (for display)
        amountInNaira: numeric("amount_in_naira", { precision: 10, scale: 2 }),

        // Currency (usually NGN)
        currency: varchar("currency", { length: 10 }).default("NGN"),

        // Payment description
        description: varchar("description", { length: 255 }),

        // ========== CUSTOMER INFORMATION ==========
        customerEmail: varchar("customer_email", { length: 255 }).notNull(),

        customerName: varchar("customer_name", { length: 255 }),

        customerPhone: varchar("customer_phone", { length: 50 }),

        // ========== PAYMENT STATUS ==========
        status: paymentEnum("payment_status").default("pending"),
        // Status values: pending, processing, success, failed, abandoned, reversed

        // Paystack's gateway response
        gatewayResponse: text("gateway_response"),

        // Transaction dates
        paidAt: timestamp("paid_at"),

        createdAt: timestamp("created_at").defaultNow(),

        updatedAt: timestamp("updated_at").defaultNow(),

        // ========== AUTHORIZATION DETAILS ==========
        // Store authorization for recurring payments
        authorizationCode: varchar("authorization_code", { length: 100 }).notNull(),

        // Card/Bank details
        cardType: varchar("card_type", { length: 50 }), // visa, mastercard, etc.

        last4: varchar("last4", { length: 4 }),

        expMonth: varchar("exp_month", { length: 2 }),

        expYear: varchar("exp_year", { length: 4 }),

        bin: varchar("bin", { length: 6 }),

        bank: varchar("bank", { length: 100 }),

        channel: varchar("channel", { length: 50 }), // card, bank, ussd, etc.

        // For bank transfers
        accountName: varchar("account_name", { length: 255 }),

        accountNumber: varchar("account_number", { length: 20 }),

        bankName: varchar("bank_name", { length: 100 }),

        // ========== PAYSTACK RESPONSE DATA ==========
        // Store complete Paystack response as JSON
        paystackResponse: jsonb("paystack_response"),

        // Transaction logs for debugging
        logs: jsonb("logs"),

        // ========== WEBHOOK DATA ==========
        // Track webhook events
        webhookEvents: jsonb("webhook_events"),
        webhookReceivedAt: timestamp("webhook_received_at"),

        // ========== METADATA ==========
        // Store any custom metadata you sent to Paystack
        metadata: jsonb("metadata"),

        // Custom fields for your application
        customFields: jsonb("custom_fields"),

        // ========== IP AND FINGERPRINT ==========
        ipAddress: varchar("ip_address", { length: 45 }),
        fingerprint: varchar("fingerprint", { length: 255 }),

        // ========== REVERSAL/REFUND INFORMATION ==========
        isReversed: boolean("is_reversed").default(false),
        reversedAt: timestamp("reversed_at"),
        reversalReason: text("reversal_reason"),

        // Refund information
        refundedAmount: integer("refunded_amount"),
        refundedAt: timestamp("refunded_at"),
        refundReference: varchar("refund_reference", { length: 100 }),
    },
        (table) => ({
            // ========== INDEXES FOR FAST QUERIES ==========
            // Most frequently queried fields
            referenceIdx: index("idx_ps_reference").on(table.paymentReference),
            emailIdx: index("idx_ps_email").on(table.customerEmail),
            statusIdx: index("idx_ps_status").on(table.status),
            // userIdIdx: index("idx_ps_user_id").on(table.userId),

            // Date range queries
            createdAtIdx: index("idx_ps_created_at").on(table.createdAt),
            paidAtIdx: index("idx_ps_paid_at").on(table.paidAt),

            // Composite indexes for common queries
            // userStatusIdx: index("idx_ps_user_status").on(table.userId, table.status),
            dateStatusIdx: index("idx_ps_date_status").on(
                table.createdAt,
                table.status,
            ),

            // Authorization lookups
            authCodeIdx: index("idx_ps_auth_code").on(table.authorizationCode),

            // For mobile money/bank transfers
            accountNumberIdx: index("idx_ps_account_number").on(table.accountNumber),
        }),
)