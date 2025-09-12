const mongoose = require("mongoose");

const flowResponseSchema = new mongoose.Schema({
  flow_id: {
    type: String,
    required: true,
  },
  session_id: {
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
  response_data: {
    type: String,
    required: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes
flowResponseSchema.index({ flow_id: 1, session_id: 1 });
flowResponseSchema.index({ flow_id: 1 });
flowResponseSchema.index({ session_id: 1 });
flowResponseSchema.index({ screen_id: 1 });
flowResponseSchema.index({ created_at: -1 });

// Compound indexes for common queries
flowResponseSchema.index({ flow_id: 1, created_at: -1 });
flowResponseSchema.index({ session_id: 1, created_at: -1 });

const FlowResponse = mongoose.model("FlowResponse", flowResponseSchema);

module.exports = FlowResponse;
