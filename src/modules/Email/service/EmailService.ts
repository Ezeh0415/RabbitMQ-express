import { eq } from "drizzle-orm";
import { outPutSchema } from "../../../drizzle";
import { db } from "../../../drizzle/postgresql-db";
import { SendEmailInput } from "../../utilis/Interface";
import { SendEmailResult } from "../../utilis/Types";

// ── Mock transporter (module-level) ─────────────────────────────────
const mockTransporter = {
    sendMail: async (_options: {
        from: string;
        to: string;
        subject: string;
        html: string;
    }): Promise<{ messageId: string }> => {
        const shouldFail = false; // flip to true to test the failure path
        if (shouldFail) {
            throw new Error("SMTP connection refused");
        }
        return { messageId: "mock-message-id" };
    },
};

// ── Service ─────────────────────────────────────────────────────────
class EmailService {
    private transporter: typeof mockTransporter;
    private Emails: typeof outPutSchema;

    constructor() {
        this.transporter = mockTransporter; // swap for real nodemailer later
        this.Emails = outPutSchema;
    }

    async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {

        const info = await this.transporter.sendMail({
            from: '"My App" <no-reply@myapp.com>',
            to: input.email,
            subject: input.subject,
            html: input.emailBody,
        });

        await db
            .update(this.Emails)
            .set({ status: "completed" })
            .where(eq(this.Emails.email, input.email));


        return {
            status: true,
            message: "email sent",
            messageId: info.messageId,
        };

    }
}

export default EmailService;