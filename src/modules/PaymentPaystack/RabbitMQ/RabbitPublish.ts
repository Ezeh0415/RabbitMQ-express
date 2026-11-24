// import { config } from "../../../config/config";
// import * as amqp from 'amqplib';
// import { randomUUID } from 'crypto';
// export class PaystackPublish {
//     constructor() {

//     }

//     private channel!: amqp.Channel;

//     private async connect(): Promise<void> {
//         const conn = await amqp.connect(config.rabbitUrl);
//         this.channel = await conn.createConfirmChannel();
//         await this.channel.assertQueue(config.paystack_queue, {
//             durable: true,
//             arguments: {
//                 'x-dead-letter-exchange': `${config.paystack_queue}.dlx`,
//                 'x-dead-letter-routing-key': `retry-${config.paystack_queue}`,
//             },
//         });
//     }

//     public async init(): Promise<void> {
//         console.log("paystack publish loading ....")
//         await this.connect();
//         console.log("paystack publish started")
//     }

//     async publish(payload: object): Promise<void> {
//         if (!this.channel) {
//             await this.init();               // lazy reconnect
//         }

//         const messageId = randomUUID();

//         const ok = this.channel.sendToQueue(
//             config.paystack_queue,
//             Buffer.from(JSON.stringify(payload)),
//             {
//                 persistent: true,
//                 contentType: 'application/json',
//                 messageId,
//             },
//         );

//         if (!ok) {
//             await new Promise<void>(resolve => this.channel.once('drain', resolve));
//         }

//         // await this.channel.waitForConfirms();
//     }
// }

import * as amqp from "amqplib";
import { randomUUID } from "crypto";
import { config } from "../../../config/config";

// "Ask the queue a question and wait for the answer"
export async function ask(payload: object): Promise<any> {
    const conn = await amqp.connect(config.rabbitUrl);
    const channel = await conn.createConfirmChannel();

    // Make a private mailbox just for this one question
    const mailbox = await channel.assertQueue("", { exclusive: true });

    return new Promise((resolve) => {

        let finished = false;

        const finish = (result: any) => {
            if (finished) return;      //  only finish once
            finished = true;
            clearTimeout(timer);       //  cancel the timeout
            try { channel.close(); } catch { }
            try { conn.close(); } catch { }
            resolve(result);
        };

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
        const timer = setTimeout(() => {
            finish({ success: false, error: "Timeout" });
        }, 30000);
    });
}