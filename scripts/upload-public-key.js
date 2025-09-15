/**
 * Script to upload public key to Meta for a business
 * Usage: node upload-public-key.js <businessId>
 */

const axios = require("axios");
const Business = require("../models/Business");
const { initializeDatabase } = require("../database/init");

async function uploadPublicKey(businessId) {
  try {
    console.log(`🔑 Uploading public key for business: ${businessId}`);

    // Connect to database
    await initializeDatabase();

    // Get business details
    const business = await Business.findOne({ id: businessId });
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found`);
    }

    console.log(`📊 Business found: ${business.name}`);
    console.log(`📞 Phone Number ID: ${business.phone_number_id}`);
    console.log(`🔑 Has public key: ${!!business.public_key}`);
    console.log(`🔑 Has private key: ${!!business.private_key}`);
    console.log(`🔑 Public key uploaded: ${business.public_key_uploaded}`);

    if (!business.public_key) {
      throw new Error("No public key found for this business");
    }

    if (!business.access_token) {
      throw new Error("No access token found for this business");
    }

    if (!business.phone_number_id) {
      throw new Error("No phone number ID found for this business");
    }

    // Upload public key to Meta
    const metaUrl = `https://graph.facebook.com/v23.0/${business.phone_number_id}/whatsapp_business_encryption`;

    console.log(`🚀 Uploading to Meta URL: ${metaUrl}`);
    console.log(
      `🔑 Public key (first 100 chars): ${business.public_key.substring(
        0,
        100
      )}...`
    );

    const response = await axios.post(
      metaUrl,
      `business_public_key=${encodeURIComponent(business.public_key)}`,
      {
        headers: {
          Authorization: `Bearer ${business.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log(`✅ Meta response:`, response.data);

    // Update business record
    await Business.findOneAndUpdate(
      { id: businessId },
      {
        $set: {
          public_key_uploaded: true,
          public_key_uploaded_at: new Date(),
        },
      }
    );

    console.log(`✅ Public key uploaded successfully!`);
    console.log(`📊 Business updated with upload status`);
  } catch (error) {
    console.error(
      `❌ Error uploading public key:`,
      error.response?.data || error.message
    );
    process.exit(1);
  }
}

// Get business ID from command line arguments
const businessId = process.argv[2];

if (!businessId) {
  console.error("❌ Please provide business ID");
  console.error("Usage: node upload-public-key.js <businessId>");
  process.exit(1);
}

uploadPublicKey(businessId);
