import { createClient } from "redis";

// Create a Redis client
export const client = createClient({
  url: process.env.REDIS_URL, // Default connection string
});

// Handle connection events
client.on("connect", () => {
  console.log("✅ Connected to Redis successfully!");
});

client.on("error", (error: Error) => {
  const err = error as Error;
  console.error("❌ Redis Client Error:", err);
});

// Connect to Redis
export async function connectRedis() {
  await client.connect();
}


