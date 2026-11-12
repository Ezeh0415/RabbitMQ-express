# RabbitMQ Express

A learning project that shows how to use **RabbitMQ** (a message broker) inside an **Express + TypeScript** API. It also uses **PostgreSQL** (with Drizzle ORM) and **Redis**, and it can run everything with Docker.

If you are a beginner, read the sections in order. The most important part is "The RabbitMQ folders (start here)".

---

## Table of contents

1. What is this project?
2. What is RabbitMQ? (plain English)
3. Tech stack
4. Project structure
5. The RabbitMQ folders (start here)
6. How a message flows
7. Retry and dead-letter queues
8. Redis: avoiding duplicate processing
9. API endpoints
10. Environment variables
11. Running with Docker
12. Running without Docker
13. Database and Drizzle notes
14. Known quirks in the code

---

## What is this project?

This is a small Express API built to practise RabbitMQ. It has two features:

- **Auth**: a signup route that saves a user in PostgreSQL (the password is hashed with bcrypt).
- **Product**: a create-product route that does **not** save the product directly. It puts a message on a RabbitMQ queue, and a **consumer** inside the same app picks the message up and handles it.

The code follows an MVC-style layout (Controller, Service, Model) with one folder per feature under `src/modules`.

## What is RabbitMQ? (plain English)

Think of RabbitMQ as a post office between parts of your app.

- A **producer** drops a message in a mailbox (a **queue**).
- A **consumer** takes messages out of the queue and does the work.
- The producer does not wait for the work to finish, so your API can answer the user quickly.

Words you will see in the code:

- **Queue**: where messages wait until a consumer takes them.
- **Exchange**: a router. Messages are sent to an exchange, which decides which queue gets them.
- **Binding / routing key**: the rule that connects an exchange to a queue.
- **ack**: the consumer telling RabbitMQ "I finished this message, you can delete it."
- **Dead-letter exchange (DLX)** and **dead-letter queue (DLQ)**: where failed messages go. Explained below.

## Tech stack

- Node.js 22 (the Docker image uses `node:22-alpine`)
- Express 5, TypeScript, run with `tsx` and `nodemon`
- `amqplib` for RabbitMQ
- PostgreSQL with Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`, `postgres`)
- Redis (the `redis` package)
- Zod for validating environment variables and signup input
- `mongodb` and `mongoose` are installed, and there is a file `src/config/Mongodb-db.ts`, but the startup in `src/server.ts` does not use MongoDB.

## Project structure

```
.
├── docker-compose.yml        # api + rabbitmq + redis + postgres
├── Dockerfile                # builds the api image (node:22-alpine, runs npm run dev)
├── .env.docker               # env values used by docker compose
├── drizzle.config.ts         # Drizzle Kit config
├── package.json
├── SETUP.MD                  # small RabbitMQ code notes from the author
└── src
    ├── server.ts             # app entry point
    ├── config
    │   ├── config.ts         # reads and validates env variables with Zod
    │   └── Mongodb-db.ts
    ├── drizzle
    │   ├── index.ts          # schema entry that Drizzle Kit reads
    │   ├── postgresql-db.ts  # Postgres connection (pg Pool + Drizzle)
    │   └── migration.ts
    ├── middleware
    │   ├── RabbitmqSetup.ts  # starts BOTH RabbitMQ setups (RabbitMQ)
    │   └── redis-client.ts   # Redis connection
    └── modules
        ├── Auth/Cllient      # signup: Controller, Service, Model, Zod validation
        ├── Product           # product feature
        │   ├── Controller
        │   ├── Service
        │   └── RabbitMq      # RabbitMQ for products (RabbitMQ)
        ├── Email             # email feature
        │   ├── RabbitMq      # RabbitMQ for emails (RabbitMQ)
        │   ├── service
        │   └── Templates.ts
        ├── GeneralRoute      # Express routers (/auth, /product)
        ├── Enums.ts          # Postgres enums
        └── utilis            # AppError and interfaces
```

Note: the folder is spelled `Cllient` (with three l's) in the repository. That is the real name, so use it when you open files.

## The RabbitMQ folders (start here)

There are three places to learn from.

### 1. `src/modules/Product/RabbitMq/`

- **`RabbitMq.ts`**: connects to RabbitMQ and **sets up** the exchanges and queues for products (see the table below). It also exports `getChannel()` so other files can use the channel.
- **`RabbitMqService.ts`**: the `RabbitService` class.
  - `publish(payload)`: sends a message to the product queue and waits for RabbitMQ to confirm it received it.
  - `startConsumer()`: listens to the product queue. For each message it checks Redis for duplicates, then calls `ProductService.createProduct`. On success it acks the message. On failure it runs the retry/DLQ logic.

### 2. `src/modules/Email/RabbitMq/`

- **`RabbitMq.ts`**: same idea as the product one, but for emails (`connectRabbitMQEmail()` and `getEmailChannel()`).
- **`RabbitMqService.ts`**: the `EmailRabbitService` class with `publish()` and `startEmailConsumer()`. The consumer calls `EmailService.sendProductEmail`, which at the moment only does `console.log(payload)`. No real email is sent yet.

### 3. `src/middleware/RabbitmqSetup.ts`

This is the file that **turns everything on** when the server starts. It runs the email setup and the product setup: connect, create the exchanges and queues, then start the consumer. `src/server.ts` calls it through `RabbitMQStart()`.

### What gets created in RabbitMQ

The queue names come from your env variables `queue` and `emailQueue`. The other names are hard-coded.

| Feature | Main exchange | Dead-letter exchange | Main queue | Retry queue | DLQ |
| --- | --- | --- | --- | --- | --- |
| Product | `rabbit-test-express.main` | `rabbit-test-express.dlx` | value of `queue` | `rabbit-test-express.retry` | `rabbit-test-express.dlq` |
| Email | `email-express.main` | `email-express.dlx` | value of `emailQueue` | `email-express.retry` | `email-express.dlq` |

All exchanges are `direct` and durable, and all queues are durable (they survive a RabbitMQ restart).

## How a message flows

Here is what happens when you call `POST /api/v1/product/create`:

1. The **Express route** (`GeneralRoute/Product.ts`) hands the request to `ProductController.createProduct`.
2. The **controller** builds a message `{ event: "create product", data: { userId, msguuid, productName, productQuantity }, createdAt }` and calls `RabbitService.publish(message)`. It then replies `201` right away with "product added successfully". It does not wait for the consumer.
3. **`publish`** sends the message to the product queue (persistent, JSON) and waits for RabbitMQ to confirm.
4. The **product consumer** (`startConsumer`) receives the message and reads `data.msguuid`.
   - No `msguuid`: the message is acked and skipped.
   - It checks Redis (see below). If this ID was already processed, it acks and skips.
5. If it is new, the consumer calls **`ProductService.createProduct`**, which logs the message and hands it to the **email** side through `EmailRabbitService.publish`.
6. The consumer calls `ack` so RabbitMQ removes the message.
7. The **email consumer** receives the email message and calls `EmailService.sendProductEmail` (currently it only logs).

So the chain is: **HTTP request, product queue, product consumer, email queue, email consumer.** (See "Known quirks" about the email publish step.)

## Retry and dead-letter queues

If a consumer throws an error, `ackErrorwatch` decides what to do:

- **Transient errors** are errors named `MongoNetworkError`, `MongoServerSelectionError` or `MongoNotConnectedError`. If the retry count (from the `x-death` header) is under 5, the message is published to the dead-letter exchange with the retry routing key. It lands in the **retry queue**, waits **5 seconds** (`messageTtl: 5000`), and is then sent back to the main queue to try again.
- **Anything else**, or too many retries, goes to the **DLQ** (dead-letter queue). Messages there are kept so you can inspect them. Nothing reads from the DLQ automatically.

You can watch the queues in the RabbitMQ management page (see the Docker section).

## Redis: avoiding duplicate processing

RabbitMQ can deliver the same message more than once. The product consumer protects against that with Redis:

- It runs `SET processed:<msguuid> 1 NX EX 86400`. `NX` means "only set if the key does not exist" and `EX 86400` means the key expires after 24 hours.
- If the key already existed, the message is a duplicate and is skipped.
- If processing fails, the key is deleted so the message can be tried again.

This means the client should send a unique `msguuid` in the request body for each product.

## API endpoints

All routes are under `/api/v1`.

- `POST /api/v1/auth/signup` with JSON body `{ "name": "...", "email": "...", "password": "..." }`. The password must be at least 6 characters. The user is saved in Postgres with the role `staff`.
- `POST /api/v1/product/create` with JSON body `{ "msguuid": "unique-id-1", "productName": "Shoes", "productQuantity": 3 }`. Publishes a message to RabbitMQ.

Example:

```bash
curl -X POST http://localhost:7000/api/v1/product/create \
  -H "Content-Type: application/json" \
  -d '{"msguuid":"abc-123","productName":"Shoes","productQuantity":3}'
```

Send it twice with the same `msguuid` and watch the logs: the second one is skipped.

## Environment variables

`src/config/config.ts` validates these with Zod, and the app crashes on startup if one is missing:

| Variable | What it is |
| --- | --- |
| `PORT` | Port for the API. Defaults to 7000 in the config. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `rabbitUrl` | RabbitMQ URL, for example `amqp://localhost:5672`. Note the lowercase name. |
| `queue` | Name of the product queue. |
| `emailQueue` | Name of the email queue. |
| `REDIS_URL` | Redis URL, for example `redis://localhost:6379`. |

`.env` is in `.gitignore`, so create your own file locally and never commit real secrets. There is no `.env.example` in this repository. The file `.env.docker` is what Docker Compose uses. It defines `DATABASE_URL`, `rabbitUrl` and `REDIS_URL` (pointing at the Docker service names `postgres`, `rabbitmq` and `redis`). It does not define `queue` or `emailQueue`, so you must add those yourself, otherwise the config validation will fail.

Example local `.env` (use your own values):

```
PORT=7000
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/app_db
rabbitUrl=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
queue=product_queue
emailQueue=email_queue
```

## Running with Docker

`docker-compose.yml` starts four services:

- `api`: this app, on port **7000**. It waits for RabbitMQ to be healthy before starting.
- `rabbitmq`: image `rabbitmq:3-management-alpine`. AMQP on **5672**, management UI on **15672**.
- `redis`: `redis:7-alpine` on **6379**.
- `postgres`: `postgres:16-alpine` on **5432**, database `app_db`, data kept in the `postgres_data` volume.

Steps:

1. Install Docker.
2. Make sure `.env.docker` contains `queue` and `emailQueue` (see above) and that the Postgres credentials match what the `postgres` service uses in `docker-compose.yml`.
3. Start everything:
   ```bash
   docker compose up --build
   ```
4. Open the RabbitMQ management page at http://localhost:15672 to see your exchanges and queues. The compose file does not set a custom RabbitMQ user, so check the official RabbitMQ image docs for the default login.
5. Create the database tables (see the Database section), then call the API.

Stop with `Ctrl + C`, or `docker compose down`. Add `-v` to also delete the Postgres data.

## Running without Docker

1. Install Node.js, and run PostgreSQL, RabbitMQ and Redis yourself (or start only those three with `docker compose up rabbitmq redis postgres`).
2. Create a `.env` file in the project root (see above).
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
   `npm run dev` runs `nodemon --exec tsx src/server.ts`.

On startup the server connects to Redis, then Postgres, then RabbitMQ, then starts Express.

## Database and Drizzle notes

- Schemas live in the Auth `Model` folder (`UserSchema.ts`, `OutputSchema.ts`) and in `src/modules/Enums.ts`. `drizzle.config.ts` reads `./src/drizzle/index.ts` and writes migrations to `./src/drizzle/migrations`. That folder is in `.gitignore`.
- **Be careful with `npm run db:push`.** Despite its name it does **not** run `drizzle-kit push`. The script is:
  ```json
  "db:push": "npx drizzle-kit generate && npx drizzle-kit migrate"
  ```
  That means it first generates SQL migration files from your schema, then applies pending migrations. Real `drizzle-kit push` compares your schema to the live database directly and does not create migration files.
- **"0 tables" problem.** `src/drizzle/index.ts` uses `export * from ...`, and `export *` does not re-export **default** exports. The table files (`UserSchema.ts` and `OutputSchema.ts`) use default exports, so Drizzle Kit only sees the enums. To fix it, give the tables named exports (for example `export const userTable = pgTable(...)`) or re-export them by name in `index.ts`. If you change them, update the files that import them as defaults (for example `Service.ts`).
- **Duplicate enum errors.** If the enums already exist in the database, `migrate` can fail trying to create them again. Start from a clean database, or fix the migration state, before re-running.
- `src/drizzle/postgresql-db.ts` has its SSL options commented out and tries to read `./ca.pem`. That is fine locally. Review it before using a hosted database.

## Known quirks in the code

These are things a beginner may trip over. They describe the code as it is today.

- `RabbitMQStart()` in `RabbitmqSetup.ts` starts the two setups without returning or awaiting them, so `await RabbitMQStart()` in `server.ts` does not actually wait for them to finish.
- The Email `publish()` calls `channel.emit(...)`, which is Node's event-emitter method, not an amqplib publish call (the product one uses `sendToQueue`). If emails never reach the email queue, start looking here.
- In `ProductController`, `createdAt: new Date().toISOString` is missing the `()`, so it holds the function instead of a date string.
- The retry logic only treats MongoDB-named errors as transient, even though products are not saved in MongoDB in this project.
- `src/server.ts` listens on `process.env.PORT || 3000`, but the log message says 7000. Set `PORT` explicitly (Docker publishes port 7000).
- `SETUP.MD` and some comments in the RabbitMQ files are the author's learning notes.

## License

ISC.
