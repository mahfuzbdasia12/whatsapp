import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";
import mongoose from "mongoose";
import multer from "multer";
import csv from "csv-parser";
import * as xlsx from "xlsx";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(cors());
app.use(express.json());

// MongoDB Setup
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp_marketing";
mongoose.connect(MONGODB_URI).catch(err => console.error("MongoDB connection error:", err));

const contactSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model("Contact", contactSchema);

// WhatsApp Client Setup
let qrCodeData = "";
let clientStatus = "disconnected"; // disconnected, connecting, qr, ready

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  }
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED");
  qrCodeData = qr;
  clientStatus = "qr";
});

client.on("ready", () => {
  console.log("Client is ready!");
  clientStatus = "ready";
  qrCodeData = "";
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
  clientStatus = "authenticated";
});

client.on("auth_failure", (msg) => {
  console.error("AUTHENTICATION FAILURE", msg);
  clientStatus = "disconnected";
});

client.on("disconnected", (reason) => {
  console.log("Client was logged out", reason);
  clientStatus = "disconnected";
});

client.initialize();

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// API Endpoints
app.get("/api/status", (req, res) => {
  res.json({ status: clientStatus });
});

app.get("/api/qr", async (req, res) => {
  if (clientStatus === "ready") {
    return res.json({ status: "ready" });
  }
  if (!qrCodeData) {
    return res.json({ status: "loading" });
  }
  try {
    const qrImage = await qrcode.toDataURL(qrCodeData);
    res.json({ qr: qrImage, status: "qr" });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

app.post("/api/upload-contacts", upload.single("file"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const contacts: any[] = [];

  try {
    if (req.file.originalname.endsWith(".csv")) {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => {
          const phone = data.phone || data.Phone || data.mobile || data.Mobile;
          const name = data.name || data.Name || "Unknown";
          if (phone) contacts.push({ name, phone: phone.toString().replace(/\D/g, "") });
        })
        .on("end", async () => {
          await saveContacts(contacts, res);
          fs.unlinkSync(filePath);
        });
    } else if (req.file.originalname.endsWith(".xlsx") || req.file.originalname.endsWith(".xls")) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const data: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      data.forEach((row) => {
        const phone = row.phone || row.Phone || row.mobile || row.Mobile;
        const name = row.name || row.Name || "Unknown";
        if (phone) contacts.push({ name, phone: phone.toString().replace(/\D/g, "") });
      });
      await saveContacts(contacts, res);
      fs.unlinkSync(filePath);
    } else {
      res.status(400).json({ error: "Unsupported file format" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to process file" });
  }
});

async function saveContacts(contacts: any[], res: any) {
  let count = 0;
  for (const contact of contacts) {
    try {
      await Contact.findOneAndUpdate(
        { phone: contact.phone },
        contact,
        { upsert: true, new: true }
      );
      count++;
    } catch (e) {}
  }
  res.json({ message: `Successfully uploaded ${count} contacts` });
}

app.post("/api/verify-contacts", async (req, res) => {
  if (clientStatus !== "ready") return res.status(400).json({ error: "WhatsApp not connected" });

  const contacts = await Contact.find({ verified: false });
  res.json({ message: "Verification started in background", count: contacts.length });

  // Background verification
  for (const contact of contacts) {
    try {
      const id = await client.getNumberId(contact.phone);
      if (id) {
        await Contact.findByIdAndUpdate(contact.id, { verified: true });
      } else {
        // Optionally mark as invalid or just leave unverified
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Error verifying ${contact.phone}:`, e);
    }
  }
});

app.get("/api/contacts", async (req, res) => {
  const contacts = await Contact.find();
  res.json(contacts);
});

app.post("/api/send-message", async (req, res) => {
  const { message, phoneNumbers } = req.body;
  if (clientStatus !== "ready") return res.status(400).json({ error: "WhatsApp not connected" });
  if (!message || !phoneNumbers || !Array.isArray(phoneNumbers)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  res.json({ message: "Mailing started" });

  for (const phone of phoneNumbers) {
    try {
      const contact = await Contact.findOne({ phone });
      const personalizedMessage = message.replace(/{name}/g, contact?.name || "Customer");
      
      const numberId = await client.getNumberId(phone);
      if (numberId) {
        await client.sendMessage(numberId._serialized, personalizedMessage);
        console.log(`Message sent to ${phone}`);
      }
      
      // Delay between 5-10 seconds as requested
      const delay = Math.floor(Math.random() * 5000) + 5000;
      await new Promise(r => setTimeout(r, delay));
    } catch (e) {
      console.error(`Failed to send to ${phone}:`, e);
    }
  }
});

app.get("/api/stats", async (req, res) => {
  const total = await Contact.countDocuments();
  const verified = await Contact.countDocuments({ verified: true });
  res.json({ total, verified });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
