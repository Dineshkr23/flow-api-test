const mongoose = require("mongoose");

const flowDataSchema = new mongoose.Schema({
  business_id: {
    type: String,
    required: true,
  },
  flow_id: {
    type: String,
    required: true,
  },
  screen_id: {
    type: String,
    required: true,
  },
  field_name: {
    type: String,
    required: true,
  },
  field_value: {
    type: String,
    required: false,
  },
  api_config: {
    type: String,
    required: false,
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
flowDataSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create indexes
flowDataSchema.index({ business_id: 1 });
flowDataSchema.index({ flow_id: 1 });
flowDataSchema.index({ screen_id: 1 });
flowDataSchema.index({ updated_at: -1 });

// Create compound unique index to prevent duplicates
flowDataSchema.index(
  { business_id: 1, flow_id: 1, screen_id: 1, field_name: 1 },
  { unique: true }
);

const FlowData = mongoose.model("FlowData", flowDataSchema);

module.exports = FlowData;
