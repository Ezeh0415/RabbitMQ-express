// import { config } from "../config/config";

// // lib/rabbitRpc.js
// const amqp = require('amqplib');
// const { randomUUID } = require('crypto');
// const { fail } = require('./response');

// interface PendingEntry {
//   resolve: (response: RpcResponse) => void;
//   timer: ReturnType<typeof setTimeout>;
// }

// interface RpcResponse {
//   success: boolean;
//   data?: unknown;
//   error?: string;
// }

// interface RabbitRpcProperties {
//   correlationId: string;
// }

// interface RabbitRpcMessage {
//   properties: RabbitRpcProperties;
//   content: Buffer;
// }

// interface SendToQueueOptions {
//   correlationId: string;
//   replyTo: string;
//   contentType: string;
//   persistent: boolean;
// }

// interface RabbitChannel {
//   assertQueue(queue: string, options: { durable: boolean; autoDelete: boolean }): Promise<unknown>;
//   consume(queue: string, handler: (msg: RabbitRpcMessage | null) => void, options: { noAck: boolean }): unknown;
//   sendToQueue(queue: string, content: Buffer, options: SendToQueueOptions): unknown;
// }

// interface RabbitConnection {
//   createChannel(): Promise<RabbitChannel>;
// }

// let connection: RabbitConnection;
// let channel: RabbitChannel;
// const pending: Map<string, PendingEntry> = new Map(); // correlationId -> { resolve, timer }
// const REPLY_QUEUE: string = 'rpc_reply_queue'; // shared reply queue

// async function init(url: string = config.rabbitUrl): Promise<void> {
//   connection = await amqp.connect(url);
//   channel = await connection.createChannel();

//   // Declare ONE shared reply queue for all RPC calls
//   await channel.assertQueue(REPLY_QUEUE, { durable: false, autoDelete: true });

//   channel.consume(REPLY_QUEUE, (msg: RabbitRpcMessage | null) => {
//     if (!msg) return;
//     const corrId = msg.properties.correlationId;
//     const entry = pending.get(corrId);
//     if (!entry) return;

//     clearTimeout(entry.timer);
//     pending.delete(corrId);

//     try {
//       const response: RpcResponse = JSON.parse(msg.content.toString());
//       entry.resolve(response);
//     } catch (e) {
//       entry.resolve(fail('Invalid response payload'));
//     }
//   }, { noAck: true });
// }

// /**
//  * Generic reusable call.
//  * @param {string} queueName  - target service queue
//  * @param {object} payload    - request body
//  * @param {number} timeoutMs  - default 30s
//  * @returns {Promise<{success:boolean,data?:any,error?:string}>}
//  */
// function call(queueName: string, payload: object, timeoutMs: number = 30000): Promise<RpcResponse> {
//   return new Promise<RpcResponse>((resolve) => {
//     const correlationId: string = randomUUID();

//     const timer = setTimeout(() => {
//       pending.delete(correlationId);
//       resolve(fail(`Timeout calling ${queueName}`));
//     }, timeoutMs);

//     pending.set(correlationId, { resolve, timer });

//     channel.sendToQueue(
//       queueName,
//       Buffer.from(JSON.stringify(payload)),
//       {
//         correlationId,
//         replyTo: REPLY_QUEUE,
//         contentType: 'application/json',
//         persistent: false,
//       }
//     );
//   });
// }

// module.exports = { init, call };

import { randomUUID } from "crypto";
import { getChannel } from "../modules/PaymentPaystack/RabbitMQ/RabbitConnection";

type RpcResponse<T> = { success: boolean; data?: T; error?: string };

// One mailbox queue for this whole process.
const REPLY_QUEUE = "rpc_replies";

// Whenever an answer comes back, this map holds the waiting promise.
const waiting = new Map<string, {
    resolve: (r: RpcResponse<any>) => void;
    timer: NodeJS.Timeout;
}>();

// This runs ONCE. It sets up the mailbox and starts listening.
let setupDone: Promise<void> | null = null;

function setupMailbox(): Promise<void> {
    if (setupDone) return setupDone;

    setupDone = (async () => {
        const channel = getChannel();

        // Create the mailbox queue if it doesn't exist.
        await channel.assertQueue(REPLY_QUEUE, {
            durable: false,
            autoDelete: true,
        });

        // Start listening for answers.
        await channel.consume(REPLY_QUEUE, (msg) => {
            if (!msg) return;

            const id = msg.properties.correlationId;
            const entry = waiting.get(id);
            if (!entry) return;   // late answer, nobody waiting — ignore

            clearTimeout(entry.timer);
            waiting.delete(id);

            try {
                entry.resolve(JSON.parse(msg.content.toString()));
            } catch {
                entry.resolve({ success: false, error: "Bad response" });
            }
        }, { noAck: true });
    })();

    return setupDone;
}

// Call a queue and wait for the answer.
export async function rpcCall<T>(
    queue: string,
    payload: object,
    timeoutMs = 30_000
): Promise<RpcResponse<T>> {
    try {
        await setupMailbox();
    } catch (e: any) {
        return { success: false, error: `Cannot connect: ${e.message}` };
    }

    const channel = getChannel();
    const correlationId = randomUUID();   // unique ID for this one call

    return new Promise((resolve) => {
        // If no answer arrives in time, give up.
        const timer = setTimeout(() => {
            waiting.delete(correlationId);
            resolve({ success: false, error: "Timeout — no answer" });
        }, timeoutMs);

        waiting.set(correlationId, { resolve, timer });

        // Send the message. replyTo + correlationId tell the consumer
        // where to answer and how to identify this request.
        channel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(payload)),
            {
                correlationId,
                replyTo: REPLY_QUEUE,
                contentType: "application/json",
            }
        );
    });
}