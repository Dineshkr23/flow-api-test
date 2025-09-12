const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  // WhatsApp Business Account details
  whatsapp_business_account_id: {
    type: String,
    required: false,
  },
  phone_number_id: {
    type: String,
    required: false,
  },
  phone_number: {
    type: String,
    required: false,
  },
  // Public key configuration
  public_key: {
    type: String,
    required: false,
  },
  public_key_uploaded: {
    type: Boolean,
    default: false,
  },
  public_key_uploaded_at: {
    type: Date,
    required: false,
  },
  // API credentials
  access_token: {
    type: String,
    required: false,
  },
  app_secret: {
    type: String,
    required: false,
  },
  // Status
  is_active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Update the updated_at field before saving
businessSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create indexes
businessSchema.index({ phone_number_id: 1 });
businessSchema.index({ whatsapp_business_account_id: 1 });
businessSchema.index({ is_active: 1 });
businessSchema.index({ created_at: -1 });

const Business = mongoose.model("Business", businessSchema);

module.exports = Business;
