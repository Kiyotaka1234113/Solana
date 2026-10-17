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
