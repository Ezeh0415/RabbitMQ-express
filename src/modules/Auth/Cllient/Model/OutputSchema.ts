// heres the output for email fetch and send

import { sql } from 'drizzle-orm';
import { varchar } from 'drizzle-orm/pg-core';
import { pgTable, uuid } from "drizzle-orm/pg-core";
import { userOutPutEnum } from '../../../Enums';

const outPutSchema = pgTable("outputSchema", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),

    emailId: varchar("emailId", { length: 255 }).notNull(),

    email: varchar("email", { length: 255 }).notNull().unique(),

    subject: varchar("subject", { length: 255 }).notNull(),

    status: userOutPutEnum("status").default("pending"),

    emailBody: varchar("emailBody", { length: 1000 }).notNull(),

});

export { outPutSchema };