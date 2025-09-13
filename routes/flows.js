const express = require("express");
const {
  processFlowAction,
  processEncryptedFlowRequest,
  validateFlowRequest,
} = require("../services/flowProcessor");
const {
  getBusinessPrivateKey,
  getBusinessAppSecret,
  getBusiness,
  getBusinessWithCredentials,
  uploadPublicKeyToMeta,
} = require("../services/businessService");
const Flow = require("../models/Flow");
const FlowData = require("../models/FlowData");
const FlowSession = require("../models/FlowSession");
const FlowResponse = require("../models/FlowResponse");
const Business = require("../models/Business");

const router = express.Router();

// Main Data Endpoint - This is what Meta will call
router.post("/data-endpoint", async (req, res) => {
  try {
    // Check if this is an encrypted request from Meta
    if (
      req.body.encrypted_flow_data &&
      req.body.encrypted_aes_key &&
      req.body.initial_vector
    ) {
      // Encrypted request from Meta - need to determine business from request
      // Meta doesn't send business_id, so we need to try decrypting with all businesses
      console.log(
        "🔐 Received encrypted request from Meta - attempting to identify business"
      );

      try {
        // Debug: Check all businesses first
        const allBusinesses = await Business.find({});
        console.log(`📊 Total businesses in database: ${allBusinesses.length}`);

        if (allBusinesses.length > 0) {
          console.log("📋 Business details:");
          allBusinesses.forEach((business, index) => {
            console.log(`  ${index + 1}. Business ID: ${business.id}`);
            console.log(
              `     - public_key_uploaded: ${business.public_key_uploaded}`
            );
            console.log(`     - has access_token: ${!!business.access_token}`);
            console.log(`     - has private_key: ${!!business.private_key}`);
            console.log(`     - phone_number_id: ${business.phone_number_id}`);
          });
        }

        // Get all businesses with public keys uploaded
        const businesses = await Business.find({
          public_key_uploaded: true,
          access_token: { $exists: true, $ne: null },
          private_key: { $exists: true, $ne: null },
        });

        console.log(
          `🔑 Businesses with uploaded public keys: ${businesses.length}`
        );

        if (businesses.length === 0) {
          // Fallback: Try to find businesses with at least private_key and access_token
          console.log(
            "⚠️ No businesses with full criteria found, trying fallback..."
          );

          const fallbackBusinesses = await Business.find({
            private_key: { $exists: true, $ne: null },
            access_token: { $exists: true, $ne: null },
          });

          console.log(
            `🔄 Fallback businesses found: ${fallbackBusinesses.length}`
          );

          if (fallbackBusinesses.length === 0) {
            // Last resort: Try any business with access_token
            console.log(
              "⚠️ No businesses with private_key found, trying access_token only..."
            );

            const tokenBusinesses = await Business.find({
              access_token: { $exists: true, $ne: null },
            });

            console.log(
              `🔄 Businesses with access_token: ${tokenBusinesses.length}`
            );

            if (tokenBusinesses.length === 0) {
              return res.status(500).json({
                error: "No businesses configured",
                message: "No businesses found with public keys uploaded",
                debug: {
                  total_businesses: allBusinesses.length,
                  businesses_with_public_keys: businesses.length,
                  fallback_businesses: fallbackBusinesses.length,
                  token_businesses: tokenBusinesses.length,
                },
              });
            }

            // Use token-only businesses
            businesses.push(...tokenBusinesses);
            console.log(
              `✅ Using ${tokenBusinesses.length} businesses with access_token for decryption`
            );
          } else {
            // Use fallback businesses
            businesses.push(...fallbackBusinesses);
            console.log(
              `✅ Using ${fallbackBusinesses.length} fallback businesses for decryption`
            );
          }
        }

        let decryptionSuccessful = false;
        let encryptedResponse = null;
        let successfulBusiness = null;

        // Try to decrypt with each business's private key
        for (const business of businesses) {
          try {
            console.log(
              `🔑 Attempting decryption with business: ${business.id}`
            );

            const encryptedResponse = await processEncryptedFlowRequest(
              req,
              business.private_key,
              business.app_secret
            );

            decryptionSuccessful = true;
            successfulBusiness = business;
            console.log(
              `✅ Successfully decrypted with business: ${business.id}`
            );
            break;
          } catch (decryptError) {
            console.log(
              `❌ Failed to decrypt with business ${business.id}:`,
              decryptError.message
            );
            continue;
          }
        }

        if (!decryptionSuccessful) {
          console.error("❌ Failed to decrypt with any business");
          return res.status(421).json({
            error: "Decryption failed",
            message:
              "Unable to decrypt request with any available business key",
          });
        }

        console.log(
          `🎯 Successfully processed request for business: ${successfulBusiness.id}`
        );

        // Send encrypted response as plain text (not JSON)
        res.set("Content-Type", "text/plain");
        res.send(encryptedResponse);
      } catch (error) {
        console.error("Error processing encrypted request:", error);
        return res.status(500).json({
          error: "Business configuration error",
          message: error.message,
        });
      }
    } else {
      // Unencrypted request (for testing)
      const { action, screen, flow_token, session_id, payload } = req.body;

      // Validate request
      if (!validateFlowRequest(req.body)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing required fields: action, screen",
        });
      }

      // Process the flow action
      const result = await processFlowAction({
        action,
        screen,
        flow_token,
        session_id,
        payload,
      });

      res.json(result);
    }
  } catch (error) {
    console.error("Flow processing error:", error);
    res.status(500).json({
      error: "Flow processing failed",
      message: error.message,
    });
  }
});

// Configuration endpoints
router.post("/config", async (req, res) => {
  try {
    const { business_id, flow_id, name, endpoint_url } = req.body;

    if (!business_id) {
      return res.status(400).json({
        error: "Business ID required",
        message: "business_id is required",
      });
    }

    // Check if business exists and has required WhatsApp configuration
    const business = await getBusinessWithCredentials(business_id);

    if (!business) {
      return res.status(404).json({
        error: "Business not found",
        message: "Business with the provided ID does not exist",
      });
    }

    // Check if business has WhatsApp configuration
    if (!business.phone_number_id || !business.access_token) {
      return res.status(400).json({
        error: "WhatsApp configuration missing",
        message:
          "Business must have WhatsApp phone number and access token configured",
      });
    }

    // Auto-upload public key if not already uploaded
    if (!business.public_key_uploaded) {
      try {
        console.log(
          `🔑 Auto-uploading public key for business ${business_id}...`
        );
        await uploadPublicKeyToMeta(
          business_id,
          business.phone_number_id,
          business.access_token
        );
        console.log(
          `✅ Public key uploaded successfully for business ${business_id}`
        );
      } catch (uploadError) {
        console.error(
          `❌ Failed to auto-upload public key for business ${business_id}:`,
          uploadError
        );
        return res.status(500).json({
          error: "Public key upload failed",
          message:
            "Failed to upload public key to Meta. Please check your WhatsApp configuration.",
          details: uploadError.message,
        });
      }
    }

    // Save flow configuration
    const flow = await Flow.findOneAndUpdate(
      { id: flow_id, business_id },
      {
        id: flow_id,
        business_id,
        name,
        endpoint_url,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Configuration saved successfully",
      flow_id,
      public_key_uploaded: business.public_key_uploaded,
    });
  } catch (error) {
    console.error("Error saving configuration:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/config/:flowId", async (req, res) => {
  try {
    const { flowId } = req.params;

    const flow = await Flow.findOne({ id: flowId });
    if (!flow) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json(flow);
  } catch (error) {
    console.error("Error getting configuration:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/config/:flowId", async (req, res) => {
  try {
    const { flowId } = req.params;

    const result = await Flow.deleteOne({ id: flowId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json({
      success: true,
      message: "Configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting configuration:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get flow responses
router.get("/responses/:flowId", async (req, res) => {
  try {
    const { flowId } = req.params;
    const { session_id, limit = 100, offset = 0 } = req.query;

    let query = { flow_id: flowId };
    if (session_id) {
      query.session_id = session_id;
    }

    const responses = await FlowResponse.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({ responses });
  } catch (error) {
    console.error("Error getting flow responses:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get flow sessions
router.get("/sessions/:flowId", async (req, res) => {
  try {
    const { flowId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const sessions = await FlowSession.find({ flow_id: flowId })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({ sessions });
  } catch (error) {
    console.error("Error getting flow sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for dropdown data (called by your main backend)
router.get("/dropdown-data/:flowId/:screenId", async (req, res) => {
  try {
    const { flowId, screenId } = req.params;

    // Get dropdown configuration for this screen
    const flowData = await FlowData.findOne({
      flow_id: flowId,
      screen_id: screenId,
      field_name: "dropdown_options",
    });

    if (!flowData) {
      return res.json({ data: [] });
    }

    // Parse the stored dropdown options
    const options = JSON.parse(flowData.field_value || "[]");
    res.json({ data: options });
  } catch (error) {
    console.error("Error getting dropdown data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update dropdown data (called by your main backend)
router.post(
  "/dropdown-data/:businessId/:flowId/:screenId",
  async (req, res) => {
    try {
      const { businessId, flowId, screenId } = req.params;
      const { options, apiConfig } = req.body;

      const flowData = await FlowData.findOneAndUpdate(
        {
          business_id: businessId,
          flow_id: flowId,
          screen_id: screenId,
          field_name: "dropdown_options",
        },
        {
          business_id: businessId,
          flow_id: flowId,
          screen_id: screenId,
          field_name: "dropdown_options",
          field_value: JSON.stringify(options),
          api_config: apiConfig ? JSON.stringify(apiConfig) : null,
          updated_at: new Date(),
        },
        { upsert: true, new: true }
      );

      res.json({
        success: true,
        message: "Dropdown data saved successfully",
      });
    } catch (error) {
      console.error("Error saving dropdown data:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Health check endpoint for Meta Flow requirements (GET request for manual testing)
router.get("/health", (req, res) => {
  res.status(200).json({
    data: {
      status: "active",
    },
  });
});

// Root health check endpoint (alternative path for manual testing)
router.get("/", (req, res) => {
  res.status(200).json({
    data: {
      status: "active",
    },
  });
});

// Meta Flow Health Check endpoint (GET request for manual testing)
router.get("/ping", (req, res) => {
  res.status(200).json({
    data: {
      status: "active",
    },
  });
});

module.exports = router;
