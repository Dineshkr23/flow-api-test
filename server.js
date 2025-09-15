const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = ["MONGODB_URI"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  console.error("❌ Please check your .env file or environment configuration.");
  process.exit(1);
}

const flowRoutes = require("./routes/flows");
const businessRoutes = require("./routes/businesses");
const { initializeDatabase } = require("./database/init");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(
  express.json({
    limit: "10mb",
    // Store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/flows", flowRoutes);
app.use("/api/businesses", businessRoutes);

// Health check endpoint (GET request for manual testing)
app.get("/health", (req, res) => {
  res.status(200).json({
    data: {
      status: "active",
    },
  });
});

// Meta Flow Health Check endpoint (GET request for manual testing)
app.get("/ping", (req, res) => {
  res.status(200).json({
    data: {
      status: "active",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log("🔄 Initializing database connection...");
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(
        `🚀 WhatsApp Flow Data Endpoint Server running on port ${PORT}`
      );
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    console.error(
      "❌ Server startup failed. Please check your database configuration."
    );

    // In production, you might want to retry or use a fallback
    if (process.env.NODE_ENV === "production") {
      console.log("🔄 Retrying database connection in 5 seconds...");
      setTimeout(startServer, 5000);
    } else {
      process.exit(1);
    }
  }
};

startServer();

module.exports = app;
