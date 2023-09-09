import { MongoClient } from "mongodb";

const mongoUrl = process.env.MONGO_URL || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const url = `mongodb://${mongoUrl}:${mongoPort}`;
const client = new MongoClient(url, {
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000
});
const dbName = "sleeper";
try {
  await client.connect();
  await client.db("admin").command({ping: 1});
  console.log("client connected");
} catch (err) {
  console.log(err);
  return;
}

try {
    const db = client.db(dbName);
}
catch(err) {console.log(err)}
