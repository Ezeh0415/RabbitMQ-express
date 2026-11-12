import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { RabbitService } from "../RabbitMq/RabbitMqService";
export interface IcreateProductM {
    userId: string | ObjectId,
    msguuid: string,
    productName: string,
    productQuantity: number,
};

class productController {
    constructor(private readonly rabbit: RabbitService) {
    }

    createProduct = (req: Request, res: Response) => {
        try {
            const productData: IcreateProductM = {
                userId: crypto.randomUUID(),
                msguuid: req.body.msguuid,
                productName: req.body.productName,
                productQuantity: req.body.productQuantity,
            };

            const message = {
                event: "create product",
                data: productData,
                createdAt: new Date().toISOString
            }

            this.rabbit.publish(message);
            res.status(201).json("product added successfully")
            return;
        } catch (error) {
            const err = error as Error;
            console.error("error creating product", err);
            res.status(404).json("error creating product")
        }
    }
}
export default productController