import { MongoClient } from "mongodb";

const uri = "mongodb://localhost:27017/bookstore";
let dbConnection: object;

function connectDB() {
    return MongoClient.connect(uri)
        .then((client:any) => {
            dbConnection = client.db();
            console.log("Connected to MongoDB");
        })
        .catch((error:Error) => {
            console.error("Error connecting to MongoDB:", error);
            throw error;
        });
}

function getDB() {
    if (!dbConnection) {
        throw new Error("Database not connected. Call connectDB() first.");
    }
    return dbConnection;
}

export {
    connectDB,
    getDB
};