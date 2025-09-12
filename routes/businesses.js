const express = require("express");
const {
  createBusiness,
  uploadPublicKeyToMeta,
  getBusiness,
  updateWhatsAppConfig,
  listBusinesses,
  deleteBusiness,
} = require("../services/businessService");

const router = express.Router();

// Create a new business
router.post("/", async (req, res) => {
  try {
    const business = await createBusiness(req.body);

    // Don't return sensitive data
    const { private_key, access_token, app_secret, ...safeBusiness } =
      business.toObject();

    res.status(201).json({
      success: true,
      message: "Business created successfully",
      data: safeBusiness,
    });
  } catch (error) {
    console.error("Error creating business:", error);
    res.status(500).json({
      error: "Failed to create business",
      message: error.message,
    });
  }
});

// Get business by ID
router.get("/:businessId", async (req, res) => {
  try {
    const business = await getBusiness(req.params.businessId);
    res.json({
      success: true,
      data: business,
    });
  } catch (error) {
    console.error("Error getting business:", error);
    res.status(404).json({
      error: "Business not found",
      message: error.message,
    });
  }
});

// List all businesses
router.get("/", async (req, res) => {
  try {
    const businesses = await listBusinesses(req.query);
    res.json({
      success: true,
      data: businesses,
    });
  } catch (error) {
    console.error("Error listing businesses:", error);
    res.status(500).json({
      error: "Failed to list businesses",
      message: error.message,
    });
  }
});

// Update business WhatsApp configuration
router.put("/:businessId/whatsapp-config", async (req, res) => {
  try {
    const business = await updateWhatsAppConfig(
      req.params.businessId,
      req.body
    );
    res.json({
      success: true,
      message: "WhatsApp configuration updated successfully",
      data: business,
    });
  } catch (error) {
    console.error("Error updating WhatsApp config:", error);
    res.status(500).json({
      error: "Failed to update WhatsApp configuration",
      message: error.message,
    });
  }
});

// Upload public key to Meta
router.post("/:businessId/upload-public-key", async (req, res) => {
  try {
    const { phone_number_id, access_token } = req.body;

    if (!phone_number_id || !access_token) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "phone_number_id and access_token are required",
      });
    }

    const result = await uploadPublicKeyToMeta(
      req.params.businessId,
      phone_number_id,
      access_token
    );

    res.json(result);
  } catch (error) {
    console.error("Error uploading public key:", error);
    res.status(500).json({
      error: "Failed to upload public key",
      message: error.message,
    });
  }
});

// Get business public key (for display purposes)
router.get("/:businessId/public-key", async (req, res) => {
  try {
    const business = await getBusiness(req.params.businessId);
    res.json({
      success: true,
      data: {
        public_key: business.public_key,
        public_key_uploaded: business.public_key_uploaded,
        public_key_uploaded_at: business.public_key_uploaded_at,
      },
    });
  } catch (error) {
    console.error("Error getting public key:", error);
    res.status(404).json({
      error: "Business not found",
      message: error.message,
    });
  }
});

// Delete business
router.delete("/:businessId", async (req, res) => {
  try {
    const result = await deleteBusiness(req.params.businessId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting business:", error);
    res.status(500).json({
      error: "Failed to delete business",
      message: error.message,
    });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Business service is healthy",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
