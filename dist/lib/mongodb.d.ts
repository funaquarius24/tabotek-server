import { MongoClient } from 'mongodb';
declare let clientPromise: Promise<MongoClient>;
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}
export declare function connectToDatabase(): Promise<{
    client: MongoClient;
    db: import("mongodb").Db;
}>;
export { clientPromise };
