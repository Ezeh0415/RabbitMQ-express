import axios from "axios";
import { db } from "../../../drizzle/postgresql-db";
import { paymentInfo, webHookReturn } from "../interface";
import { config } from "../../../config/config";
import { paystackPayment } from "../Model/paymentSchema";
import { paystackLogs } from "../Model/paymentlog";
import { verifyPaystack } from "../../utilis/verifyPaystack";
import { eq } from "drizzle-orm";

export class paystackService {
    private paystackPayment: typeof paystackPayment;
    private paystackLogs: typeof paystackLogs;
    constructor() {
        this.paystackPayment = paystackPayment;
        this.paystackLogs = paystackLogs;

    }

    private toRawBody(rawBody: unknown): string {
        // 1. Real Buffer (Node)
        if (Buffer.isBuffer(rawBody)) {
            return rawBody.toString("utf8");
        }

        // 2. Serialized Buffer: { type: "Buffer", data: number[] }
        if (
            rawBody &&
            typeof rawBody === "object" &&
            (rawBody as any).type === "Buffer" &&
            Array.isArray((rawBody as any).data)
        ) {
            return Buffer.from((rawBody as any).data).toString("utf8");
        }

        // 3. Plain string
        if (typeof rawBody === "string") {
            return rawBody;
        }

        // 4. Uint8Array / ArrayBuffer
        if (rawBody instanceof Uint8Array) {
            return Buffer.from(rawBody).toString("utf8");
        }
        if (rawBody instanceof ArrayBuffer) {
            return Buffer.from(new Uint8Array(rawBody)).toString("utf8");
        }

        throw new Error(
            `Unsupported rawBody type: ${Object.prototype.toString.call(rawBody)}`
        );
    }

    async initializePayment(payload: paymentInfo): Promise<string> {

        const result = await db.transaction(async (tx) => {

            const amountInKobo = Math.round(payload.amount * 100);

            let response;
            try {
                response = await axios.post(
                    `${config.BASEURL}/transaction/initialize`,
                    {
                        email: payload.email,
                        amount: amountInKobo,
                        reference: payload.paymentReference
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                            "Content-Type": "application/json",
                        },
                    },
                );
            } catch (err: any) {
                console.error('Paystack request failed');
                console.error('status:', err.response?.status);
                console.error('data:', JSON.stringify(err.response?.data));
                console.error('message:', err.message);
                throw err; // re-throw so your existing retry/DLQ handling still runs
            }

            const authorizationUrl = response.data?.data?.authorization_url;
            const accessCode = response.data?.data?.access_code;
            const reference = response.data?.data?.reference;

            if (!authorizationUrl) {
                console.log("Paystack did not return an authorization URL");
                throw new Error("Paystack did not return an authorization URL")
            }

            const [payment] = await tx
                .insert(this.paystackPayment)
                .values({
                    paymentReference: reference,
                    accessCode: accessCode,
                    authorizationCode: authorizationUrl,
                    amount: amountInKobo,
                    amountInNaira: (amountInKobo / 100).toFixed(2),
                    customerEmail: payload.email,
                    status: "pending",
                })
                .returning();

            await tx
                .insert(this.paystackLogs)
                .values({
                    paymentId: payment.id,
                    reference: reference,
                    event: "payment initialize",
                    status: "pending"
                })

            return response.data?.data;
        });

        return result;
    }

    async webhook(payload: webHookReturn) {
        const { type, rawBody, signature } = payload;

        // rawBody may arrive as Buffer/string depending on the framework.
        const body = this.toRawBody(rawBody);

        if (!signature || typeof signature !== "string") {
            throw new Error("Missing Paystack signature header");
        }

        // Verify BEFORE parsing — the HMAC must be computed over the exact raw bytes.
        if (!verifyPaystack(body, signature, config.PAYSTACK_SECRET_KEY)) {
            console.log("Invalid signature");
            throw new Error("Invalid signature");
        }

        // Parse only after verification passes.
        let event: unknown;
        try {
            event = JSON.parse(body);

            const { event: payStatus, data } = event

            const result = await db.transaction(async (tx) => {
                const [webhookUpdate] = await tx
                    .update(this.paystackPayment)
                    .set({
                        status: data.status,
                        gatewayResponse: data.gateway_response,
                        paidAt: new Date(),
                        ipAddress: data.ip_address,
                        metadata: data,
                        authorizationCode: data.authorization.authorization_code,
                        cardType: data.authorization.card_type,
                        accountName: data.authorization.sender_name,
                        accountNumber: data.sender_bank_account_number,
                        bankName: data.sender_bank,
                        bin: data.authorization.bin,
                        expMonth: data.authorization.exp_month,
                        expYear: data.authorization.exp_year,
                        last4: data.authorization.last4,
                        bank: data.authorization.bank,
                        description: data.authorization.narration,
                        channel: data.channel
                    })
                    .where(eq(this.paystackPayment.paymentReference, data.reference))
                    .returning()

                await tx
                    .insert(this.paystackLogs)
                    .values({
                        paymentId:webhookUpdate.id,
                        reference:data.reference,
                        event:payStatus,
                        status:data.status,
                        ipAddress: data.ip_address,
                    })
            })
        } catch (err) {
            console.error("Malformed JSON in verified webhook body", err);
            throw new Error("Malformed webhook payload");
        }

        console.log(event);
        return event;
    }
}