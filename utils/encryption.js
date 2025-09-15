/**
 * Meta WhatsApp Flow Data Endpoint Encryption Utilities
 * Based on Meta's official implementation
 */

const crypto = require("crypto");

/**
 * FlowEndpointException class for proper error handling
 */
class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/**
 * Decrypt Meta Flow request using RSA and AES-GCM (Meta's official implementation)
 * @param {Object} body - Request body with encrypted data
 * @param {string} privateKeyPem - RSA private key in PEM format
 * @param {string} passphrase - Passphrase for private key (empty string if none)
 * @returns {Object} Decrypted request with aesKeyBuffer and initialVectorBuffer
 */
const decryptRequest = (body, privateKeyPem, passphrase = "") => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    passphrase,
  });
  let decryptedAesKey = null;

  try {
    // Decrypt AES key created by client
    decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );
  } catch (error) {
    console.error("Failed to decrypt AES key:", error);
    /*
    Failed to decrypt. Please verify your private key.
    If you change your public key. You need to return HTTP status code 421 to refresh the public key on the client
    */
    throw new FlowEndpointException(
      421,
      "Failed to decrypt the request. Please verify your private key."
    );
  }

  // Decrypt flow data
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
};

/**
 * Encrypt Meta Flow response using AES-GCM (Meta's official implementation)
 * @param {Object} response - Response data to encrypt
 * @param {Buffer} aesKeyBuffer - AES key buffer from request
 * @param {Buffer} initialVectorBuffer - Initialization vector buffer from request
 * @returns {string} Base64 encrypted response
 */
const encryptResponse = (response, aesKeyBuffer, initialVectorBuffer) => {
  // Flip initial vector
  const flipped_iv = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }

  // Encrypt response data
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv)
  );

  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
};

/**
 * Generate RSA key pair with passphrase (Meta's official implementation)
 * @param {string} passphrase - Passphrase for private key encryption
 * @returns {Object} Key pair with private and public keys
 */
const generateKeyPair = (passphrase = "") => {
  try {
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem",
        cipher: "des-ede3-cbc",
        passphrase,
      },
    });

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    };
  } catch (error) {
    console.error("Error generating key pair:", error);
    throw new Error(`Failed to generate key pair: ${error.message}`);
  }
};

/**
 * Validate request signature using app secret (Meta's official implementation)
 * @param {Buffer} rawBody - Raw request body buffer
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {string} appSecret - App secret for validation
 * @returns {boolean} True if signature is valid
 */
const validateSignature = (rawBody, signature, appSecret) => {
  try {
    if (!appSecret) {
      console.warn("App Secret is not set up. Skipping signature validation.");
      return true;
    }

    const signatureHeader = signature;
    const signatureBuffer = Buffer.from(
      signatureHeader.replace("sha256=", ""),
      "utf-8"
    );

    const hmac = crypto.createHmac("sha256", appSecret);
    const digestString = hmac.update(rawBody).digest("hex");
    const digestBuffer = Buffer.from(digestString, "utf-8");

    if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
      console.error("Error: Request Signature did not match");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
};

// Legacy function names for backward compatibility
const decryptFlowRequest = (
  encryptedFlowData,
  encryptedAesKey,
  initialVector,
  privateKeyPem,
  passphrase = ""
) => {
  const body = {
    encrypted_aes_key: encryptedAesKey,
    encrypted_flow_data: encryptedFlowData,
    initial_vector: initialVector,
  };
  return decryptRequest(body, privateKeyPem, passphrase);
};

const encryptFlowResponse = encryptResponse;

module.exports = {
  decryptRequest,
  encryptResponse,
  decryptFlowRequest,
  encryptFlowResponse,
  generateKeyPair,
  validateSignature,
  FlowEndpointException,
};
