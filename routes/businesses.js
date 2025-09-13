const express = require("express");
const {
  createBusiness,
  uploadPublicKeyToMeta,
  getBusiness,
  getBusinessWithCredentials,
  updateWhatsAppConfig,
  listBusinesses,
  deleteBusiness,
  regenerateBusinessKeys,
} = require("../services/businessService");
const Business = require("../models/Business");

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

// Get business by ID with credentials (for internal use)
router.get("/:businessId/with-credentials", async (req, res) => {
  try {
    const business = await getBusinessWithCredentials(req.params.businessId);
    res.json({
      success: true,
      data: business,
    });
  } catch (error) {
    console.error("Error getting business with credentials:", error);
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

// Complete business onboarding (WhatsApp config + auto public key upload)
router.post("/:businessId/onboard", async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(`🚀 Starting onboarding for business: ${businessId}`);
    console.log(`📥 Request body:`, req.body);

    const {
      whatsapp_business_account_id,
      phone_number_id,
      phone_number,
      access_token,
      app_secret,
    } = req.body;

    if (!phone_number_id || !access_token || !app_secret) {
      console.error(`❌ Missing required fields for business ${businessId}`);
      return res.status(400).json({
        error: "Missing required fields",
        message: "phone_number_id, access_token, and app_secret are required",
        received: {
          phone_number_id: !!phone_number_id,
          access_token: !!access_token,
          app_secret: !!app_secret,
        },
      });
    }

    // Step 1: Update WhatsApp configuration
    console.log(`📱 Configuring WhatsApp for business ${businessId}...`);
    try {
      const business = await updateWhatsAppConfig(businessId, {
        whatsapp_business_account_id,
        phone_number_id,
        phone_number,
        access_token,
        app_secret,
      });
      console.log(`✅ WhatsApp config updated for business ${businessId}`);
    } catch (configError) {
      console.error(
        `❌ Failed to update WhatsApp config for business ${businessId}:`,
        configError
      );
      throw configError;
    }

    // Step 2: Auto-upload public key
    console.log(`🔑 Auto-uploading public key for business ${businessId}...`);
    try {
      const uploadResult = await uploadPublicKeyToMeta(
        businessId,
        phone_number_id,
        access_token
      );
      console.log(`✅ Public key uploaded for business ${businessId}`);
    } catch (uploadError) {
      console.error(
        `❌ Failed to upload public key for business ${businessId}:`,
        uploadError
      );
      throw uploadError;
    }

    // Step 3: Get updated business info
    const updatedBusiness = await getBusiness(businessId);

    res.json({
      success: true,
      message: "Business onboarding completed successfully",
      data: updatedBusiness,
    });
  } catch (error) {
    console.error(
      `❌ Error during business onboarding for ${req.params.businessId}:`,
      error
    );
    res.status(500).json({
      error: "Onboarding failed",
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

// Debug endpoint to check if business exists
router.get("/:businessId/debug", async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(`🔍 Debug: Checking business ${businessId}`);

    // Check if business exists in database
    const Business = require("../models/Business");
    const business = await Business.findOne({ id: businessId });

    if (!business) {
      return res.status(404).json({
        error: "Business not found",
        message: `No business found with ID: ${businessId}`,
        debug: {
          searchedId: businessId,
          totalBusinesses: await Business.countDocuments(),
        },
      });
    }

    res.json({
      success: true,
      message: "Business found",
      data: {
        id: business.id,
        name: business.name,
        email: business.email,
        hasPublicKey: !!business.public_key,
        hasAccessToken: !!business.access_token,
        hasPhoneNumberId: !!business.phone_number_id,
        publicKeyUploaded: business.public_key_uploaded,
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      error: "Debug failed",
      message: error.message,
    });
  }
});

// Regenerate keys for a business
router.post("/:businessId/regenerate-keys", async (req, res) => {
  try {
    const { businessId } = req.params;

    console.log(`🔑 Regenerating keys for business: ${businessId}`);

    const updatedBusiness = await regenerateBusinessKeys(businessId);

    res.json({
      success: true,
      message: "Keys regenerated successfully",
      business: {
        id: updatedBusiness.id,
        name: updatedBusiness.name,
        public_key_uploaded: updatedBusiness.public_key_uploaded,
      },
    });
  } catch (error) {
    console.error("Error regenerating keys:", error);
    res.status(500).json({
      error: "Failed to regenerate keys",
      message: error.message,
    });
  }
});

// Regenerate keys for ALL businesses (utility endpoint)
router.post("/regenerate-all-keys", async (req, res) => {
  try {
    console.log("🔑 Regenerating keys for ALL businesses...");

    // Get all businesses without private keys
    const businesses = await Business.find({
      $or: [
        { private_key: { $exists: false } },
        { private_key: null },
        { private_key: "" },
      ],
    });

    console.log(
      `📊 Found ${businesses.length} businesses without private keys`
    );

    const results = [];

    for (const business of businesses) {
      try {
        const updatedBusiness = await regenerateBusinessKeys(business.id);
        results.push({
          id: business.id,
          name: business.name,
          status: "success",
        });
        console.log(
          `✅ Keys regenerated for: ${business.name} (${business.id})`
        );
      } catch (error) {
        results.push({
          id: business.id,
          name: business.name,
          status: "error",
          error: error.message,
        });
        console.error(
          `❌ Failed to regenerate keys for: ${business.name} (${business.id}):`,
          error.message
        );
      }
    }

    res.json({
      success: true,
      message: `Keys regeneration completed for ${businesses.length} businesses`,
      results: results,
    });
  } catch (error) {
    console.error("Error regenerating all keys:", error);
    res.status(500).json({
      error: "Failed to regenerate all keys",
      message: error.message,
    });
  }
});

module.exports = router;
