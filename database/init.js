const { initializeDatabase, getDatabase, closeDatabase } = require("./mongodb");

// Re-export MongoDB functions for compatibility
module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
