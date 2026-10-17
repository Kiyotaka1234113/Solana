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
