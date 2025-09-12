const mongoose = require("mongoose");

const flowSessionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  flow_id: {
    type: String,
    required: true,
  },
  user_id: {
    type: String,
    required: false,
  },
  current_screen: {
    type: String,
    required: false,
  },
  session_data: {
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
  expires_at: {
    type: Date,
    required: false,
  },
});

// Update the updated_at field before saving
flowSessionSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create indexes
flowSessionSchema.index({ flow_id: 1 });
flowSessionSchema.index({ user_id: 1 });
flowSessionSchema.index({ created_at: -1 });

// TTL index for automatic cleanup of expired sessions
flowSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const FlowSession = mongoose.model("FlowSession", flowSessionSchema);

module.exports = FlowSession;
