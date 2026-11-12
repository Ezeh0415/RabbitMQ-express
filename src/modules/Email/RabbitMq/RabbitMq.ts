import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { config } from "../../../config/config";


let connection: ChannelModel | undefined;
let channel: ConfirmChannel | undefined;

export async function connectRabbitMQEmail() {
    connection = await amqp.connect(
        config.rabbitUrl
    );

    const confirmChannel = await connection.createConfirmChannel();
    channel = confirmChannel;

    await confirmChannel.assertExchange('email-express.dlx', 'direct', { durable: true });
    await confirmChannel.assertExchange('email-express.main', 'direct', { durable: true });

    await confirmChannel.assertQueue(config.emailQueue, {
        durable: true,
        deadLetterExchange: 'email-express.dlx',
        deadLetterRoutingKey: 'email-retry-express',
    });

    await channel.bindQueue(config.emailQueue, 'email-express.main', config.emailQueue);

    await channel.assertQueue('email-express.retry', {
        durable: true,
        messageTtl: 5000,
        deadLetterExchange: 'email-express.main',
        deadLetterRoutingKey: config.emailQueue,
    });
    await channel.bindQueue('email-express.retry', 'email-express.dlx', 'email-retry-express');

    await channel.assertQueue('email-express.dlq', { durable: true });
    await channel.bindQueue('email-express.dlq', 'email-express.dlx', 'dlq');

    console.log("Email RabbitMQ started");

    return confirmChannel;
}

export function getEmailChannel() {
    if (!channel) {
        throw new Error("RabbitMQ channel is not initialized");
    }

    return channel;
}