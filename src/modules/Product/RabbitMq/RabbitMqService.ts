import * as amqp from 'amqplib';
import { config } from '../../../config/config';
import productService from '../Service/ProductService';
import { getChannel } from './RabbitMq';
import { EmailRabbitService } from '../../Email/RabbitMq/RabbitMqService';
import { client } from '../../../middleware/redis-client';

export class RabbitService {
    private service: productService;
    constructor() {
        this.service = new productService(new EmailRabbitService());
    }
    async publish(payload: object): Promise<void> {

        // ===== THIS IS TO BE USED IF THE PUBLISH IS IN THE MAIN GATEWAY IN A MICROSERVICE PROJECT =====//

        // let channel;
        
        // async function connect() {
            //     const conn = await amqp.connect('amqp://localhost');
            //     channel = await conn.createChannel();
            //     await channel.assertQueue('product_queue', { durable: true });
            // }
            
            // ===== THIS IS TO BE USED IF THE PUBLISH IS IN THE MAIN GATEWAY IN A MICROSERVICE PROJECT =====//

        const channel = getChannel();
        const messageId = crypto.randomUUID();

        channel.sendToQueue(
            config.queue,
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
    async startConsumer(): Promise<void> {
        const channel = getChannel();

        await channel.consume(
            config.queue,
            async (msg) => {
                if (!msg) return;   // consumer cancelled, not an error

                const payload = JSON.parse(msg.content.toString());
                const { event, data } = payload;


                const messageId = data.msguuid;

                console.log(messageId);



                if (!messageId) return channel.ack(msg); // no ID → can't dedupe

                const redisKey = `processed:${messageId}`;

                // Check and "reserve" atomically. NX = only set if not exists
                const acquired = await client.set(redisKey, '1', { NX: true, EX: 86400 });
                if (!acquired) {
                    console.log(`⏩ Already processed: ${messageId}`);
                    channel.ack(msg);
                    return;
                }

                try {


                    const result = await this.service.createProduct(payload);

                    channel.ack(msg);
                    return result;
                } catch (error) {
                    await client.del(redisKey);
                    await this.ackErrorwatch(error, msg, channel);
                }
            },
            { noAck: false },
        );

        console.log('product Consumer started');
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
            channel.publish('rabbit-test-express.dlx', 'retry-express', msg.content, {
                persistent: true,
                headers: msg.properties.headers,  // preserve x-death
                contentType: msg.properties.contentType,
            });
            channel.ack(msg);
            return;
        }

        console.error(` Permanent failure — moving to DLQ. Reason: ${isTransient ? 'max retries' : err.name}`);
        channel.publish('rabbit-test-express.dlx', 'dlq', msg.content, {
            persistent: true,
            headers: msg.properties.headers,
            contentType: msg.properties.contentType,
        });
        channel.ack(msg);
    }
}