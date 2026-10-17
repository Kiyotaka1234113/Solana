# Задание 8 Profile Rewards App

**Статус:** Реализованы контракт и клиент; SBF-сборка и локальные Rust-тесты прошли. Деплой и полный Devnet-сценарий пока не выполнены.

## Цель

Объединить PDA-профиль, репутацию и токеновые награды в первом Web3 MVP на Anchor.

## Реализация

UserProfile содержит user: Pubkey, name: String, reputation: u64 и bump: u8. initialize_user создаёт PDA с репутацией 0. complete_task проверяет владельца профиля, фиксированный reward mint и ATA, затем через подписанный CPI mint_to выпускает 10 токенов и увеличивает репутацию на 10. Mint authority - PDA [b"reward_authority"]. Используются 6 decimals и checked_add для защиты от переполнения. Размер аккаунта профиля с дискриминатором - 85 байт.

## Сценарий

tests/mvp.ts проверяет сеть Devnet, создаёт или загружает reward mint, генерирует нового пользователя, создаёт ATA, вызывает initializeUser и completeTask, затем читает реальные аккаунты. Подготовлены assert для reputation = 10, баланса 10 000 000 минимальных единиц и прироста supply на 10 токенов. Дополнительно проверяется отказ для пустого или длинного имени, чужого профиля, чужого ATA и другого mint.

## Результат

Собран target/deploy/profile_rewards.so размером 202 432 байта. Ранее успешно выполнены 3 локальных Rust-теста: test_id, проверка UTF-8-размера имени и защита репутации от переполнения. Проверка TypeScript прошла. Anchor CLI 0.30.1 установлен. На дату отчёта программа и reward mint в Devnet отсутствуют; итоговый IDL-файл target/idl/profile_rewards.json ещё не сохранён.

## Файлы

- `programs/profile_rewards/src/lib.rs`
- `programs/profile_rewards/Cargo.toml`
- `tests/mvp.ts`
- `scripts/build-mvp.ps1`
- `scripts/deploy-mvp.ps1`
- `README-mvp.md`

## Адреса

Подготовленный Program ID: `Cf2wLYFB3PQKJKDBuszFoAjdvKE8vjaziFLM2TkGZ62T`

Подготовленный reward Mint: `ER68vjbbokgZpF8JDvFgHqMD1RUUzDUjrLg3ChgacDD2`

## Команды

```text
./scripts/build-mvp.ps1
./scripts/deploy-mvp.ps1
npx ts-node tests/mvp.ts
```

## Результаты проверки

```text
SBF build: success; profile_rewards.so = 202432 bytes
Rust tests: 3 passed; 0 failed
TypeScript typecheck: passed
Devnet program: absent
Reward mint: absent
Full MVP integration test: not completed
```

## Итог и оставшиеся шаги

На Devnet-кошельке F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM осталось 0,48218752 SOL. Предыдущая оценка бюджета деплоя с буфером - около 2,09 тестовых SOL. Требуется пополнение примерно на 2 тестовых SOL, сохранение IDL, деплой и запуск полного теста. После этого будут получены созданные адреса PDA и ATA и подтверждены награды. В учебном MVP каждый подписанный вызов complete_task считается отдельной задачей.
