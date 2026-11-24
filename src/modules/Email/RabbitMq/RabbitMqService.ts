import * as amqp from 'amqplib';
import { config } from '../../../config/config';
import { getEmailChannel } from './RabbitMq';
import EmailService from '../service/EmailService';
import { client } from '../../../middleware/redis-client';
import { outPutSchema } from '../../../drizzle';
import { db } from '../../../drizzle/postgresql-db';
import { eq } from 'drizzle-orm';

export class EmailRabbitService {
    private service: EmailService;
    private Emails: typeof outPutSchema;
    constructor() {
        this.service = new EmailService();
        this.Emails = outPutSchema;
    }
    /** not now Publish a message (fire-and-forget) — replaces `this.rabbitmq.emit(...)` */
    async publish(payload: object): Promise<void> {
        const channel = getEmailChannel();
        const messageId = crypto.randomUUID();

        channel.sendToQueue(
            config.emailQueue,
            Buffer.from(JSON.stringify(payload)),
            {
                persistent: true,
                contentType: 'application/json',
                messageId,
            },
        );

        await channel.waitForConfirms();
    }

    /** Start consuming — replaces `@EventPattern` */
    async startEmailConsumer(): Promise<void> {
        const channel = getEmailChannel();

        await channel.consume(
            config.emailQueue,
            async (msg) => {
                if (!msg) return;   // consumer cancelled, not an error

                const payload = JSON.parse(msg.content.toString());

                const emailID = payload.emailId;

                if (!emailID) return channel.ack(msg); // no ID → can't dedupe

                const redisKey = `processed:${emailID}`;

                // Check and "reserve" atomically. NX = only set if not exists
                const acquired = await client.set(redisKey, '1', { NX: true, EX: 86400 });
                if (!acquired) {
                    console.log(`⏩ Already processed: ${emailID}`);
                    channel.ack(msg);
                    return;
                }

                
                try {
                    const payload = JSON.parse(msg.content.toString());

                    const result = await this.service.sendEmail(payload);

                    channel.ack(msg);
                    return result;
                } catch (error) {
                    await client.del(redisKey);
                    await this.ackErrorwatch(error, msg, channel);
                }
            },
            { noAck: false },
        );

        console.log('Email Consumer started');
    }

    /** The retry + DLQ logic — replaces `ackErrorwatch` */
    private async ackErrorwatch(
        error: unknown,
        msg: amqp.ConsumeMessage,
        channel: amqp.ConfirmChannel,
    ): Promise<void> {
        const err = error as Error;

        const isTransient =
            err.name === 'MongoNetworkError' ||
            err.name === 'MongoServerSelectionError' ||
            err.name === 'MongoNotConnectedError';

        const deaths = msg.properties.headers?.['x-death']?.[0]?.count ?? 0;
        const maxRetries = 5

        if (isTransient && deaths < maxRetries) {
            console.warn(` Transient error (attempt ${deaths + 1}/${maxRetries}) — retrying`);
            channel.publish('email-express.dlx', 'email-retry-express', msg.content, {
                persistent: true,
                headers: msg.properties.headers,  // preserve x-death
                contentType: msg.properties.contentType,
            });
            channel.ack(msg);
            return;
        }

        console.error(` Permanent failure — moving to DLQ. Reason: ${isTransient ? 'max retries' : err.name}`);
        channel.publish('email-express.dlx', 'dlq', msg.content, {
            persistent: true,
            headers: msg.properties.headers,
            contentType: msg.properties.contentType,
        });

        const payload = JSON.parse(msg.content.toString());

        const email = payload.email;

        await db
        .update(this.Emails)
        .set({status: "failed"})
        .where(eq(this.Emails.email, email))

        channel.ack(msg);
    }
}