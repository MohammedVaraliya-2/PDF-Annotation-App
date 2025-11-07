import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

async function setupDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log("Creating collections...");

    // Create documents collection
    await db.createCollection("documents").catch(() => {});
    await db.collection("documents").createIndex({ filename: 1 });
    await db.collection("documents").createIndex({ uploadedBy: 1 });

    // Create annotations collection
    await db.createCollection("annotations").catch(() => {});
    await db.collection("annotations").createIndex({ documentId: 1 });
    await db.collection("annotations").createIndex({ createdBy: 1 });
    await db.collection("annotations").createIndex({ visibleTo: 1 });

    console.log("Database setup completed successfully!");
    console.log(`Database: ${DB_NAME}`);
    console.log("Collections created: documents, annotations");
  } catch (err) {
    console.error("Setup error:", err);
  } finally {
    await client.close();
  }
}

setupDatabase();
