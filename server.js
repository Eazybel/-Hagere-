require("dotenv").config(); // 1. Must be at the very top!
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("firebase-admin");
const { cert } = require("firebase-admin/app");
const { cloudinary, upload } = require("./utils/cloudinary");

// 2. Safely initialize Firebase (prevents crashing if env var is missing during build)
if (!admin.apps.length && process.env.SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (err) {
    console.error("Firebase initialization error:", err);
  }
}

// CONTROLLER ROUTES
const { userController, userFetch } = require("./controller/userController");
const { policyUpdate, policyFetch } = require("./controller/policyController");
const feedBack = require("./controller/feedBackController");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

// 3. Updated CORS policy to allow your Vercel domain
const corsConfig = {
  origin: ["http://127.0.0.1:3000", "https://hagere-pi.vercel.app"],
  optionsSuccessStatus: 200
};
app.use(cors(corsConfig));

// 4. Serverless-friendly Database Connection handler
const connectionString = process.env.CONNECTION_STRING;
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (connectionString) {
    try {
      await mongoose.connect(connectionString);
      console.log("Database Connection started");
    } catch (err) {
      console.error("Database connection error:", err);
    }
  }
}

// Connect to DB on incoming requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ROUTES
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "/admin.html"));
});

app.post("/policyUpdate", upload.single("file"), policyUpdate);
app.post("/newUserRegister", userController);
app.post("/policyFetch", policyFetch);
app.post("/userFetch", userFetch);
app.post("/feedBack", feedBack);

// 5. Local listening vs Vercel handling
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// 6. CRITICAL FOR VERCEL: Export the app handler
module.exports = app;