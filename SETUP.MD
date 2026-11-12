// service-a.js (Express)
import express from 'express';
import amqp from 'amqplib';

const app = express();
app.use(express.json());

let channel;

async function connect() {
  const conn = await amqp.connect('amqp://localhost');
  channel = await conn.createChannel();
  await channel.assertQueue('product_queue', { durable: true });
}

app.post('/products', async (req, res) => {
  const product = req.body;

  // This is the "microservice" part: just send the data
  channel.sendToQueue(
    'product_queue',
    Buffer.from(JSON.stringify(product)),
    { persistent: true }
  );

  // Return immediately. Don't wait for Service B.
  res.status(202).json({ message: 'Product queued for processing' });
});

connect().then(() => app.listen(3001));

<!-- sender for rabbit mq -->

// service-b.js (Express)
import express from 'express';
import amqp from 'amqplib';

const app = express();

async function startConsumer() {
  const conn = await amqp.connect('amqp://localhost');
  const channel = await conn.createChannel();

  // Must match the producer's queue name exactly
  await channel.assertQueue('product_queue', { durable: true });

  console.log('Waiting for messages...');

  channel.consume('product_queue', async (msg) => {
    if (!msg) return;

    try {
      const product = JSON.parse(msg.content.toString());
      console.log('Received product:', product);

      // Do the actual work here (save to DB, etc.)
      // await saveToDatabase(product);

      // Tell RabbitMQ we're done
      channel.ack(msg);
    } catch (error) {
      console.error('Processing failed:', error);
      // Reject and don't requeue (or send to DLQ)
      channel.nack(msg, false, false);
    }
  });
}

startConsumer();
app.listen(3002); // Optional: B can still have its own HTTP API
<!-- reciver for rabbitmq -->


Retry logic lives on the consumer side, never the producer. The producer's only job is "put message in queue, return." It doesn't know or care if processing fails.