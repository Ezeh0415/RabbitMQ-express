import express from "express";
import { ProductRoute } from "./Product";
import { AuthRoute } from "./Auth";
import { emailRouter } from "./Email";
import { PaymentRouter } from "./Payment";
const router = express.Router();


const defaultRoutes = [
    {
        path: "/auth",
        route: AuthRoute,
    },
    {
        path: "/product",
        route: ProductRoute,
    },
    {
        path: "/paystack",
        route: PaymentRouter,
    },
    {
        path: "/email-cron",
        route: emailRouter,
    }
]

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

export default router;