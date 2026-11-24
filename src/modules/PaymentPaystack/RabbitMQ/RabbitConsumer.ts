import { AxiosError } from "axios";
import { config } from "../../../config/config";
import { client } from "../../../middleware/redis-client";
import { paystackService } from "../Service/Service";
import { getChannel } from "./RabbitConnection";
import * as amqp from 'amqplib';
import { randomUUID } from "crypto";

export class paystackConsumer {
    private service: paystackService;
    constructor() {
        this.service = new paystackService();
    }

    async consumer(): Promise<void> {
        const channel = getChannel();

        await channel.consume(
            config.paystack_queue,
            async (msg) => {
                if (!msg) return;
                const payload = JSON.parse(msg.content.toString())
                const workerKey = randomUUID();

                const paymentKey = payload.paymentReference

                const redisKey = `processed:${paymentKey}`;

                if (payload.type === "initialize") {
                    // Check and "reserve" atomically. NX = only set if not exists
                    const acquired = await client.set(redisKey, workerKey, { NX: true, EX: 86400 });
                    if (!acquired) {
                        console.log(`Already processed: ${paymentKey}`);
                        channel.ack(msg);
                        return;
                    }
                }


                try {
                    let result;

                    switch (payload.type) {
                        case "initialize":
                            result = await this.service.initializePayment(payload);
                            if (msg.properties.replyTo) {
                                channel.sendToQueue(
                                    msg.properties.replyTo,
                                    Buffer.from(JSON.stringify({ success: true, data: result })),
                                    { correlationId: msg.properties.correlationId }
                                );
                            }
                            break;

                        case "webhook":
                            result = await this.service.webhook(payload);
                            if (msg.properties.replyTo) {
                                channel.sendToQueue(
                                    msg.properties.replyTo,
                                    Buffer.from(JSON.stringify({ success: true, data: result })),
                                    { correlationId: msg.properties.correlationId }
                                );
                            }

                        default:
                            console.warn('Unknown message type:', payload.type);
                            break;
                    }

                    // if (msg.properties.replyTo) {
                    //     channel.sendToQueue(
                    //         msg.properties.replyTo,
                    //         Buffer.from(JSON.stringify({ success: true, data: result })),
                    //         { correlationId: msg.properties.correlationId }
                    //     );
                    // }

                    // console.log(result)


                    channel.ack(msg);
                } catch (error) {
                    await client.del(redisKey);
                    if (msg.properties.replyTo) {
                        channel.sendToQueue(
                            msg.properties.replyTo,
                            Buffer.from(JSON.stringify({ success: false, error: (error as Error).message })),
                            { correlationId: msg.properties.correlationId }
                        );
                    }
                    await this.ackErrorwatch(error, msg, channel);
                }
            }
        );
        console.log('paystack Consumer started');
    }

    private async ackErrorwatch(
        error: unknown,
        msg: amqp.ConsumeMessage,
        channel: amqp.ConfirmChannel,
    ): Promise<void> {
        const err = error as Error;
        const isAxiosTransient = (err: any): boolean => {
            if (!(err instanceof AxiosError)) return false;

            // No response at all = network-level failure (timeout, DNS, connection refused) — transient
            if (!err.response) return true;

            // 5xx = server-side error on Paystack's end — transient, worth retrying
            if (err.response.status >= 500) return true;

            // 429 = rate limited — transient, should back off and retry
            if (err.response.status === 429) return true;

            // 4xx (except 429) = client error, retrying won't help — permanent
            return false;
        };

        const isTransient =
            err.name === 'MongoNetworkError' ||
            err.name === 'MongoServerSelectionError' ||
            err.name === 'MongoNotConnectedError' ||
            isAxiosTransient(err);

        const deaths = msg.properties.headers?.['x-death']?.[0]?.count ?? 0;
        const maxRetries = 5

        if (isTransient && deaths < maxRetries) {
            console.warn(` Transient error (attempt ${deaths + 1}/${maxRetries}) — retrying`);
            channel.publish(`${config.paystack_queue}.dlx`, `retry-${config.paystack_queue}`, msg.content, {
                persistent: true,
                headers: msg.properties.headers,  // preserve x-death
                contentType: msg.properties.contentType,
            });
            channel.ack(msg);
            return;
        }

        console.error(` Permanent failure — moving to DLQ. Reason: ${isTransient ? 'max retries' : err.name}`);
        channel.publish(`${config.paystack_queue}.dlx`, 'dlq', msg.content, {
            persistent: true,
            headers: msg.properties.headers,
            contentType: msg.properties.contentType,
        });
        channel.ack(msg);
    }
}