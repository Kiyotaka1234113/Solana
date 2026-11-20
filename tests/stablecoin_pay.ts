import * as fs from "fs";
import * as crypto from "crypto";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
  getAccount,
} from "@solana/spl-token";

// Paths & constants
const DEVNET_KEYPAIR_PATH = "C:\\Users\\janto\\OneDrive\\Рабочий стол\\Solana 3\\devnet-keypair.json";
const PROGRAM_ID = new PublicKey("8xSmfQW68bK4GzSfMk2iELyyVuPzdWEokpBHKCtrYjd9");
const PROGRAM_SEED = "invoice";

function discriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const merchantSecret = Uint8Array.from(JSON.parse(fs.readFileSync(DEVNET_KEYPAIR_PATH, "utf-8")));
  const merchant = Keypair.fromSecretKey(merchantSecret);
  const customer = Keypair.generate();

  // Transfer 0.01 SOL from merchant to customer for tx fees
  const transferIx = SystemProgram.transfer({
    fromPubkey: merchant.publicKey,
    toPubkey: customer.publicKey,
    lamports: Math.round(0.01 * 1e9),
  });
  const transferTx = new Transaction().add(transferIx);
  await sendAndConfirmTransaction(conn, transferTx, [merchant]);

  // ---------- Create mUSDC mint ----------
  const mint = await createMint(conn, merchant, merchant.publicKey, null, 6);

  // ATAs for merchant and customer
  const merchantATA = await getOrCreateAssociatedTokenAccount(conn, merchant, mint, merchant.publicKey);
  const customerATA = await getOrCreateAssociatedTokenAccount(conn, merchant, mint, customer.publicKey);

  // Mint 100 mUSDC (100_000_000 lamports) to customer
  await mintTo(conn, merchant, mint, customerATA.address, merchant, 100_000_000);

  // ---------- Create Invoice ----------
  const invoiceId = 1001n;
  const amount = 25_000_000n; // 25.00 mUSDC
  const invoiceIdBuf = Buffer.alloc(8);
  invoiceIdBuf.writeBigUInt64LE(invoiceId);
  const [invoicePDA, invoiceBump] = await PublicKey.findProgramAddress([
    Buffer.from(PROGRAM_SEED),
    merchant.publicKey.toBuffer(),
    invoiceIdBuf,
  ], PROGRAM_ID);

  const createData = Buffer.alloc(8 + 8 + 8);
  discriminator("create_invoice").copy(createData, 0);
  createData.writeBigUInt64LE(invoiceId, 8);
  createData.writeBigUInt64LE(amount, 16);

  const createIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: merchant.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: invoicePDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: createData,
  });

  await sendAndConfirmTransaction(conn, new Transaction().add(createIx), [merchant]);
  console.log("Invoice PDA:", invoicePDA.toBase58());

  // ---------- Solana Pay URI ----------
  const uri = `solana:${merchant.publicKey.toBase58()}?amount=25&spl-token=${mint.toBase58()}&reference=${invoicePDA.toBase58()}&label=AlmaU%20Stablecoin%20Pay&message=Invoice%20%231001`;
  console.log("Solana Pay URI:\n", uri);

  // ---------- Pay Invoice (first time) ----------
  const payData = Buffer.alloc(8);
  discriminator("pay_invoice").copy(payData, 0);

  const payIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: customer.publicKey, isSigner: true, isWritable: true },
      { pubkey: invoicePDA, isSigner: false, isWritable: true },
      { pubkey: customerATA.address, isSigner: false, isWritable: true },
      { pubkey: merchantATA.address, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: payData,
  });

  await sendAndConfirmTransaction(conn, new Transaction().add(payIx), [customer]);
  console.log("First payment succeeded.");

  const custBal1 = (await getAccount(conn, customerATA.address)).amount;
  const merchBal1 = (await getAccount(conn, merchantATA.address)).amount;
  console.log("Balances after first payment (lamports):");
  console.log("  Customer:", custBal1.toString(), "Merchant:", merchBal1.toString());

  // ---------- Attempt double pay ----------
  try {
    await sendAndConfirmTransaction(conn, new Transaction().add(payIx), [customer]);
    console.error("DOUBLE PAY NOT BLOCKED!");
  } catch (err) {
    console.log("DOUBLE PAY BLOCKED as expected. Error contains:", err.message || err);
  }

  const custBal2 = (await getAccount(conn, customerATA.address)).amount;
  const merchBal2 = (await getAccount(conn, merchantATA.address)).amount;
  console.log("Final balances (lamports):");
  console.log("  Customer:", custBal2.toString(), "Merchant:", merchBal2.toString());
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
