import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import { connectRabbitMQ } from "./modules/Email/RabbitMq/RabbitMq";
// import { RabbitService } from "./modules/Email/RabbitMq/RabbitMqService";
import router from "./modules/GeneralRoute";
import { RabbitMQStart } from "./middleware/RabbitmqSetup";
import { connectRedis } from "./middleware/redis-client";
import { connectDB } from "./drizzle/postgresql-db";

dotenv.config();

async function main() {
  const app = express();
  await connectRedis();
  await connectDB();
  await RabbitMQStart();

  app.use(
    cors({
      origin: "*", // Allow all origins
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"], // Allowed HTTP methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
      credentials: false, // Disable credentials for CORS
    }),
  );
  app.use(express.json());

  // Body Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1", router);

  app.listen(process.env.PORT || 3000, () => {
    // connectDB();
    console.log(`Server is running on port ${process.env.PORT || 7000}`);
  });

}


main();