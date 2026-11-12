import { Router } from "express"
import AuthController from "../Auth/Cllient/Controller/Controller";

const AuthRoute = Router();

const authController = new AuthController();

AuthRoute.post("/signup", authController.signUp);

export { AuthRoute };