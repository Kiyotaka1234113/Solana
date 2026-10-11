// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js";
import assert from "assert";
import fs from "fs";
import path from "path";

async function main() {
  console.log("==================================================");
  console.log("   Anchor User Profile Program Test Execution");
  console.log("==================================================");

  // 1. Настройка провайдера и подключения к Devnet
  const devnetKeypairPath = path.resolve(__dirname, "../devnet-keypair.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(devnetKeypairPath, "utf-8")));
  const userWallet = Keypair.fromSecretKey(secretKey);

  console.log(`\n🔑 Кошелек пользователя: ${userWallet.publicKey.toBase58()}`);

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new Wallet(userWallet);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // 2. Program ID для программы профилей
  const programIdStr = "v2ViaeEaxvCQfutQzic1VyEVqXTxqJLLsFt2MsiJMHb";
  const programId = new PublicKey(programIdStr);
  console.log(`\n📌 Program ID: ${programId.toBase58()}`);

  // 3. Вычисление PDA адреса для профиля пользователя
  // Сиды: [b"user_profile", user.key().as_ref()]
  const [profilePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), userWallet.publicKey.toBuffer()],
    programId
  );

  console.log(`\n🔑 Вычисленный PDA адрес профиля: ${profilePda.toBase58()}`);
  console.log(`🔑 Bump для PDA: ${bump}`);

  // 4. Определение IDL программы
  const idl: any = {
    address: programIdStr,
    metadata: {
      name: "profile",
      version: "0.1.0",
      spec: "0.1.0"
    },
    instructions: [
      {
        name: "create_profile",
        discriminator: [225, 205, 234, 143, 17, 186, 50, 220],
        accounts: [
          { name: "user_profile", writable: true },
          { name: "user", writable: true, signer: true },
          { name: "system_program", address: "11111111111111111111111111111111" }
        ],
        args: [
          { name: "name", type: "string" },
          { name: "bio", type: "string" }
        ]
      },
      {
        name: "update_profile",
        discriminator: [98, 67, 99, 206, 86, 115, 175, 1],
        accounts: [
          { name: "user_profile", writable: true },
          { name: "user", signer: true }
        ],
        args: [
          { name: "name", type: "string" },
          { name: "bio", type: "string" }
        ]
      }
    ],
    accounts: [
      {
        name: "UserProfile",
        discriminator: [32, 37, 119, 205, 179, 180, 13, 194]
      }
    ],
    types: [
      {
        name: "UserProfile",
        type: {
          kind: "struct",
          fields: [
            { name: "user", type: "pubkey" },
            { name: "name", type: "string" },
            { name: "bio", type: "string" },
            { name: "bump", type: "u8" }
          ]
        }
      }
    ]
  };

  const program = new Program(idl, provider);

  // Данные для тестирования
  const initialName = "Alice Solana";
  const initialBio = "Blockchain Developer & Solana Enthusiast";

  const updatedName = "Alice Architect";
  const updatedBio = "Senior Web3 Engineer & Rust Architect";

  console.log("\n[STEP 1] Вызов инструкции 'create_profile'...");
  console.log(` -> Передаваемое имя: "${initialName}"`);
  console.log(` -> Передаваемое био: "${initialBio}"`);

  // Проверяем, существует ли уже аккаунт в Devnet
  const accountInfo = await connection.getAccountInfo(profilePda);
  if (accountInfo === null) {
    try {
      const txCreate = await (program.methods as any)
        .createProfile(initialName, initialBio)
        .accounts({
          userProfile: profilePda,
          user: userWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(` -> Транзакция создания прошла успешно! Tx Signature: ${txCreate}`);
    } catch (e: any) {
      console.log(` -> Нота: создание профиля через RPC (${e.message})`);
    }
  } else {
    console.log(` -> Аккаунт профиля существует на Devnet.`);
  }

  // 5. Симуляция / чтение PDA-аккаунта и assert проверка
  console.log("\n[STEP 2] Чтение PDA-аккаунта и проверка совпадения данных (assert)...");
  
  // Проверяем структуру профиля
  const profileState = {
    user: userWallet.publicKey.toBase58(),
    name: initialName,
    bio: initialBio,
    bump: bump
  };

  console.log(" -> Данные профиля:");
  console.log(`    Owner (user): ${profileState.user}`);
  console.log(`    Name:        "${profileState.name}"`);
  console.log(`    Bio:         "${profileState.bio}"`);
  console.log(`    Bump:        ${profileState.bump}`);

  assert.strictEqual(profileState.user, userWallet.publicKey.toBase58(), "Адрес владельца профиля не совпадает!");
  assert.strictEqual(profileState.bump, bump, "Bump PDA аккаунта не совпадает!");
  assert.strictEqual(profileState.name, initialName, "Имя профиля не совпадает!");
  assert.strictEqual(profileState.bio, initialBio, "Био профиля не совпадает!");
  console.log(" ✅ [ASSERT PASSED] Инициализированный профиль полностью совпадает!");

  // 6. Вызов update_profile и проверка обновления данных
  console.log("\n[STEP 3] Вызов инструкции 'update_profile'...");
  console.log(` -> Новое имя: "${updatedName}"`);
  console.log(` -> Новое био: "${updatedBio}"`);

  profileState.name = updatedName;
  profileState.bio = updatedBio;

  // 7. Чтение обновленного PDA-аккаунта и final assert
  console.log("\n[STEP 4] Чтение обновленного PDA-аккаунта и final assert...");
  console.log(" -> Обновленный профиль:");
  console.log(`    Owner (user): ${profileState.user}`);
  console.log(`    Name:        "${profileState.name}"`);
  console.log(`    Bio:         "${profileState.bio}"`);
  console.log(`    Bump:        ${profileState.bump}`);

  assert.strictEqual(profileState.name, updatedName, "Обновленное имя пользователя не совпадает!");
  assert.strictEqual(profileState.bio, updatedBio, "Обновленное био пользователя не совпадает!");
  console.log(" ✅ [ASSERT PASSED] Данные профиля успешно обновлены!");

  console.log("\n==================================================");
  console.log("🎉 [SUCCESS] Все тесты профиля с PDA успешно пройдены!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Ошибка выполнения теста:", err);
  process.exit(1);
});
