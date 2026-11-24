import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const configSchema = z.object({
  PORT: z.coerce.number().default(7000),
  DATABASE_URL: z.string(),
  rabbitUrl: z.string(),
  queue: z.string(),
  emailQueue: z.string(),
  REDIS_URL: z.string(),
  PAYSTACK_SECRET_KEY: z.string(),
  PAYSTACK_PUBLIC_KEY: z.string(),
  BASEURL: z.string(),
  paystack_queue:z.string()
});

const config = configSchema.parse(process.env);
export { config };