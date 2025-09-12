const express = require("express");
const {
  processFlowAction,
  processEncryptedFlowRequest,
  validateFlowRequest,
} = require("../services/flowProcessor");
const {
  getBusinessPrivateKey,
  getBusinessAppSecret,
} = require("../services/businessService");
const Flow = require("../models/Flow");
const FlowData = require("../models/FlowData");
const FlowSession = require("../models/FlowSession");
const FlowResponse = require("../models/FlowResponse");

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
      const businessId = req.headers["x-business-id"] || req.body.business_id;

      if (!businessId) {
        return res.status(400).json({
          error: "Business ID required",
          message: "Business ID must be provided in headers or request body",
        });
      }

      try {
        const privateKeyPem = await getBusinessPrivateKey(businessId);
        const appSecret = await getBusinessAppSecret(businessId);

        const encryptedResponse = await processEncryptedFlowRequest(
          req,
          privateKeyPem,
          appSecret
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

module.exports = router;
