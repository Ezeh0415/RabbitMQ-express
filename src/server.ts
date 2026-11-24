import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import { connectRabbitMQ } from "./modules/Email/RabbitMq/RabbitMq";
// import { RabbitService } from "./modules/Email/RabbitMq/RabbitMqService";
import router from "./modules/GeneralRoute";
import { RabbitMQStart } from "./middleware/RabbitmqSetup";
import { connectRedis } from "./middleware/redis-client";
import { connectDB } from "./drizzle/postgresql-db";
const jsonParser = express.json();
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

  
  //   app.use((req, res, next) => {
//   // Skip webhook paths and let the raw parser in the route handle it
//   if (req.path === '/api/v1/paystack/webhook') {
  //     return next();
  //   }
  //   jsonParser(req, res, next);
  // });
  
  app.use("/api/v1", router);
  // Body Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.listen(process.env.PORT || 3000, () => {
    // connectDB();
    console.log(`Server is running on port ${process.env.PORT || 7000}`);
  });

}


main();