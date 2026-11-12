import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { config } from "../../../config/config";


let connection: ChannelModel | undefined;
let channel: ConfirmChannel | undefined;

export async function connectRabbitMQ() {
    connection = await amqp.connect(
        config.rabbitUrl
    );

    const confirmChannel = await connection.createConfirmChannel();
    channel = confirmChannel;

    await confirmChannel.assertExchange('rabbit-test-express.dlx', 'direct', { durable: true });
    await confirmChannel.assertExchange('rabbit-test-express.main', 'direct', { durable: true });

    await confirmChannel.assertQueue(config.queue, {
        durable: true,
        deadLetterExchange: 'rabbit-test-express.dlx',
        deadLetterRoutingKey: 'retry-express',
    });

    await channel.bindQueue(config.queue, 'rabbit-test-express.main', config.queue);

    await channel.assertQueue('rabbit-test-express.retry', {
        durable: true,
        messageTtl: 5000,
        deadLetterExchange: 'rabbit-test-express.main',
        deadLetterRoutingKey: config.queue,
    });
    await channel.bindQueue('rabbit-test-express.retry', 'rabbit-test-express.dlx', 'retry-express');

    await channel.assertQueue('rabbit-test-express.dlq', { durable: true });
    await channel.bindQueue('rabbit-test-express.dlq', 'rabbit-test-express.dlx', 'dlq');

    console.log("product RabbitMQ started");

    return confirmChannel;
}

export function getChannel() {
    if (!channel) {
        throw new Error("RabbitMQ channel is not initialized");
    }

    return channel;
}