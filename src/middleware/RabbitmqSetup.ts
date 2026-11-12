import { connectRabbitMQEmail } from "../modules/Email/RabbitMq/RabbitMq";
import { EmailRabbitService } from "../modules/Email/RabbitMq/RabbitMqService";
import { connectRabbitMQ } from "../modules/Product/RabbitMq/RabbitMq";
import { RabbitService } from "../modules/Product/RabbitMq/RabbitMqService";

class rabbitmq {
    constructor(private readonly rabbit: RabbitService, private readonly emailRabbit: EmailRabbitService) {

    }

    async productMQ() {
        try {
            await connectRabbitMQ()
            await this.rabbit.startConsumer();
        } catch (error) {
            const err = error as Error;
            console.error("product rabbitMq failed to start", err);
            throw new Error(`product rabbitMq failed to start ${err}`);

        }
    }

    async EmailMQ() {
        try {
            await connectRabbitMQEmail();
            await this.emailRabbit.startEmailConsumer();
        } catch (error) {
            const err = error as Error;
            console.error("Email rabbitMq failed to start", err);
            throw new Error(`Email rabbitMq failed to start ${err}`);
        }
    }
}

export function RabbitMQStart() {
    const emailRabbitMq = new RabbitService();
    const productRabbitMq = new EmailRabbitService()
    const RabbitMQ = new rabbitmq(emailRabbitMq, productRabbitMq);

    RabbitMQ.EmailMQ();
    RabbitMQ.productMQ();
}