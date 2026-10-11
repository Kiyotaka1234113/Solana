use std::fmt;

/// Enum Instruction с двумя вариантами:
/// - Transfer { amount: u64 }
/// - CustomLog(String)
#[derive(Debug)]
pub enum Instruction {
    Transfer { amount: u64 },
    CustomLog(String),
}

/// Struct Account с полями pubkey и balance
#[derive(Debug)]
pub struct Account {
    pub pubkey: String,
    pub balance: u64,
}

/// Кастомный тип ошибки CustomError::InsufficientBalance с реализацией std::fmt::Display
#[derive(Debug)]
pub enum CustomError {
    InsufficientBalance { requested: u64, available: u64 },
}

impl fmt::Display for CustomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CustomError::InsufficientBalance { requested, available } => {
                write!(
                    f,
                    "InsufficientBalance: requested {} SOL, but only {} SOL available",
                    requested, available
                )
            }
        }
    }
}

impl std::error::Error for CustomError {}

/// Функция process_transfer уменьшает баланс аккаунта или возвращает ошибку,
/// если средств недостаточно.
pub fn process_transfer(account: &mut Account, amount: u64) -> Result<(), CustomError> {
    if account.balance < amount {
        Err(CustomError::InsufficientBalance {
            requested: amount,
            available: account.balance,
        })
    } else {
        account.balance -= amount;
        println!(
            "[SUCCESS] Перевод на сумму {} SOL выполнен. Аккаунт: {}. Новый баланс: {} SOL",
            amount, account.pubkey, account.balance
        );
        Ok(())
    }
}

/// Функция process_instruction использует match для обработки вариантов Instruction
pub fn process_instruction(
    account: &mut Account,
    instruction: Instruction,
) -> Result<(), CustomError> {
    match instruction {
        Instruction::Transfer { amount } => {
            println!("\n[INSTRUCTION] Обработка Перевода (Transfer) на {} SOL...", amount);
            process_transfer(account, amount)
        }
        Instruction::CustomLog(msg) => {
            println!("\n[INSTRUCTION] Обработка Кастомного Лога (CustomLog):");
            println!("   LOG: \"{}\"", msg);
            Ok(())
        }
    }
}

fn main() {
    println!("==================================================");
    println!("   Solana Basic Concepts CLI Demonstration");
    println!("==================================================");

    // 1. Создаем тестовый аккаунт с начальным балансом 10 SOL
    let mut account = Account {
        pubkey: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU".to_string(),
        balance: 10,
    };

    println!(
        "\nСоздан тестовый аккаунт:\n - Pubkey: {}\n - Баланс: {} SOL",
        account.pubkey, account.balance
    );

    // 2. Выполняем успешный перевод 3 SOL
    let success_transfer = Instruction::Transfer { amount: 3 };
    if let Err(err) = process_instruction(&mut account, success_transfer) {
        println!("[ERROR] {}", err);
    }

    // 3. Вызываем CustomLog с произвольным сообщением
    let log_instruction = Instruction::CustomLog(
        "Привет, Solana! Инструкция успешно обработана в программе.".to_string(),
    );
    if let Err(err) = process_instruction(&mut account, log_instruction) {
        println!("[ERROR] {}", err);
    }

    // 4. Пробуем выполнить перевод на сумму 20 SOL (превышающую баланс) и обрабатываем ошибку
    let failed_transfer = Instruction::Transfer { amount: 20 };
    match process_instruction(&mut account, failed_transfer) {
        Ok(_) => println!("[SUCCESS] Перевод выполнен успешно."),
        Err(err) => println!("[ERROR HANDLED] Поймана ожидаемая ошибка:\n   -> {}", err),
    }

    println!("\n--------------------------------------------------");
    println!("Итоговое состояние аккаунта: {:?}", account);
    println!("==================================================");
}
