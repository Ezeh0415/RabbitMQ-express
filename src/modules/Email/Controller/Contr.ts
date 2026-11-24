import { CronJob } from "cron";
import { outPutSchema } from "../../../drizzle";
import { db } from "../../../drizzle/postgresql-db";
import { eq } from "drizzle-orm";
import { EmailRabbitService } from "../RabbitMq/RabbitMqService";

class emailContr {
    private Email: typeof outPutSchema;
    constructor(private readonly rabbit: EmailRabbitService) {
        this.Email = outPutSchema;
    }

    async processEmail() {
        try {
            
            const emails = await db
                .select()
                .from(this.Email)
                .where(eq(this.Email.status, "pending"))

            if (emails.length === 0) {
                console.error("[cron] no pending emails");
                return;
            }

            for (const email of emails) {
                await this.rabbit.publish(email);
            }

            return "email processing";
        } catch (error) {
            const err = error as Error;
            console.log(err)

        }
    }
}

export default emailContr;