import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

async function main() {
  const devnetKeypairPath = path.resolve(__dirname, "../devnet-keypair.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(devnetKeypairPath, "utf-8")));
  const userWallet = Keypair.fromSecretKey(secretKey);

  console.log("Wallet address:", userWallet.publicKey.toBase58());

  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  let balance = await conn.getBalance(userWallet.publicKey);
  console.log(`Current Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("Requesting 1 SOL airdrop...");
    try {
      const sig = await conn.requestAirdrop(userWallet.publicKey, 1 * LAMPORTS_PER_SOL);
      console.log("Airdrop tx sig:", sig);
      await conn.confirmTransaction(sig);
      balance = await conn.getBalance(userWallet.publicKey);
      console.log(`New Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (err: any) {
      console.log("Airdrop failed:", err.message);
    }
  }
}

main();
