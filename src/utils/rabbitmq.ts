import amqp, { Connection } from 'amqplib';


let connection: Connection | null = null;
let channel: amqp.Channel | null = null;

export const connectRabbitMQ = async (): Promise<void> => {
    try {
        if (connection && channel) {
            console.log('Already connected to RabbitMQ.');
            return;
        }
        // @ts-expect-error
        connection = await amqp.connect(process.RABBITMQ_URL);
        // @ts-expect-error
        channel = await connection.createChannel();
        console.log('Connected to RabbitMQ successfully!');
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
        throw error;
    }
}

export const getChannel = (): amqp.Channel => {
    if (!channel) {
        throw new Error('RabbitMQ channel is not initialized');
    }
    return channel;
}