const crypto = require("crypto");
const NodeRSA = require("node-rsa");

/**
 * Decrypt Meta Flow Data Endpoint request
 * @param {string} encryptedFlowData - Base64 encoded encrypted flow data
 * @param {string} encryptedAesKey - Base64 encoded encrypted AES key
 * @param {string} initialVector - Base64 encoded initial vector
 * @param {string} privateKeyPem - Private key in PEM format
 * @returns {Object} Decrypted payload
 */
const decryptFlowRequest = (
  encryptedFlowData,
  encryptedAesKey,
  initialVector,
  privateKeyPem
) => {
  try {
    // Step 1: Decrypt the AES key using RSA
    const key = new NodeRSA(privateKeyPem);
    key.setOptions({ encryptionScheme: "pkcs1_oaep" });

    const aesKeyBuffer = Buffer.from(encryptedAesKey, "base64");
    const decryptedAesKey = key.decrypt(aesKeyBuffer);

    // Step 2: Decrypt the flow data using AES-GCM
    const iv = Buffer.from(initialVector, "base64");
    const encryptedData = Buffer.from(encryptedFlowData, "base64");

    // Split encrypted data and authentication tag
    const authTag = encryptedData.slice(-16); // Last 16 bytes
    const ciphertext = encryptedData.slice(0, -16); // Everything except last 16 bytes

    // Create decipher
    const decipher = crypto.createDecipherGCM("aes-128-gcm");
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.alloc(0)); // Empty AAD

    // Decrypt
    let decrypted = decipher.update(ciphertext, null, "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt flow request");
  }
};

/**
 * Encrypt Meta Flow Data Endpoint response
 * @param {Object} payload - Response payload to encrypt
 * @param {Buffer} aesKey - AES key from request
 * @param {Buffer} requestIv - Initial vector from request
 * @returns {string} Base64 encoded encrypted response
 */
const encryptFlowResponse = (payload, aesKey, requestIv) => {
  try {
    // Invert all bits of the request IV for response encryption
    const responseIv = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      responseIv[i] = ~requestIv[i];
    }

    // Create cipher
    const cipher = crypto.createCipherGCM("aes-128-gcm");
    cipher.setAAD(Buffer.alloc(0)); // Empty AAD

    // Encrypt
    let encrypted = cipher.update(JSON.stringify(payload), "utf8");
    encrypted += cipher.final();

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine encrypted data and auth tag
    const combined = Buffer.concat([encrypted, authTag]);

    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt flow response");
  }
};

/**
 * Generate RSA key pair for Flow Data Endpoint
 * @returns {Object} Object containing private and public keys
 */
const generateKeyPair = () => {
  const key = new NodeRSA({ b: 2048 });

  return {
    privateKey: key.exportKey("private"),
    publicKey: key.exportKey("public"),
  };
};

/**
 * Validate request signature using app secret
 * @param {string} payload - Request payload
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {string} appSecret - App secret for validation
 * @returns {boolean} True if signature is valid
 */
const validateSignature = (payload, signature, appSecret) => {
  try {
    const expectedSignature =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(payload).digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
};

module.exports = {
  decryptFlowRequest,
  encryptFlowResponse,
  generateKeyPair,
  validateSignature,
};
