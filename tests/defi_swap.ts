import * as fs from "fs";
import * as crypto from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";

const PROGRAM_ID = new PublicKey("9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM");
const KEYPAIR_PATH = "C:\\Users\\janto\\OneDrive\\Рабочий стол\\Solana 3\\devnet-keypair.json";

function anchorDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")));
  const payer = Keypair.fromSecretKey(secretKey);

  console.log("Wallet:", payer.publicKey.toBase58());
  console.log("Program ID:", PROGRAM_ID.toBase58());

  // 1. Create Token A and Token B mints
  const mintA = await createMint(connection, payer, payer.publicKey, null, 6);
  const mintB = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log("Mint A:", mintA.toBase58());
  console.log("Mint B:", mintB.toBase58());

  // 2. Derive PDAs
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
    PROGRAM_ID
  );
  const [vaultAPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_a"), poolPda.toBuffer()],
    PROGRAM_ID
  );
  const [vaultBPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_b"), poolPda.toBuffer()],
    PROGRAM_ID
  );
  console.log("Pool PDA:", poolPda.toBase58());
  console.log("Vault A PDA:", vaultAPda.toBase58());
  console.log("Vault B PDA:", vaultBPda.toBase58());

  // 3. initialize_pool(fee_bps = 30)
  const initData = Buffer.alloc(10);
  anchorDiscriminator("initialize_pool").copy(initData, 0);
  initData.writeUInt16LE(30, 8);

  const initIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: mintA, isSigner: false, isWritable: false },
      { pubkey: mintB, isSigner: false, isWritable: false },
      { pubkey: vaultAPda, isSigner: false, isWritable: true },
      { pubkey: vaultBPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: initData,
  });

  const initSig = await sendAndConfirmTransaction(connection, new Transaction().add(initIx), [payer]);
  console.log("initialize_pool tx:", initSig);

  // 4. Create user ATAs, mint tokens, and seed initial liquidity into vault_a and vault_b
  const userAtaA = await getOrCreateAssociatedTokenAccount(connection, payer, mintA, payer.publicKey);
  const userAtaB = await getOrCreateAssociatedTokenAccount(connection, payer, mintB, payer.publicKey);

  await mintTo(connection, payer, mintA, userAtaA.address, payer, 2_000_000_000n);
  await mintTo(connection, payer, mintB, userAtaB.address, payer, 2_000_000_000n);

  const liqASig = await transfer(connection, payer, userAtaA.address, vaultAPda, payer, 1_000_000_000n);
  const liqBSig = await transfer(connection, payer, userAtaB.address, vaultBPda, payer, 1_000_000_000n);
  console.log("Liquidity A tx:", liqASig);
  console.log("Liquidity B tx:", liqBSig);

  const beforeA = (await getAccount(connection, userAtaA.address)).amount;
  const beforeB = (await getAccount(connection, userAtaB.address)).amount;
  console.log("Before swap -> User A:", beforeA.toString(), "User B:", beforeB.toString());

  // 5. swap(amount_in = 100_000_000, minimum_amount_out = 1, a_to_b = true)
  const swapData = Buffer.alloc(25);
  anchorDiscriminator("swap").copy(swapData, 0);
  swapData.writeBigUInt64LE(100_000_000n, 8);
  swapData.writeBigUInt64LE(1n, 16);
  swapData.writeUInt8(1, 24);

  const swapIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: userAtaA.address, isSigner: false, isWritable: true },
      { pubkey: userAtaB.address, isSigner: false, isWritable: true },
      { pubkey: vaultAPda, isSigner: false, isWritable: true },
      { pubkey: vaultBPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: swapData,
  });

  const swapSig = await sendAndConfirmTransaction(connection, new Transaction().add(swapIx), [payer]);
  console.log("swap tx:", swapSig);

  const afterA = (await getAccount(connection, userAtaA.address)).amount;
  const afterB = (await getAccount(connection, userAtaB.address)).amount;
  console.log("After swap  -> User A:", afterA.toString(), "User B:", afterB.toString());
  console.log("Delta A:", (afterA - beforeA).toString(), "Delta B:", (afterB - beforeB).toString());

  if (afterB <= beforeB) {
    throw new Error("Swap failed: User B balance did not increase");
  }
  console.log("SUCCESS: AMM pool initialized and swap verified on Devnet!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
