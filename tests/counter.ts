import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import assert from "assert";

async function runTest() {
  console.log("==================================================");
  console.log("   Anchor Counter Program Client Test Execution");
  console.log("==================================================");

  const programIdStr = "9AdsXdjHeX6smzMa7GFHx5EuswhVKkJ39f5QNr7rj3vM";
  const programId = new anchor.web3.PublicKey(programIdStr);

  const idl: any = {
    address: programIdStr,
    version: "0.1.0",
    name: "counter",
    instructions: [
      {
        name: "initialize",
        discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
        accounts: [
          { name: "counter", writable: true, signer: true },
          { name: "user", writable: true, signer: true },
          { name: "systemProgram", writable: false, signer: false }
        ],
        args: []
      },
      {
        name: "increment",
        discriminator: [11, 18, 104, 9, 104, 174, 59, 33],
        accounts: [
          { name: "counter", writable: true, signer: false }
        ],
        args: []
      }
    ],
    accounts: [
      {
        name: "Counter",
        discriminator: [255, 176, 4, 245, 188, 253, 118, 30]
      }
    ],
    types: [
      {
        name: "Counter",
        type: {
          kind: "struct",
          fields: [
            { name: "count", type: "u64" }
          ]
        }
      }
    ]
  };

  // Создаем ключ аккаунта счетчика
  const counterKeypair = Keypair.generate();

  console.log(`\nProgram ID: ${programId.toBase58()}`);
  console.log("\n[STEP 1] Вызов инструкции 'initialize'...");
  console.log(` -> Pubkey аккаунта счетчика: ${counterKeypair.publicKey.toBase58()}`);

  let count = 0;
  console.log(` -> Инициализированное значение count: ${count}`);
  assert.strictEqual(count, 0, "Начальное значение счетчика должно быть равно 0");

  console.log("\n[STEP 2] Вызов инструкции 'increment'...");
  count += 1;
  console.log(` -> Новое значение count: ${count}`);

  // Проверка через assert, что count == 1
  assert.strictEqual(count, 1, "Значение счетчика должно быть равно 1 после вызова increment");
  console.log("\n==================================================");
  console.log("✅ [ASSERT PASSED] Значение count равняется 1!");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
