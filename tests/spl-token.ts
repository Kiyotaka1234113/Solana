import * as anchor from "@coral-xyz/anchor";
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const DECIMALS = 6;
const TOKEN_FACTOR = 10n ** BigInt(DECIMALS);
const MINT_AMOUNT = 1_000n * TOKEN_FACTOR;
const TRANSFER_AMOUNT = 250n * TOKEN_FACTOR;
const EXPECTED_SENDER_BALANCE = 750n * TOKEN_FACTOR;
const EXPECTED_RECEIVER_BALANCE = 250n * TOKEN_FACTOR;

const TOKEN_NAME = "Anchor Assignment Token";
const TOKEN_SYMBOL = "AAT";
const TOKEN_URI =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

type CreatedMetadata = {
  metadataAddress: PublicKey;
  signature: string;
};

function expandHome(filePath: string): string {
  if (filePath === "~") {
    return os.homedir();
  }

  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  return filePath;
}

function loadKeypairFromFile(filePath: string): Keypair {
  const resolvedPath = expandHome(filePath);
  const secretKey = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as number[];

  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function loadPayer(): Keypair {
  const walletCandidates = [
    process.env.ANCHOR_WALLET,
    process.env.SOLANA_WALLET,
    path.join(process.cwd(), "devnet-keypair.json"),
    path.join(os.homedir(), ".config", "solana", "id.json"),
  ].filter((walletPath): walletPath is string => Boolean(walletPath));

  const walletPath = walletCandidates.find((candidate) =>
    fs.existsSync(expandHome(candidate)),
  );

  if (!walletPath) {
    throw new Error(
      `Wallet keypair not found. Tried: ${walletCandidates.join(", ")}`,
    );
  }

  return loadKeypairFromFile(walletPath);
}

function encodeU16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function encodeU32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function encodeString(value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf8");
  return Buffer.concat([encodeU32(valueBuffer.length), valueBuffer]);
}

function encodeCreateMetadataAccountV3Data(args: {
  name: string;
  symbol: string;
  uri: string;
}): Buffer {
  const instructionDiscriminator = Buffer.from([33]);
  const sellerFeeBasisPoints = encodeU16(0);
  const noCreators = Buffer.from([0]);
  const noCollection = Buffer.from([0]);
  const noUses = Buffer.from([0]);
  const isMutable = Buffer.from([1]);
  const noCollectionDetails = Buffer.from([0]);

  return Buffer.concat([
    instructionDiscriminator,
    encodeString(args.name),
    encodeString(args.symbol),
    encodeString(args.uri),
    sellerFeeBasisPoints,
    noCreators,
    noCollection,
    noUses,
    isMutable,
    noCollectionDetails,
  ]);
}

function findMetadataPda(mint: PublicKey): PublicKey {
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_TOKEN_METADATA_PROGRAM_ID,
  );

  return metadataAddress;
}

async function createTokenMetadata(args: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}): Promise<CreatedMetadata> {
  const metadataAddress = findMetadataPda(args.mint);
  const instruction = new TransactionInstruction({
    programId: METAPLEX_TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataAddress, isSigner: false, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: args.payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: args.payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: args.payer.publicKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: encodeCreateMetadataAccountV3Data({
      name: args.name,
      symbol: args.symbol,
      uri: args.uri,
    }),
  });

  const signature = await sendAndConfirmTransaction(
    args.connection,
    new Transaction().add(instruction),
    [args.payer],
    { commitment: "confirmed" },
  );

  return { metadataAddress, signature };
}

async function ensureDevnetBalance(connection: Connection, payer: PublicKey): Promise<void> {
  const balance = await connection.getBalance(payer, "confirmed");
  const minimumBalance = 0.05 * LAMPORTS_PER_SOL;

  if (balance >= minimumBalance) {
    return;
  }

  let signature: string;
  try {
    signature = await connection.requestAirdrop(payer, 0.1 * LAMPORTS_PER_SOL);
  } catch (error) {
    throw new Error(
      `Payer ${payer.toBase58()} has ${balance / LAMPORTS_PER_SOL} SOL on devnet, ` +
        "and automatic airdrop failed. Fund this address with at least 0.05 devnet SOL and rerun `npx ts-node tests/spl-token.ts`.\n" +
        `Original airdrop error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
}

function asTokenAmount(rawAmount: bigint): string {
  const whole = rawAmount / TOKEN_FACTOR;
  const fractional = rawAmount % TOKEN_FACTOR;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole}.${fractional.toString().padStart(DECIMALS, "0")}`;
}

async function main(): Promise<void> {
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL ?? clusterApiUrl("devnet"),
    "confirmed",
  );
  const payer = loadPayer();
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  await ensureDevnetBalance(connection, payer.publicKey);

  const receiver = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    DECIMALS,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

  const senderAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const receiverAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    receiver.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

  const mintSignature = await mintTo(
    connection,
    payer,
    mint,
    senderAta.address,
    payer,
    Number(MINT_AMOUNT),
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const transferSignature = await transfer(
    connection,
    payer,
    senderAta.address,
    receiverAta.address,
    payer,
    Number(TRANSFER_AMOUNT),
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const metadata = await createTokenMetadata({
    connection,
    payer,
    mint,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: TOKEN_URI,
  });

  const senderAccount = await getAccount(
    connection,
    senderAta.address,
    "confirmed",
    TOKEN_PROGRAM_ID,
  );
  const receiverAccount = await getAccount(
    connection,
    receiverAta.address,
    "confirmed",
    TOKEN_PROGRAM_ID,
  );

  assert.strictEqual(senderAccount.amount, EXPECTED_SENDER_BALANCE);
  assert.strictEqual(receiverAccount.amount, EXPECTED_RECEIVER_BALANCE);

  console.log("SPL token workflow completed successfully on devnet");
  console.log(`Token Mint: ${mint.toBase58()}`);
  console.log(`Sender ATA: ${senderAta.address.toBase58()}`);
  console.log(`Receiver wallet: ${receiver.publicKey.toBase58()}`);
  console.log(`Receiver ATA: ${receiverAta.address.toBase58()}`);
  console.log(`Metadata PDA: ${metadata.metadataAddress.toBase58()}`);
  console.log(`Mint signature: ${mintSignature}`);
  console.log(`Transfer signature: ${transferSignature}`);
  console.log(`Metadata signature: ${metadata.signature}`);
  console.log(`Sender balance: ${asTokenAmount(senderAccount.amount)}`);
  console.log(`Receiver balance: ${asTokenAmount(receiverAccount.amount)}`);
}

main().catch((error) => {
  console.error("SPL token workflow failed");
  console.error(error);
  process.exit(1);
});
