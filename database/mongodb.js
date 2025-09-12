const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const Flow = require("../models/Flow");
const FlowData = require("../models/FlowData");
const FlowSession = require("../models/FlowSession");
const FlowResponse = require("../models/FlowResponse");

const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB connection options
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
};

// Initialize MongoDB connection
const initializeDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI, options);
    console.log("✅ MongoDB connected successfully");

    // Create indexes for better performance
    await createIndexes();

    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Create database indexes
const createIndexes = async () => {
  try {
    // Flow indexes
    await Flow.createIndexes();
    await FlowData.createIndexes();
    await FlowSession.createIndexes();
    await FlowResponse.createIndexes();

    console.log("✅ Database indexes created successfully");
  } catch (error) {
    // Ignore index conflicts - they're usually harmless
    if (error.code === 86 || error.codeName === "IndexKeySpecsConflict") {
      console.log("ℹ️  Some indexes already exist (this is normal)");
    } else {
      console.error("❌ Error creating indexes:", error);
    }
  }
};

// Get database connection
const getDatabase = () => {
  return mongoose.connection;
};

// Close database connection
const closeDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
  } catch (error) {
    console.error("❌ Error closing MongoDB connection:", error);
  }
};

// Handle connection events
mongoose.connection.on("connected", () => {
  console.log("📊 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("📊 Mongoose disconnected from MongoDB");
});

// Handle application termination
process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
