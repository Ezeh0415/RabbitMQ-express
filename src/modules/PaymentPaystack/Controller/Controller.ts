import { Request, Response } from "express";
import { paymentValidation } from "../zodValidation";
import { paymentInfo, webHookReturn } from "../interface";
import { AppError } from "../../utilis/AppError";
import { config } from "../../../config/config";
import axios from "axios";
import { verifyPaystack } from "../../utilis/verifyPaystack";
import { ask } from "../RabbitMQ/RabbitPublish";
// import { PaystackPublish } from "../RabbitMQ/RabbitPublish";

export class controller {
    // private rabbit: PaystackPublish;
    constructor() {
        // this.rabbit = new PaystackPublish();
    }

    initializeTransaction = async (req: Request, res: Response) => {
        try {

            const validation = paymentValidation.parse(req.body);

            const payload: paymentInfo = {
                type: "initialize",
                paymentReference: validation.paymentReference,
                email: validation.email,
                amount: validation.amount
            }

            const result = await ask(payload);

            return res.json({
                message: "payment initialized",
                result
            });
        } catch (error) {
            const err = error as Error
            throw new AppError(err);
        }

    }

    webhook = async (req: Request, res: Response) => {

        const rawBody = req.body; // Buffer, NOT parsed object
        const signatureHeader = req.headers['x-paystack-signature'];

        const payload: webHookReturn = {
            type: "webhook",
            rawBody,
            signature: Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
        };

        const result = await ask(payload);

        return res.json({
            result
        });
    }
}