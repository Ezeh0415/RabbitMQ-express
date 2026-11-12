import { Router } from "express";
import productController from "../Product/Controller/ProductController";
import { RabbitService } from "../Product/RabbitMq/RabbitMqService";

const ProductRoute = Router();

const rabbit = new RabbitService();

const product = new productController(rabbit)

ProductRoute.post("/create", product.createProduct);



export { ProductRoute };