import express, { Router, raw } from "express";
import { controller } from "../PaymentPaystack/Controller/Controller";

const PaymentRouter = Router();

const paymentContr = new controller();

PaymentRouter.post("/send", express.json(), paymentContr.initializeTransaction);
PaymentRouter.post("/webhook", raw({ type: 'application/json' }), paymentContr.webhook);

export { PaymentRouter };