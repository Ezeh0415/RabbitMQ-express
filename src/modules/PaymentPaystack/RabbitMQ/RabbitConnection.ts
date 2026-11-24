import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { config } from "../../../config/config";


// async function cleanup() {
//     const conn = await amqp.connect(config.rabbitUrl!); // or config.rabbitUrl
//     const ch = await conn.createChannel();
//     await ch.deleteQueue(`${config.paystack_queue}`);
//     await ch.deleteQueue(`${config.paystack_queue}.retry`);
//     console.log('Queues deleted');
//     await ch.close();
//     await conn.close();
// }
// cleanup();

let connection: ChannelModel | undefined;
let channel: ConfirmChannel | undefined;

export async function paystackConnection() {
    connection = await amqp.connect(
        config.rabbitUrl
    );

    const confirmChannel = await connection.createConfirmChannel();
    channel = confirmChannel;

    await confirmChannel.assertExchange(`${config.paystack_queue}.dlx`, 'direct', { durable: true });
    await confirmChannel.assertExchange(`${config.paystack_queue}.main`, 'direct', { durable: true });

    await confirmChannel.assertQueue(config.paystack_queue, {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': `${config.paystack_queue}.dlx`,
            'x-dead-letter-routing-key': `retry-${config.paystack_queue}`,
        },
    })

    await channel.bindQueue(config.paystack_queue, `${config.paystack_queue}.main`, config.paystack_queue);

    await channel.assertQueue(`${config.paystack_queue}.retry`, {
        durable: true,
        arguments: {
            'x-message-ttl': 5000,
            'x-dead-letter-exchange': `${config.paystack_queue}.main`,
            'x-dead-letter-routing-key': config.paystack_queue,
        },
    })

    await channel.bindQueue(`${config.paystack_queue}.retry`, `${config.paystack_queue}.dlx`, `retry-${config.paystack_queue}`);

    await channel.assertQueue(`${config.paystack_queue}.dlq`, { durable: true });
    await channel.bindQueue(`${config.paystack_queue}.dlq`, `${config.paystack_queue}.dlx`, 'dlq');

    console.log("paystack rabbitmq started");

    return confirmChannel;
}
export function getChannel() {
    if (!channel) {
        throw new Error("RabbitMQ channel is not initialized");
    }

    return channel;
}