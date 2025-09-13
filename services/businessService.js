const Business = require("../models/Business");
const { generateKeyPair } = require("../utils/encryption");
const axios = require("axios");

/**
 * Create a new business
 * @param {Object} businessData - Business information
 * @returns {Object} Created business
 */
const createBusiness = async (businessData) => {
  try {
    // Generate RSA key pair for this business
    const { privateKey, publicKey } = generateKeyPair();

    const business = new Business({
      ...businessData,
      public_key: publicKey,
      private_key: privateKey, // Store temporarily for upload
    });

    await business.save();
    return business;
  } catch (error) {
    console.error("Error creating business:", error);
    throw error;
  }
};

/**
 * Upload public key to Meta for a business
 * @param {string} businessId - Business ID
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} accessToken - Meta access token
 * @returns {Object} Upload result
 */
const uploadPublicKeyToMeta = async (
  businessId,
  phoneNumberId,
  accessToken
) => {
  try {
    console.log(`🔑 Starting public key upload for business ${businessId}`);
    console.log(`📱 Phone number ID: ${phoneNumberId}`);
    console.log(`🔐 Access token: ${accessToken ? "Present" : "Missing"}`);

    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    if (!business.public_key) {
      throw new Error("Business has no public key");
    }

    console.log(`✅ Business found with public key`);

    // Upload public key to Meta
    const metaApiUrl = `https://graph.facebook.com/v23.0/${phoneNumberId}/whatsapp_business_encryption`;
    console.log(`🌐 Calling Meta API: ${metaApiUrl}`);

    // Use URLSearchParams for form-urlencoded data
    const params = new URLSearchParams();
    params.append("business_public_key", business.public_key);

    const response = await axios.post(metaApiUrl, params, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log(`✅ Meta API response:`, response.data);

    // Update business record - preserve existing fields
    await Business.findOneAndUpdate(
      { id: businessId },
      {
        $set: {
          public_key_uploaded: true,
          public_key_uploaded_at: new Date(),
          phone_number_id: phoneNumberId,
          access_token: accessToken,
        },
      }
    );

    console.log(`✅ Business record updated`);

    return {
      success: true,
      message: "Public key uploaded successfully",
      data: response.data,
    };
  } catch (error) {
    console.error(
      `❌ Error uploading public key for business ${businessId}:`,
      error
    );
    if (error.response) {
      console.error(`❌ Meta API Error Response:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }
    throw error;
  }
};

/**
 * Get business by ID (safe version - excludes sensitive data)
 * @param {string} businessId - Business ID
 * @returns {Object} Business data (without sensitive fields)
 */
const getBusiness = async (businessId) => {
  try {
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    // Don't return sensitive data
    const { private_key, access_token, app_secret, ...safeBusiness } =
      business.toObject();
    return safeBusiness;
  } catch (error) {
    console.error("Error getting business:", error);
    throw error;
  }
};

/**
 * Get business by ID with sensitive data (for internal use)
 * @param {string} businessId - Business ID
 * @returns {Object} Business data (with sensitive fields)
 */
const getBusinessWithCredentials = async (businessId) => {
  try {
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    return business.toObject();
  } catch (error) {
    console.error("Error getting business with credentials:", error);
    throw error;
  }
};

/**
 * Update business WhatsApp configuration
 * @param {string} businessId - Business ID
 * @param {Object} whatsappConfig - WhatsApp configuration
 * @returns {Object} Updated business
 */
const updateWhatsAppConfig = async (businessId, whatsappConfig) => {
  try {
    const business = await Business.findOneAndUpdate(
      { id: businessId },
      {
        whatsapp_business_account_id:
          whatsappConfig.whatsapp_business_account_id,
        phone_number_id: whatsappConfig.phone_number_id,
        phone_number: whatsappConfig.phone_number,
        access_token: whatsappConfig.access_token,
        app_secret: whatsappConfig.app_secret,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!business) {
      throw new Error("Business not found");
    }

    // Don't return sensitive data
    const { private_key, access_token, app_secret, ...safeBusiness } =
      business.toObject();
    return safeBusiness;
  } catch (error) {
    console.error("Error updating WhatsApp config:", error);
    throw error;
  }
};

/**
 * Get business private key for decryption (internal use only)
 * @param {string} businessId - Business ID
 * @returns {string} Private key
 */
const getBusinessPrivateKey = async (businessId) => {
  try {
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    return business.private_key;
  } catch (error) {
    console.error("Error getting business private key:", error);
    throw error;
  }
};

/**
 * Get business app secret (internal use only)
 * @param {string} businessId - Business ID
 * @returns {string} App secret
 */
const getBusinessAppSecret = async (businessId) => {
  try {
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    return business.app_secret;
  } catch (error) {
    console.error("Error getting business app secret:", error);
    throw error;
  }
};

/**
 * Regenerate key pair for an existing business
 * @param {string} businessId - Business ID
 * @returns {Object} Updated business with new keys
 */
const regenerateBusinessKeys = async (businessId) => {
  try {
    console.log(`🔑 Regenerating keys for business: ${businessId}`);

    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    // Generate new key pair
    const { privateKey, publicKey } = generateKeyPair();

    // Update business with new keys
    const updatedBusiness = await Business.findOneAndUpdate(
      { id: businessId },
      {
        $set: {
          private_key: privateKey,
          public_key: publicKey,
          public_key_uploaded: false, // Reset upload status since we have new keys
          public_key_uploaded_at: null,
        },
      },
      { new: true }
    );

    console.log(`✅ Keys regenerated for business: ${businessId}`);
    return updatedBusiness;
  } catch (error) {
    console.error("Error regenerating business keys:", error);
    throw error;
  }
};

/**
 * List all businesses
 * @param {Object} filters - Filter options
 * @returns {Array} List of businesses
 */
const listBusinesses = async (filters = {}) => {
  try {
    const businesses = await Business.find(filters).select(
      "-private_key -access_token -app_secret"
    );
    return businesses;
  } catch (error) {
    console.error("Error listing businesses:", error);
    throw error;
  }
};

/**
 * Delete business
 * @param {string} businessId - Business ID
 * @returns {Object} Deletion result
 */
const deleteBusiness = async (businessId) => {
  try {
    const result = await Business.deleteOne({ id: businessId });
    return {
      success: result.deletedCount > 0,
      message:
        result.deletedCount > 0 ? "Business deleted" : "Business not found",
    };
  } catch (error) {
    console.error("Error deleting business:", error);
    throw error;
  }
};

module.exports = {
  createBusiness,
  uploadPublicKeyToMeta,
  getBusiness,
  getBusinessWithCredentials,
  updateWhatsAppConfig,
  getBusinessPrivateKey,
  getBusinessAppSecret,
  listBusinesses,
  deleteBusiness,
  regenerateBusinessKeys,
};
