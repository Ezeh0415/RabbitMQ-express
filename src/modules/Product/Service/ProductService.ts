import { EmailRabbitService } from "../../Email/RabbitMq/RabbitMqService";


class productService {
    
    constructor(private readonly rabbit: EmailRabbitService) {
        
    }

    async createProduct(message: object) {
        console.log(message);
        // Inside the try in startConsumer:
        
        // const err = new Error('simulated database failure');
        // err.name = 'MongoNetworkError';
        // throw err;
        
        // pass the email message
        this.rabbit.publish(message);

        return message;


    }

}
export default productService;