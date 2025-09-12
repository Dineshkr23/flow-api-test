const mongoose = require("mongoose");

const flowSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  business_id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  endpoint_url: {
    type: String,
    required: false,
  },
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
flowSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create indexes
flowSchema.index({ business_id: 1 });
flowSchema.index({ business_id: 1, is_active: 1 });
flowSchema.index({ is_active: 1 });
flowSchema.index({ created_at: -1 });

const Flow = mongoose.model("Flow", flowSchema);

module.exports = Flow;
