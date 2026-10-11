const fs = require("fs");
const path = require("path");
const { Keypair } = require("@solana/web3.js");

const root = path.resolve(__dirname, "..");
for (const relativePath of [
  "target/deploy/profile_rewards-keypair.json",
  ".local/profile-rewards/reward-mint-keypair.json",
  ".local/profile-rewards/deploy-buffer-keypair.json",
]) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const keypair = Keypair.generate();
    fs.writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)), {
      flag: "wx",
      mode: 0o600,
    });
  }
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))),
  );
  console.log(`${relativePath}: ${keypair.publicKey.toBase58()}`);
}
