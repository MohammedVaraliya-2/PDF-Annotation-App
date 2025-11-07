import express from "express";
import cors from "cors";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

// Middleware
app.use(cors());
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

let db, gfs;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    gfs = new GridFSBucket(db);
    console.log("Connected to MongoDB");

    // Create collections if they don't exist
    await db.collection("documents").createIndex({ filename: 1 });
    await db.collection("annotations").createIndex({ documentId: 1 });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// Helper function to check RBAC
function checkPermission(userRole, requiredRoles) {
  return requiredRoles.includes(userRole);
}

// ==================== DOCUMENT ROUTES ====================

// Upload documents (Admin only)
app.post("/api/documents/upload", upload.array("files"), async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  // Check admin permission
  if (!checkPermission(userRole, ["admin"])) {
    return res.status(403).json({ error: "Only admins can upload documents" });
  }

  try {
    const documents = [];

    for (const file of req.files) {
      // Store in GridFS
      const uploadStream = gfs.openUploadStream(file.originalname, {
        metadata: {
          uploadedBy: userId,
          uploadDate: new Date(),
          mimeType: file.mimetype,
        },
      });

      uploadStream.end(file.buffer);

      await new Promise((resolve, reject) => {
        uploadStream.on("finish", async () => {
          // Store document metadata
          const doc = {
            _id: uploadStream.id,
            filename: file.originalname,
            uploadedBy: userId,
            uploadDate: new Date(),
            size: file.size,
            mimeType: file.mimetype,
            gridFsId: uploadStream.id,
          };
          await db.collection("documents").insertOne(doc);
          documents.push(doc);
          resolve();
        });
        uploadStream.on("error", reject);
      });
    }

    res.json({ documents });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Get all documents
app.get("/api/documents", async (req, res) => {
  try {
    const documents = await db.collection("documents").find({}).toArray();
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Get document file
app.get("/api/documents/:id", async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const downloadStream = gfs.openDownloadStream(fileId);

    downloadStream.on("error", () => {
      res.status(404).json({ error: "File not found" });
    });

    res.setHeader("Content-Type", "application/pdf");
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Failed to download document" });
  }
});

// ==================== ANNOTATION ROUTES ====================

// Create annotation
app.post("/api/annotations", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const { documentId, type, content, position, visibleTo } = req.body;

  // Check annotation permission
  if (!checkPermission(userRole, ["admin", "default"])) {
    return res
      .status(403)
      .json({ error: "Read-only users cannot create annotations" });
  }

  try {
    const annotation = {
      documentId: new ObjectId(documentId),
      createdBy: userId,
      type,
      content,
      position,
      visibleTo: visibleTo || ["A1", "D1", "D2"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("annotations").insertOne(annotation);
    res.json({ annotation: { ...annotation, _id: result.insertedId } });
  } catch (err) {
    console.error("Annotation creation error:", err);
    res.status(500).json({ error: "Failed to create annotation" });
  }
});

// Get annotations for a document
app.get("/api/annotations/:documentId", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  try {
    const documentId = new ObjectId(req.params.documentId);

    // Filter annotations based on user role and visibility
    const query = {
      documentId: documentId,
      $or: [
        { visibleTo: userId },
        { createdBy: userId },
        { visibleTo: { $in: ["A1", "D1", "D2", "R1"] } }, // Visible to all
      ],
    };

    // Read-only users can only see annotations visible to them
    if (userRole === "readonly") {
      query.$or = [{ visibleTo: userId }];
    }

    const annotations = await db
      .collection("annotations")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ annotations });
  } catch (err) {
    console.error("Fetch annotations error:", err);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

// Edit annotation (Admin or owner)
app.put("/api/annotations/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const { content, visibleTo } = req.body;

  try {
    const annotationId = new ObjectId(req.params.id);
    const annotation = await db
      .collection("annotations")
      .findOne({ _id: annotationId });

    if (!annotation) {
      return res.status(404).json({ error: "Annotation not found" });
    }

    // Check permission
    const isOwner = annotation.createdBy === userId;
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Cannot edit this annotation" });
    }

    const updated = {
      ...annotation,
      content: content || annotation.content,
      visibleTo: visibleTo || annotation.visibleTo,
      updatedAt: new Date(),
    };

    await db
      .collection("annotations")
      .updateOne({ _id: annotationId }, { $set: updated });

    res.json({ annotation: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update annotation" });
  }
});

// Delete annotation (Admin or owner)
app.delete("/api/annotations/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  try {
    const annotationId = new ObjectId(req.params.id);
    const annotation = await db
      .collection("annotations")
      .findOne({ _id: annotationId });

    if (!annotation) {
      return res.status(404).json({ error: "Annotation not found" });
    }

    // Check permission
    const isOwner = annotation.createdBy === userId;
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Cannot delete this annotation" });
    }

    await db.collection("annotations").deleteOne({ _id: annotationId });
    res.json({ message: "Annotation deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete annotation" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
