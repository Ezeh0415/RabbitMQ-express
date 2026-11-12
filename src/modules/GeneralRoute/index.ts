import express from "express";
import { ProductRoute } from "./Product";
import { AuthRoute } from "./Auth";
const router = express.Router();


const defaultRoutes = [
    {
        path: "/auth",
        route: AuthRoute,
    },
    {
        path: "/product",
        route: ProductRoute,
    }
]

defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});

export default router;