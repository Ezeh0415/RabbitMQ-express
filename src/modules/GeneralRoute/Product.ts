import express, { Router } from "express";
import productController from "../Product/Controller/ProductController";
import { RabbitService } from "../Product/RabbitMq/RabbitMqService";

const ProductRoute = Router();
ProductRoute.use(express.json());
ProductRoute.use(express.urlencoded({ extended: true }));

const rabbit = new RabbitService();

const product = new productController(rabbit)

ProductRoute.post("/create", product.createProduct);



export { ProductRoute };