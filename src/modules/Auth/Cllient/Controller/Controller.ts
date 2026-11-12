import { Request, Response } from "express";
import { AppError } from "../../../utilis/AppError";
import { signUpDto } from "../ZodValidation";
import clientAuthService from "../Service/Service";

class AuthController {
    private service: clientAuthService
    constructor() {
        this.service = new clientAuthService();
    }

    signUp = async (req: Request, res: Response) => {
        try {
            const validatedInput = signUpDto.parse(req.body);

            const result = await this.service.signUp(validatedInput);

            res.status(201).json({
                success: true,
                ok: true,
                result
            })

        } catch (error) {
            const err = error as Error;
            throw new AppError(err);

        }
    }
}

export default AuthController;