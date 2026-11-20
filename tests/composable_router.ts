import * as fs from "fs";
import * as crypto from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const ROUTER_PROGRAM_ID = new PublicKey("9t56Ysmdii2T2fk6cnXihjW5Q1k7WCCspD7wsMFQzrB4");
const DEFI_SWAP_PROGRAM_ID = new PublicKey("9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM");
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const MINT_A = new PublicKey("6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1");
const MINT_B = new PublicKey("3bgrYo7V5QzKiWHuwZuEnUrLpaoXaPR3FdKZR65gXKeF");
const POOL_PDA = new PublicKey("BqAKfyF2K61DxvfBLMi9WPjYuem6Ni53YMPm2j11bbvE");
const VAULT_A_PDA = new PublicKey("BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F");
const VAULT_B_PDA = new PublicKey("H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp");

const KEYPAIR_PATH = "C:\\Users\\janto\\OneDrive\\Рабочий стол\\Solana 3\\devnet-keypair.json";

function anchorDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")));
  const payer = Keypair.fromSecretKey(secretKey);

  console.log("Wallet:", payer.publicKey.toBase58());
  console.log("Router Program ID:", ROUTER_PROGRAM_ID.toBase58());
  console.log("defi_swap Program ID:", DEFI_SWAP_PROGRAM_ID.toBase58());
  console.log("SPL Memo Program ID:", MEMO_PROGRAM_ID.toBase58());

  const userAtaA = await getOrCreateAssociatedTokenAccount(connection, payer, MINT_A, payer.publicKey);
  const userAtaB = await getOrCreateAssociatedTokenAccount(connection, payer, MINT_B, payer.publicKey);

  const beforeA = (await getAccount(connection, userAtaA.address)).amount;
  const beforeB = (await getAccount(connection, userAtaB.address)).amount;
  console.log("Before routed swap -> User A:", beforeA.toString(), "User B:", beforeB.toString());

  const memoText = "Week11 CPI: routed swap via defi_swap + SPL Memo";
  const memoBytes = Buffer.from(memoText, "utf-8");

  // Layout: 8-byte disc + u64 amount_in + u64 min_out + u8 a_to_b + u32 memo_len + memo_bytes
  const data = Buffer.alloc(8 + 8 + 8 + 1 + 4 + memoBytes.length);
  anchorDiscriminator("execute_routed_swap").copy(data, 0);
  data.writeBigUInt64LE(10_000_000n, 8);
  data.writeBigUInt64LE(1n, 16);
  data.writeUInt8(1, 24);
  data.writeUInt32LE(memoBytes.length, 25);
  memoBytes.copy(data, 29);

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: POOL_PDA, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: userAtaA.address, isSigner: false, isWritable: true },
      { pubkey: userAtaB.address, isSigner: false, isWritable: true },
      { pubkey: VAULT_A_PDA, isSigner: false, isWritable: true },
      { pubkey: VAULT_B_PDA, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: DEFI_SWAP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
  console.log("Routed swap CPI tx:", sig);
  console.log("Explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  const afterA = (await getAccount(connection, userAtaA.address)).amount;
  const afterB = (await getAccount(connection, userAtaB.address)).amount;
  console.log("After routed swap  -> User A:", afterA.toString(), "User B:", afterB.toString());
  console.log("Delta A:", (afterA - beforeA).toString(), "Delta B:", (afterB - beforeB).toString());

  const txInfo = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  console.log("\n=== On-chain CPI Logs ===");
  (txInfo?.meta?.logMessages || []).forEach((line) => console.log(line));

  if (afterB <= beforeB) {
    throw new Error("Routed swap failed: User B balance did not increase");
  }
  console.log("\nSUCCESS: Composable CPI (composable_router -> defi_swap -> SPL Token + SPL Memo) verified on Devnet!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
