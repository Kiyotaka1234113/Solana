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
