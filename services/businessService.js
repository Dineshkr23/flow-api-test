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
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error("Business not found");
    }

    if (!business.public_key) {
      throw new Error("Business has no public key");
    }

    // Upload public key to Meta
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/whatsapp_business_public_key`,
      {
        public_key: business.public_key,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Update business record
    await Business.findOneAndUpdate(
      { id: businessId },
      {
        public_key_uploaded: true,
        public_key_uploaded_at: new Date(),
        phone_number_id: phoneNumberId,
        access_token: accessToken,
      }
    );

    return {
      success: true,
      message: "Public key uploaded successfully",
      data: response.data,
    };
  } catch (error) {
    console.error("Error uploading public key:", error);
    throw error;
  }
};

/**
 * Get business by ID
 * @param {string} businessId - Business ID
 * @returns {Object} Business data
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
  updateWhatsAppConfig,
  getBusinessPrivateKey,
  getBusinessAppSecret,
  listBusinesses,
  deleteBusiness,
};
