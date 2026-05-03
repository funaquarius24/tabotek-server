import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI;
let client;
let clientPromise;
if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local');
}
const options = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 20000,
};
if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
}
else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}
export async function connectToDatabase() {
    try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB);
        return { client, db };
    }
    catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        throw error;
    }
}
export { clientPromise };
