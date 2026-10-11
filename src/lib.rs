use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};

// Настройка точки входа в программу Solana через макрос entrypoint!
entrypoint!(process_instruction);

/// Функция обработки инструкций программы (Pure Rust Solana Program)
///
/// # Параметры:
/// - `program_id`: Публичный ключ текущей программы
/// - `accounts`: Массив аккаунтов, переданных в инструкцию
/// - `instruction_data`: Байтовый массив дополнительных данных инструкции
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // 1. Вывод приветственного сообщения
    msg!("Hello from Solana Program!");

    // 2. Вывод Program ID
    msg!("Program ID: {}", program_id);

    // 3. Вывод количества переданных аккаунтов
    msg!("Accounts count: {}", accounts.len());

    // 4. Вывод размера данных инструкций
    msg!("Instruction data size: {} bytes", instruction_data.len());

    Ok(())
}
