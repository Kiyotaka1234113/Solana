import * as anchor from "@coral-xyz/anchor";
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const ROOT = path.resolve(__dirname, "..");
const PROGRAM_ID = new PublicKey("Cf2wLYFB3PQKJKDBuszFoAjdvKE8vjaziFLM2TkGZ62T");
const REWARD_MINT = new PublicKey("ER68vjbbokgZpF8JDvFgHqMD1RUUzDUjrLg3ChgacDD2");
const DECIMALS = 6;
const REWARD_AMOUNT = 10n * 10n ** BigInt(DECIMALS);
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

type ProfileState = {
  user: PublicKey;
  name: string;
  reputation: anchor.BN;
  bump: number;
};

function readKeypair(file: string): Keypair {
  const expanded = file.startsWith("~/") || file.startsWith("~\\")
    ? path.join(os.homedir(), file.slice(2))
    : file;
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(expanded, "utf8"))),
  );
}

async function main(): Promise<void> {
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL ?? clusterApiUrl("devnet"),
    "confirmed",
  );
  assert.strictEqual(await connection.getGenesisHash(), DEVNET_GENESIS_HASH,
    "This integration test is restricted to Devnet.");
  const payer = readKeypair(process.env.ANCHOR_WALLET ?? path.join(ROOT, "devnet-keypair.json"));
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const executable = await connection.getAccountInfo(PROGRAM_ID);
  assert.ok(executable?.executable, "Deploy profile_rewards to Devnet before running this test.");
  const idlFile = path.join(ROOT, "target/idl/profile_rewards.json");
  assert.ok(fs.existsSync(idlFile), "Build the program first to generate its IDL.");
  const idl = JSON.parse(fs.readFileSync(idlFile, "utf8")) as anchor.Idl;
  assert.strictEqual(idl.address, PROGRAM_ID.toBase58());
  const program = new anchor.Program(idl, provider);

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDirectory = path.join(ROOT, ".local/profile-rewards/runs", runId);
  fs.mkdirSync(runDirectory, { recursive: true });
  const logLines: string[] = [];
  const log = (line: string): void => {
    console.log(line);
    logLines.push(line);
    fs.writeFileSync(path.join(runDirectory, "mvp.log"), logLines.join("\n") + "\n");
  };

  log("Profile Rewards MVP - Devnet integration test");
  log(`Program ID: ${PROGRAM_ID.toBase58()}`);
  log(`Payer: ${payer.publicKey.toBase58()}`);

  const [rewardAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("reward_authority")], PROGRAM_ID,
  );
  if (!(await connection.getAccountInfo(REWARD_MINT))) {
    const mintKeypair = readKeypair(path.join(ROOT, ".local/profile-rewards/reward-mint-keypair.json"));
    assert.ok(mintKeypair.publicKey.equals(REWARD_MINT), "Reward mint keypair mismatch.");
    await createMint(connection, payer, rewardAuthority, null, DECIMALS, mintKeypair,
      { commitment: "confirmed" });
    log("[OK] Reward mint created, decimals = 6, mint authority = program PDA");
  } else {
    log("[OK] Existing reward mint loaded");
  }
  const mintBefore = await getMint(connection, REWARD_MINT, "confirmed");
  assert.strictEqual(mintBefore.decimals, DECIMALS);
  assert.ok(mintBefore.mintAuthority?.equals(rewardAuthority));
  assert.strictEqual(mintBefore.freezeAuthority, null);

  // Persist each test user's key so earned tokens remain accessible after the run.
  const user = Keypair.generate();
  fs.writeFileSync(path.join(runDirectory, "user-keypair.json"),
    JSON.stringify(Array.from(user.secretKey)), { flag: "wx", mode: 0o600 });
  const fundSignature = await provider.sendAndConfirm(new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: user.publicKey,
      lamports: Math.round(0.01 * LAMPORTS_PER_SOL),
    }),
  ));
  const [profilePda, profileBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), user.publicKey.toBuffer()], PROGRAM_ID,
  );
  const ata = await getOrCreateAssociatedTokenAccount(
    connection, payer, REWARD_MINT, user.publicKey, false, "confirmed",
    { commitment: "confirmed" },
  );
  assert.strictEqual(ata.amount, 0n);
  log("[OK] New test user funded and reward ATA created, balance = 0");

  const initializeAccounts = {
    userProfile: profilePda,
    user: user.publicKey,
    systemProgram: SystemProgram.programId,
  };
  const completeAccounts = {
    userProfile: profilePda,
    user: user.publicKey,
    rewardMint: REWARD_MINT,
    rewardAuthority,
    userAta: ata.address,
    tokenProgram: TOKEN_PROGRAM_ID,
  };
  const readProfile = async (): Promise<ProfileState> => {
    const account = await connection.getAccountInfo(profilePda, "confirmed");
    assert.ok(account, "Profile PDA was not created.");
    assert.ok(account.owner.equals(PROGRAM_ID), "Profile has an unexpected owner.");
    return program.coder.accounts.decode<ProfileState>("userProfile", account.data);
  };
  const expectRejection = async (
    action: () => Promise<unknown>, expectedCodes: string[], description: string,
  ): Promise<void> => {
    await assert.rejects(action, (error: unknown) => {
      if (!(error instanceof anchor.AnchorError)) return false;
      return expectedCodes.includes(error.error.errorCode.code);
    }, description);
    log(`[OK] Rejected: ${description}`);
  };

  await expectRejection(() => program.methods.initializeUser(" ")
    .accountsStrict(initializeAccounts).signers([user]).simulate(),
  ["EmptyName"], "empty profile name");
  await expectRejection(() => program.methods.initializeUser("a".repeat(33))
    .accountsStrict(initializeAccounts).signers([user]).simulate(),
  ["NameTooLong"], "profile name exceeding 32 bytes");
  assert.strictEqual(await connection.getAccountInfo(profilePda), null);

  const initializeSignature = await program.methods.initializeUser("Alice Rewards")
    .accountsStrict(initializeAccounts).signers([user]).rpc();
  const initialized = await readProfile();
  assert.strictEqual(initialized.reputation.toString(), "0");
  assert.ok(initialized.user.equals(user.publicKey));
  assert.strictEqual(initialized.name, "Alice Rewards");
  assert.strictEqual(initialized.bump, profileBump);
  log("[OK] initialize_user confirmed; on-chain reputation = 0");

  await expectRejection(() => program.methods.completeTask()
    .accountsStrict({ ...completeAccounts, user: payer.publicKey }).simulate(),
  ["ConstraintSeeds", "Unauthorized"], "another wallet using this profile");

  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, REWARD_MINT, payer.publicKey, false, "confirmed",
    { commitment: "confirmed" },
  );
  await expectRejection(() => program.methods.completeTask()
    .accountsStrict({ ...completeAccounts, userAta: payerAta.address })
    .signers([user]).simulate(),
  ["ConstraintTokenOwner", "ConstraintAssociated", "ConstraintAssociatedTokenTokenProgram"],
  "reward sent to another user's ATA");

  // A real but unrelated mint exercises the address constraint, not deserialization.
  const otherMint = await createMint(connection, payer, rewardAuthority, null, DECIMALS,
    undefined, { commitment: "confirmed" });
  await expectRejection(() => program.methods.completeTask()
    .accountsStrict({ ...completeAccounts, rewardMint: otherMint })
    .signers([user]).simulate(),
  ["InvalidRewardMint"], "unrelated reward mint");
  assert.strictEqual((await readProfile()).reputation.toString(), "0");
  assert.strictEqual((await getAccount(connection, ata.address)).amount, 0n);

  const completeSignature = await program.methods.completeTask()
    .accountsStrict(completeAccounts).signers([user]).rpc();
  const profile = await readProfile();
  const rewardAccount = await getAccount(connection, ata.address, "confirmed");
  const mintAfter = await getMint(connection, REWARD_MINT, "confirmed");
  assert.strictEqual(profile.reputation.toNumber(), 10, "Reputation must be 10.");
  assert.strictEqual(rewardAccount.amount, REWARD_AMOUNT, "Reward must be 10 tokens.");
  assert.ok(rewardAccount.owner.equals(user.publicKey));
  assert.ok(rewardAccount.mint.equals(REWARD_MINT));
  assert.strictEqual(mintAfter.supply - mintBefore.supply, REWARD_AMOUNT);
  log("[OK] complete_task confirmed; SPL Token mint_to CPI succeeded");
  log("[ASSERT PASSED] On-chain reputation = 10");
  log("[ASSERT PASSED] Reward ATA balance = 10 (10000000 base units)");
  log("[ASSERT PASSED] Mint supply increased by exactly 10 tokens");

  const transactionOptions = {
    commitment: "confirmed", maxSupportedTransactionVersion: 0,
  } as const;
  let confirmed = await connection.getTransaction(completeSignature, transactionOptions);
  for (let attempt = 0; !confirmed && attempt < 5; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    confirmed = await connection.getTransaction(completeSignature, transactionOptions);
  }
  assert.ok(confirmed?.meta, "Confirmed transaction metadata must be available.");
  assert.strictEqual(confirmed.meta.err, null);
  assert.ok(confirmed.meta.logMessages?.some(line => line.includes("Instruction: MintTo")),
    "The transaction must include the SPL Token mint_to CPI.");
  log("--- complete_task on-chain logs ---");
  for (const line of confirmed.meta.logMessages ?? []) log(line);

  const result = {
    cluster: "devnet", programId: PROGRAM_ID.toBase58(),
    rewardMint: REWARD_MINT.toBase58(), rewardAuthority: rewardAuthority.toBase58(),
    user: user.publicKey.toBase58(), profilePda: profilePda.toBase58(),
    userAta: ata.address.toBase58(), reputation: profile.reputation.toNumber(),
    rewardTokens: Number(rewardAccount.amount) / 10 ** DECIMALS,
    rewardBaseUnits: rewardAccount.amount.toString(),
    signatures: { funding: fundSignature, initializeUser: initializeSignature, completeTask: completeSignature },
  };
  fs.writeFileSync(path.join(runDirectory, "result.json"), JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(path.join(ROOT, ".local/profile-rewards/latest-result.json"),
    JSON.stringify(result, null, 2) + "\n");
  log(`Reward Mint: ${result.rewardMint}`);
  log(`User: ${result.user}`);
  log(`Profile PDA: ${result.profilePda}`);
  log(`User ATA: ${result.userAta}`);
  log(`initialize_user signature: ${initializeSignature}`);
  log(`complete_task signature: ${completeSignature}`);
  log("[SUCCESS] Profile Rewards MVP passed all Devnet checks");
  console.log(`Saved log: ${path.join(runDirectory, "mvp.log")}`);
}

main().catch((error: unknown) => {
  console.error("[FAILED] Profile Rewards MVP:", error);
  process.exitCode = 1;
});
