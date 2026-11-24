import express ,{ Router } from "express"
import AuthController from "../Auth/Cllient/Controller/Controller";

const AuthRoute = Router();
AuthRoute.use(express.json());
AuthRoute.use(express.urlencoded({ extended: true }));

const authController = new AuthController();

AuthRoute.post("/signup", authController.signUp);

export { AuthRoute };