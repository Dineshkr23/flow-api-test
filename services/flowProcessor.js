const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const Flow = require("../models/Flow");
const FlowData = require("../models/FlowData");
const FlowSession = require("../models/FlowSession");
const FlowResponse = require("../models/FlowResponse");
const {
  decryptFlowRequest,
  encryptFlowResponse,
  validateSignature,
} = require("../utils/encryption");

/**
 * Process Flow actions according to WhatsApp Flow Data Endpoint specification
 * @param {Object} params - Flow action parameters
 * @param {string} params.action - Action type (INIT, BACK, DATA_EXCHANGE, COMPLETE)
 * @param {string} params.screen - Screen ID
 * @param {string} params.flow_token - Flow token
 * @param {string} params.session_id - Session ID
 * @param {Object} params.payload - Request payload
 * @param {Object} params.db - Database instance
 */
const processFlowAction = async ({
  action,
  screen,
  flow_token,
  session_id,
  payload,
}) => {
  try {
    switch (action) {
      case "INIT":
        return await handleInitAction({
          screen,
          flow_token,
          session_id,
          payload,
        });

      case "BACK":
        return await handleBackAction({
          screen,
          flow_token,
          session_id,
          payload,
        });

      case "DATA_EXCHANGE":
        return await handleDataExchangeAction({
          screen,
          flow_token,
          session_id,
          payload,
        });

      case "COMPLETE":
        return await handleCompleteAction({
          screen,
          flow_token,
          session_id,
          payload,
        });

      case "ping":
        return await handlePingAction();

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error processing ${action} action:`, error);
    throw error;
  }
};

/**
 * Handle INIT action - Initialize screen data
 */
const handleInitAction = async ({
  screen,
  flow_token,
  session_id,
  payload,
}) => {
  // Create or update session
  const sessionId = session_id || uuidv4();

  await createOrUpdateSession({
    sessionId,
    flow_token,
    current_screen: screen,
    session_data: JSON.stringify(payload || {}),
  });

  // Get screen data based on screen ID
  const screenData = await getScreenData(screen);

  return {
    version: "7.2",
    screen: screen,
    data: screenData,
    session_id: sessionId,
  };
};

/**
 * Handle BACK action - Handle back navigation
 */
const handleBackAction = async ({
  screen,
  flow_token,
  session_id,
  payload,
}) => {
  if (!session_id) {
    throw new Error("Session ID required for BACK action");
  }

  // Get session data
  const session = await getSession(session_id);
  if (!session) {
    throw new Error("Session not found");
  }

  // Update session with current screen
  await updateSession({
    sessionId: session_id,
    current_screen: screen,
    session_data: JSON.stringify(payload || {}),
  });

  // Get refreshed screen data
  const screenData = await getScreenData(screen);

  return {
    version: "7.2",
    screen: screen,
    data: screenData,
    session_id: session_id,
  };
};

/**
 * Handle DATA_EXCHANGE action - Process data exchange
 */
const handleDataExchangeAction = async ({
  screen,
  flow_token,
  session_id,
  payload,
}) => {
  if (!session_id) {
    throw new Error("Session ID required for DATA_EXCHANGE action");
  }

  // Save user responses
  if (payload) {
    await saveUserResponses({
      sessionId: session_id,
      screenId: screen,
      responses: payload,
    });
  }

  // Get screen data including dropdown options
  const screenData = await getScreenData(screen);

  // Process the data exchange logic
  const processedData = await processDataExchange({
    screen,
    payload,
    session_id,
  });

  // Determine next screen based on business logic
  const nextScreen = await determineNextScreen({
    currentScreen: screen,
    payload,
    session_id,
  });

  if (nextScreen) {
    return {
      version: "7.2",
      screen: nextScreen,
      data: {
        ...processedData,
        ...screenData, // Include dropdown options and other screen data
      },
      session_id: session_id,
    };
  } else {
    // Complete the flow
    return {
      version: "7.2",
      screen: "SUCCESS",
      data: {
        ...processedData,
        ...screenData, // Include dropdown options and other screen data
      },
      session_id: session_id,
    };
  }
};

/**
 * Handle COMPLETE action - Complete the flow
 */
const handleCompleteAction = async ({
  screen,
  flow_token,
  session_id,
  payload,
}) => {
  if (!session_id) {
    throw new Error("Session ID required for COMPLETE action");
  }

  // Save final responses
  if (payload) {
    await saveUserResponses({
      sessionId: session_id,
      screenId: screen,
      responses: payload,
    });
  }

  // Mark session as completed
  await updateSession({
    sessionId: session_id,
    current_screen: "COMPLETED",
    session_data: JSON.stringify(payload || {}),
  });

  return {
    version: "7.2",
    screen: "SUCCESS",
    data: {
      message: "Flow completed successfully",
      completed_at: new Date().toISOString(),
    },
    session_id: session_id,
  };
};

const handlePingAction = async () => {
  try {
    console.log("🏓 Processing PING action (health check)");

    // Return the health check response as required by Meta
    return {
      data: {
        status: "active",
      },
    };
  } catch (error) {
    console.error("Error handling PING action:", error);
    throw error;
  }
};

/**
 * Helper Functions
 */

const createOrUpdateSession = async ({
  sessionId,
  flow_token,
  current_screen,
  session_data,
}) => {
  try {
    const flowId = flow_token || "default_flow";
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

    const sessionData = {
      id: sessionId,
      flow_id: flowId,
      current_screen,
      session_data,
      expires_at: expiresAt,
    };

    // Use upsert to create or update session
    const session = await FlowSession.findOneAndUpdate(
      { id: sessionId },
      sessionData,
      { upsert: true, new: true }
    );

    return session;
  } catch (error) {
    console.error("Error creating/updating session:", error);
    throw error;
  }
};

const updateSession = async ({ sessionId, current_screen, session_data }) => {
  try {
    const session = await FlowSession.findOneAndUpdate(
      { id: sessionId },
      { current_screen, session_data, updated_at: new Date() },
      { new: true }
    );
    return session;
  } catch (error) {
    console.error("Error updating session:", error);
    throw error;
  }
};

const getSession = async (sessionId) => {
  try {
    const session = await FlowSession.findOne({ id: sessionId });
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
};

const getScreenData = async (screenId) => {
  try {
    // Check if we have cached dropdown options
    const flowData = await FlowData.findOne({
      screen_id: screenId,
      field_name: "dropdown_options",
    });

    let dropdownOptions = [];

    if (flowData) {
      dropdownOptions = JSON.parse(flowData.field_value || "[]");

      // If we have API configuration and want real-time data, fetch from API
      if (flowData.api_config) {
        try {
          const apiConfig = JSON.parse(flowData.api_config);
          const apiResponse = await fetch(apiConfig.endpoint, {
            method: apiConfig.method || "GET",
            headers: apiConfig.headers || {},
            ...(apiConfig.body && { body: JSON.stringify(apiConfig.body) }),
          });

          if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            dropdownOptions = transformApiDataToDropdownOptions(
              apiData,
              apiConfig.transform
            );

            // Update cache with fresh data
            await FlowData.findOneAndUpdate(
              {
                screen_id: screenId,
                field_name: "dropdown_options",
              },
              {
                field_value: JSON.stringify(dropdownOptions),
                updated_at: new Date(),
              }
            );
          }
        } catch (apiError) {
          console.error("Failed to fetch fresh dropdown data:", apiError);
          // Continue with cached data if API fails
        }
      }
    }

    // Return the dropdown options in the format expected by Meta
    return {
      screen_title: `Screen: ${screenId}`,
      timestamp: new Date().toISOString(),
      dropdown_options: dropdownOptions,
      // Add any other dynamic data based on screen ID
    };
  } catch (error) {
    console.error("Error getting screen data:", error);
    throw error;
  }
};

// Helper function to transform API data
const transformApiDataToDropdownOptions = (apiData, transformFunction) => {
  if (transformFunction && typeof transformFunction === "function") {
    try {
      return transformFunction(apiData);
    } catch (error) {
      console.error("Transform function error:", error);
    }
  }

  // Default transformation logic
  if (Array.isArray(apiData)) {
    return apiData.map((item, index) => ({
      id: item.id || item.value || `option_${index}`,
      title: item.title || item.label || item.name || item.text || String(item),
    }));
  }

  if (apiData.data && Array.isArray(apiData.data)) {
    return apiData.data.map((item, index) => ({
      id: item.id || item.value || `option_${index}`,
      title: item.title || item.label || item.name || item.text || String(item),
    }));
  }

  return [];
};

const saveUserResponses = async ({ sessionId, screenId, responses }) => {
  try {
    const responseEntries = Object.entries(responses);

    for (const [fieldName, fieldValue] of responseEntries) {
      const flowResponse = new FlowResponse({
        flow_id: "default_flow",
        session_id: sessionId,
        screen_id: screenId,
        field_name: fieldName,
        field_value: JSON.stringify(fieldValue),
        response_data: JSON.stringify(responses),
      });

      await flowResponse.save();
    }
  } catch (error) {
    console.error("Error saving user responses:", error);
    throw error;
  }
};

const processDataExchange = async ({ screen, payload, session_id }) => {
  // Implement your business logic here
  // This could include:
  // - API calls to external services
  // - Database queries
  // - Data transformation
  // - Validation

  return {
    processed: true,
    screen: screen,
    timestamp: new Date().toISOString(),
    // Add processed data here
  };
};

const determineNextScreen = async ({ currentScreen, payload, session_id }) => {
  // Implement your routing logic here
  // This could be based on:
  // - User responses
  // - Business rules
  // - Conditional logic

  // For now, return null to complete the flow
  return null;
};

/**
 * Process encrypted Meta Flow request
 * @param {Object} req - Express request object
 * @param {string} privateKeyPem - Private key for decryption
 * @param {string} appSecret - App secret for signature validation
 * @returns {Object} Decrypted and processed response
 */
const processEncryptedFlowRequest = async (req, privateKeyPem, appSecret) => {
  try {
    // Validate signature
    const signature = req.headers["x-hub-signature-256"];
    const payload = JSON.stringify(req.body);

    console.log("🔍 Signature validation debug:");
    console.log(`   - Signature header: ${signature}`);
    console.log(`   - App secret exists: ${!!appSecret}`);
    console.log(`   - App secret length: ${appSecret ? appSecret.length : 0}`);
    console.log(`   - Payload length: ${payload.length}`);

    if (!appSecret) {
      throw new Error("App secret is missing");
    }

    if (!validateSignature(payload, signature, appSecret)) {
      console.error("❌ Signature validation failed");
      console.log(`   - Received signature: ${signature}`);
      const expectedSignature =
        "sha256=" +
        crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
      console.log(`   - Expected signature: ${expectedSignature}`);
      throw new Error("Invalid signature");
    }

    console.log("✅ Signature validation passed");

    // Decrypt the request
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;

    const decryptedPayload = decryptFlowRequest(
      encrypted_flow_data,
      encrypted_aes_key,
      initial_vector,
      privateKeyPem
    );

    // Process the flow action
    const result = await processFlowAction(decryptedPayload);

    // Encrypt the response
    const aesKey = Buffer.from(encrypted_aes_key, "base64");
    const iv = Buffer.from(initial_vector, "base64");

    const encryptedResponse = encryptFlowResponse(result, aesKey, iv);

    return encryptedResponse;
  } catch (error) {
    console.error("Error processing encrypted flow request:", error);
    throw error;
  }
};

module.exports = {
  processFlowAction,
  processEncryptedFlowRequest,
  validateFlowRequest: (req) => {
    // Basic validation - you can enhance this
    return req && req.action && req.screen;
  },
};
