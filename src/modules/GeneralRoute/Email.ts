import { CronJob } from "cron";
import express, { Router } from "express";
import emailContr from "../Email/Controller/Contr";
import { EmailRabbitService } from "../Email/RabbitMq/RabbitMqService";

const emailRouter = Router()
emailRouter.use(express.json());
emailRouter.use(express.urlencoded({ extended: true }));
const rabbit = new EmailRabbitService();

const EmailContr = new emailContr(rabbit);



new CronJob('*/2 * * * * ', () => {
    EmailContr.processEmail();
}, null, true);

export { emailRouter };