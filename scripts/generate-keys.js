const { generateKeyPair } = require("../utils/encryption");
const fs = require("fs");
const path = require("path");

console.log("🔑 Generating RSA Key Pair for WhatsApp Flow Data Endpoint...\n");

try {
  const { privateKey, publicKey } = generateKeyPair();

  // Create keys directory if it doesn't exist
  const keysDir = path.join(__dirname, "../keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
  }

  // Write private key
  const privateKeyPath = path.join(keysDir, "private_key.pem");
  fs.writeFileSync(privateKeyPath, privateKey);
  console.log("✅ Private key saved to:", privateKeyPath);

  // Write public key
  const publicKeyPath = path.join(keysDir, "public_key.pem");
  fs.writeFileSync(publicKeyPath, publicKey);
  console.log("✅ Public key saved to:", publicKeyPath);

  console.log("\n📋 Next Steps:");
  console.log("1. Upload the public key to Meta using their API:");
  console.log("   curl -X POST \\");
  console.log(
    "     https://graph.facebook.com/v18.0/{phone-number-id}/whatsapp_business_public_key \\"
  );
  console.log('     -H "Authorization: Bearer {access-token}" \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(
    '     -d \'{"public_key": "' + publicKey.replace(/\n/g, "\\n") + "\"}'"
  );

  console.log("\n2. Update your config.env with:");
  console.log("   PRIVATE_KEY_PEM=" + privateKey.replace(/\n/g, "\\n"));
  console.log("   APP_SECRET=your_actual_app_secret");

  console.log("\n3. Deploy your backend to fls.emovur.com");

  console.log("\n⚠️  Security Note:");
  console.log("- Keep your private key secure and never share it");
  console.log("- Add keys/ directory to .gitignore");
  console.log("- Use environment variables for production");
} catch (error) {
  console.error("❌ Error generating keys:", error);
  process.exit(1);
}
