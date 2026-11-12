import { eq } from "drizzle-orm";
import { db } from "../../../../drizzle/postgresql-db";
import { AppError } from "../../../utilis/AppError";
import { ISignup } from "../../../utilis/Interface";
import userTable from "../Model/UserSchema";
import outPutSchema from "../Model/OutputSchema";
import bcrypt from "bcryptjs";
import { userTemplate } from "../../../Email/Templates";

class clientAuthService {
    private user: typeof userTable;
    private Email: typeof outPutSchema;
    private readonly saltRounds: number = 10;

    constructor() {
        this.user = userTable;
        this.Email = outPutSchema;
    }

    async signUp(payload: ISignup): Promise<object> {

        try {
            const { name, email, password } = payload;

            if (!name || !email || !password) {
                throw new Error("Name, email and password are required");
            }

            const existingUser = await db
                .select({ id: this.user.id })
                .from(this.user)
                .where(eq(this.user.email, email))
                .limit(1);

            if (existingUser.length > 0) {
                throw new Error("User with this email already exists")
            }

            const hashPassword = await bcrypt.hash(password as string, this.saltRounds);

            const [newUser] = await db
            .insert(this.user)
            .values({
                name,
                email,
                password: hashPassword,
                role:"staff"
            })
            .returning();

            const html = await userTemplate()

            await db
            .insert(this.Email)
            .values({
                emailId: globalThis.crypto.randomUUID(),
                email: email,
                subject: "welcome to my new site",
                emailBody: html
            });


            return newUser;

        } catch (error) {
            const err = error as Error;
            throw new AppError(err)
        }

    }
}

export default clientAuthService;