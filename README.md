# Solana Practice

Учебный проект по Solana: программы на Rust и Anchor, PDA-профили пользователей, SPL-токены и MVP с токеновыми наградами. Сетевые сценарии используют **Devnet**.

## Технологии

Rust · Anchor 0.30.1 · TypeScript · @solana/web3.js · @solana/spl-token · Metaplex Token Metadata

## Практические работы

| Работа | Что реализовано | Статус |
|---|---|---|
| Основы Rust и CLI | Аккаунты, инструкции, обработка ошибок | Проверено локально |
| Программа Solana на Rust | Точка входа и вывод параметров инструкции | Код подготовлен |
| Anchor Counter | Создание и увеличение счётчика | Контракт готов; текущий тест локальный |
| PDA-профили | Создание и обновление профиля владельцем | Контракт готов; сетевой тест требует доработки |
| Задание 7 — SPL Tokens | Mint, ATA, выпуск, перевод и метаданные | Выполнено в Devnet |
| Задание 8 — Profile Rewards App | Профиль, репутация и награды через CPI | Собрано; локальные тесты пройдены, деплой предстоит |

## Структура проекта

```text
src/main.rs                      # Учебная CLI-демонстрация
src/lib.rs                       # Программа Solana без Anchor
programs/counter/                # Контракт счётчика
programs/profile/                # Контракт PDA-профилей
programs/profile_rewards/        # Контракт Profile Rewards
tests/spl-token.ts               # Интеграционный тест задания 7
tests/mvp.ts                     # Интеграционный тест задания 8
reports/solana/                  # Отчёты по практическим работам
```

## Запуск

Для TypeScript-клиентов необходим Node.js. Для сборки и деплоя контрактов также нужны Rust, Solana CLI и Anchor CLI.

Кошелёк по умолчанию загружается из `devnet-keypair.json` в корне проекта. Его необходимо пополнить тестовыми SOL в Devnet. Закрытые ключи следует хранить локально.

```bash
npm install
npx tsc --noEmit
npx ts-node tests/spl-token.ts
```

Для MVP после подготовки локальных ключей и настройки адресов:

```bash
anchor build --program-name profile_rewards
anchor deploy --program-name profile_rewards
npx ts-node tests/mvp.ts
```

MVP использует фиксированные Program ID и reward Mint. Для отдельного развёртывания нужно согласовать адреса с созданными ключами в Rust-контракте, `Anchor.toml` и клиентском тесте. Подробности: [README-mvp.md](README-mvp.md).

## Подтверждённый результат задания 7

Создан **Anchor Assignment Token (AAT)** с `decimals = 6`. Выпущено 1000 токенов, из которых 250 переведены получателю. Метаданные привязаны через Metaplex Token Metadata Program.

```text
Token Mint:   EpzAym5odoPL4iFEkTKUUsBiCgsi9o7qcngnnZCtEozA
Sender ATA:   FXV9hw41DxZ1oDc58zQW67zDGX5taUcLV1Ts2BAV2KAH
Receiver ATA: Huo1ZtS9JYN1Pce7Sh1u8dHgwmBsJzTUnwCnrwmHfefg
```

Балансы **750 AAT** и **250 AAT** считаны из сети и проверены через `assert.strictEqual`. Транзакции выпуска, перевода и создания метаданных подтверждены.

## Отчёты

- [Сводка и отдельные отчёты](reports/solana/README.md)
- [Общий отчёт в Word](reports/solana/Solana-practical-report.docx)
