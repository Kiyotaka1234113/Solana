# Отчёт по практическим работам Solana

Дата проверки: 11 октября 2026 года

В проекте подготовлены шесть практических работ. Рабочий сценарий SPL-токена подтверждён в Devnet, а демонстрация Rust CLI выполнена локально. Для четырёх остальных работ завершение сетевого сценария ещё требуется. В текущей переписке отдельно поставлены задания 7 и 8: задание 7 выполнено, задание 8 реализовано и собрано, но ещё не развёрнуто в Devnet.

## Сводка

| Работа | Содержание | Проверка |
|---|---|---|
| Основы Rust и CLI | Аккаунт, инструкции и обработка ошибки | Локальный запуск успешен |
| Программа Solana на Rust | Точка входа и журнал инструкции | Исходники готовы; деплой не подтверждён |
| Anchor Counter | Инициализация и увеличение счётчика | Контракт готов; тест локальный |
| Профиль пользователя и PDA | Создание и обновление профиля | Контракт готов; сетевой тест не завершён |
| Задание 7 SPL Tokens | Mint, ATA, выпуск, перевод и метаданные | Выполнено в Devnet |
| Задание 8 Profile Rewards | PDA, репутация и токеновые награды через CPI | Сборка и локальные тесты пройдены; деплой ожидается |

Повторная проверка Devnet подтвердила балансы задания 7 и успешное завершение трёх транзакций со статусом finalized. Аккаунты программ Counter, Profile и Profile Rewards по указанным в проекте адресам сейчас отсутствуют. Для MVP также ещё не создан reward mint.

## Отдельные отчёты

- [Основы Rust и CLI](rust-cli.md)
- [Программа Solana на Rust](solana-rust-program.md)
- [Anchor Counter](anchor-counter.md)
- [Профиль пользователя и PDA](pda-profile.md)
- [Задание 7 SPL Tokens и метаданные](assignment-07-spl-token.md)
- [Задание 8 Profile Rewards App](assignment-08-profile-rewards.md)

# Основы Rust и CLI

**Статус:** Реализовано и проверено локальным запуском демонстрационного бинарного файла.

## Цель

Изучить структуры, перечисления, обработку инструкций через match и возврат ошибок в Rust на примере упрощённого аккаунта.

## Реализация

В src/main.rs определены Account с публичным адресом и балансом, Instruction с вариантами Transfer и CustomLog, а также CustomError::InsufficientBalance. Функция process_transfer проверяет наличие средств и уменьшает баланс. Ошибки возвращаются через Result и имеют читаемое описание благодаря реализации Display.

## Сценарий

Демонстрация создаёт локальный аккаунт с балансом 10, обрабатывает перевод 3, выводит пользовательское сообщение и пытается списать 20. Первая операция оставляет баланс 7; вторая возвращает ошибку и не меняет баланс.

## Результат

Существующий solana-cli-demo.exe выполнен повторно с кодом завершения 0. Итоговый баланс равен 7; нехватка средств обработана штатно. Это модель поведения в памяти процесса: реальные SOL не переводятся, второй аккаунт получателя не используется.

## Файлы

- `src/main.rs`
- `Cargo.toml`

## Команды

```text
cargo run --bin solana-cli-demo
```

## Результаты проверки

```text
Transfer 3: balance 10 -> 7
CustomLog: message printed
InsufficientBalance: requested 20 SOL, but only 7 SOL available
Final local balance: 7
Process exit code: 0
```

## Итог и оставшиеся шаги

Для этой локальной демонстрации сценарий завершён. Числа в выводе описывают учебную модель, а не подтверждённые балансы Solana.


# Программа Solana на Rust

**Статус:** Исходный код программы подготовлен. Выполнение инструкции в Devnet не подтверждено.

## Цель

Реализовать минимальную программу Solana без Anchor и понять назначение Program ID, аккаунтов и данных инструкции.

## Реализация

В src/lib.rs используется entrypoint!(process_instruction). Обработчик принимает ссылку на Program ID, массив AccountInfo и байты instruction_data. Через msg! программа выводит приветствие, адрес программы, число переданных аккаунтов и длину данных инструкции, затем возвращает Ok(()). Подключена зависимость solana-program ветки 1.18.

## Сценарий

Клиент должен отправить инструкцию развёрнутой программе и прочитать её журнал транзакции. Текущий обработчик показывает входные параметры; хранение состояния, перевод средств и десериализация команд в нём не реализованы.

## Результат

Подготовленный публичный ключ program-keypair.json равен ExWUjutj1dW4nH7YW2wwCr5cDwhgm47siiCzpQSLeFZZ. При повторной проверке Devnet аккаунт по этому адресу отсутствовал. Публичный ключ обозначает подготовленный адрес для развёртывания, а не работающую программу.

## Файлы

- `src/lib.rs`
- `Cargo.toml`
- `program-keypair.json (локальный закрытый ключ)`

## Команды

```text
cargo-build-sbf --manifest-path Cargo.toml
solana program deploy target/deploy/solana_cli_demo.so --program-id program-keypair.json --keypair devnet-keypair.json --url devnet
```

## Результаты проверки

```text
Devnet program account: absent
Instruction execution: not verified
```

## Итог и оставшиеся шаги

Необходимо собрать SBF-артефакт этой программы, выполнить деплой, отправить настоящую инструкцию и сохранить сигнатуру и журнал подтверждённой транзакции.


# Anchor Counter

**Статус:** Контракт реализован. Текущий TypeScript-тест проверяет локальный счётчик и не подтверждает работу контракта в сети.

## Цель

Создать первую программу Anchor с состоянием аккаунта и двумя инструкциями для работы со счётчиком.

## Реализация

В programs/counter/src/lib.rs описан аккаунт Counter с полем count: u64. Инструкция initialize создаёт аккаунт за счёт подписанта user и устанавливает count = 0. Инструкция increment увеличивает значение на единицу. Для аккаунта выделено 16 байт: 8 байт дискриминатора Anchor и 8 байт состояния.

## Сценарий

Ожидаемый сетевой сценарий состоит из вызовов initialize и increment, чтения аккаунта Counter и проверки count = 1. В tests/counter.ts сейчас используется let count = 0 и локальное count += 1. RPC-вызовы инструкций и получение сохранённого состояния отсутствуют.

## Результат

Указанный Program ID: 9AdsXdjHeX6smzMa7GFHx5EuswhVKkJ39f5QNr7rj3vM. На дату проверки Devnet аккаунт программы по этому адресу отсутствовал. Сообщение ASSERT PASSED в текущем клиенте относится к локальной переменной.

## Файлы

- `programs/counter/src/lib.rs`
- `programs/counter/Cargo.toml`
- `tests/counter.ts`
- `Anchor.toml`

## Команды

```text
anchor build --program-name counter
anchor deploy --program-name counter
npx ts-node tests/counter.ts
```

## Результаты проверки

```text
Devnet program account: absent
Current test: local count 0 -> 1
On-chain count: not verified
```

## Итог и оставшиеся шаги

Нужно выполнить деплой и заменить локальное изменение count реальными RPC-вызовами и чтением аккаунта через Anchor. Только после этого сетевой тест может подтверждать выполнение работы.


# Профиль пользователя и PDA

**Статус:** Контракт PDA-профилей реализован. Полный цикл создания, обновления и чтения данных в Devnet ещё не подтверждён.

## Цель

Научиться хранить профиль пользователя в детерминированном аккаунте PDA и ограничивать обновление владельцем профиля.

## Реализация

В programs/profile/src/lib.rs описан UserProfile с полями user, name, bio и bump. create_profile создаёт PDA с seeds [b"user_profile", user.key()] и сохраняет данные. update_profile проверяет seeds, bump и has_one = user. Размер имени ограничен 32 байтами UTF-8, bio - 256 байтами. Аккаунт занимает до 337 байт вместе с дискриминатором.

## Сценарий

Ожидаются создание профиля Alice Solana, обновление до Alice Architect и чтение обоих состояний из сети. Текущий tests/profile.ts пытается вызвать createProfile, но перехватывает ошибку и продолжает выполнение. Проверки выполняются над локальным profileState; обновление name и bio также происходит только в этом объекте.

## Результат

Указанный Program ID: v2ViaeEaxvCQfutQzic1VyEVqXTxqJLLsFt2MsiJMHb. Вычисленный PDA для кошелька F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM: HiGqxz9NrKm6ZwSEMju9ef9g82gj3AtoZton3Zpbf3wp. При проверке Devnet оба аккаунта отсутствовали. Вычисление PDA само по себе не создаёт аккаунт.

## Файлы

- `programs/profile/src/lib.rs`
- `programs/profile/Cargo.toml`
- `tests/profile.ts`
- `Anchor.toml`

## Команды

```text
anchor build --program-name profile
anchor deploy --program-name profile
npx ts-node tests/profile.ts
```

## Результаты проверки

```text
Devnet program account: absent
Computed profile PDA account: absent
Current assertions: local profileState
On-chain profile update: not verified
```

## Итог и оставшиеся шаги

Нужно выполнить деплой, вызывать updateProfile через RPC, считывать UserProfile из PDA и завершать тест ошибкой, если создание или обновление не состоялось.


# Задание 7 SPL Tokens и метаданные

**Статус:** Выполнено в Devnet. Балансы, аккаунт метаданных и успешные транзакции повторно проверены.

## Цель

Создать собственный SPL-токен, выпустить 1000 токенов, перевести 250 на второй кошелёк и привязать Name, Symbol и URI через Token Metadata Program.

## Реализация

В tests/spl-token.ts используются @coral-xyz/anchor, @solana/web3.js и @solana/spl-token. Создаётся Mint с decimals = 6, ATA отправителя и получателя, выполняются mintTo и transfer. Метаданные Anchor Assignment Token, символ AAT и URI записываются в PDA программы Metaplex Token Metadata через CreateMetadataAccountV3. Используется классический SPL Token Program; расширения Token-2022 в этом сценарии не включаются.

## Сценарий

После выпуска 1 000 000 000 минимальных единиц и перевода 250 000 000 минимальных единиц клиент читает оба ATA через getAccount и выполняет assert.strictEqual. Повторная проверка не выпускала новые токены и не изменяла балансы.

## Результат

Подтверждённые балансы: отправитель 750 AAT, получатель 250 AAT. Общий выпуск равен 1000 AAT. Аккаунт метаданных существует и принадлежит программе metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s. Транзакции выпуска, перевода и создания метаданных имеют статус finalized и err = null.

## Файлы

- `tests/spl-token.ts`
- `package.json`
- `package-lock.json`

## Адреса

Token Mint: `EpzAym5odoPL4iFEkTKUUsBiCgsi9o7qcngnnZCtEozA`

ATA отправителя: `FXV9hw41DxZ1oDc58zQW67zDGX5taUcLV1Ts2BAV2KAH`

ATA получателя: `Huo1ZtS9JYN1Pce7Sh1u8dHgwmBsJzTUnwCnrwmHfefg`

Metadata PDA: `2FMpeayEudLct3phWuip8UUVSFABPtTUB5BZnLW9T9GW`

## Команды

```text
npx tsc --noEmit
npx ts-node tests/spl-token.ts
```

## Результаты проверки

```text
SPL token workflow completed successfully on devnet
Sender balance: 750
Receiver balance: 250
Mint supply: 1000
Mint / transfer / metadata: finalized, err = null
```

## Транзакции

- [Выпуск токенов](https://explorer.solana.com/tx/3KjJDzZ5bX5NUjcEHWa52RovzLZf1vE8e1yUwEcqibnkiCHHbS1zp7SdiFhomZM9vnPfDE3qnMqj6ussfWJqLRyS?cluster=devnet)
- [Перевод токенов](https://explorer.solana.com/tx/3DsT58Q88TSJE585kVe139m4RjgbXuXeAJHzGZzhCtfv5k1khYiB6jc1dHVS5shDjSMmkynrQh8zVL8JFbw5apWy?cluster=devnet)
- [Создание метаданных](https://explorer.solana.com/tx/iHktQpCnydw2wnC3Pm9whbfqsyJmHyQiZw2vDzPuxCuAYoTF8kj7zsrkaJtQUEZ9b5tMEUAUbhQ7s43w5TV4S1H?cluster=devnet)

## Итог и оставшиеся шаги

Сценарий задания выполнен. URI в текущем коде указывает на PNG-логотип; публикация отдельного JSON-документа с расширенными метаданными этим тестом не проверяется.


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

