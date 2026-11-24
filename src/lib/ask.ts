import * as amqp from "amqplib";
import { randomUUID } from "crypto";
import { config } from "../config/config";

// "Ask the queue a question and wait for the answer"
export async function ask(payload: object): Promise<any> {
    const conn = await amqp.connect(config.rabbitUrl);
    const channel = await conn.createConfirmChannel();

    // Make a private mailbox just for this one question
    const mailbox = await channel.assertQueue("", { exclusive: true });

    return new Promise((resolve) => {
        // Listen on the mailbox
        channel.consume(mailbox.queue, (msg) => {
            if (!msg) return;
            channel.ack(msg);
            channel.close();
            conn.close();
            resolve(JSON.parse(msg.content.toString()));
        }, { noAck: false });

        // Send the question
        channel.sendToQueue(config.paystack_queue, Buffer.from(JSON.stringify(payload)), {
            replyTo: mailbox.queue,       // "answer here"
            correlationId: randomUUID(),  // "this is question #X"
        });

        // Give up after 30 seconds
        setTimeout(() => {
            channel.close();
            conn.close();
            resolve({ success: false, error: "Timeout" });
        }, 30000);
    });
}