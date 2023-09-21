import { MongoClient } from "mongodb";
import _ from "lodash";

const mongoUrl = process.env.MONGO_URL || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const url = `mongodb://${mongoUrl}:${mongoPort}`;
const client = new MongoClient(url, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
});
const dbName = "sleeper";
const collectionNames = ["leagues", "rosters", "users", "matchups"];

console.log("\n1. try to connect to mongo instance");
try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("client connected successfully");
} catch (err) {
    console.log(err);
}

console.log("\n2. check database status");
try {
    const db = await client.db("admin");
    const databases = await db.admin().listDatabases();
    const databaseExists = databases.databases.find((val, idx) => {
        return val.name === dbName;
    });
    if (!databaseExists) {
        console.log(
            "WARN: the desired database is not present in the instance."
        );
        console.log("\n2.1. Create database");
        const newDb = await client.db(dbName);
        await newDb.createCollection(collectionNames[0]);
        console.log("the desired database was added.");
    } else {
        console.log("the desired database is present in the instance.");
    }
} catch (err) {
    console.log(err);
}

console.log("\n3. check collections in database");
try {
    const db = await client.db(dbName);
    const collections = await db.listCollections();
    const collectionsPresent = (await collections.toArray()).map((a) => a.name);
    //console.log(_.difference(collectionNames, collectionsPresent))
    const collectionsToCreate = _.difference(
        collectionNames,
        collectionsPresent
    );
    console.log(
        "the following collections need to be created: ",
        collectionsToCreate
    );
	for(let i = 0; i < collectionsToCreate.length; i++) {
		await db.createCollection(collectionsToCreate[i])
	}
} catch (err) {
    console.log(err);
}

console.log("script complete");
client.close();
