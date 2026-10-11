use anchor_lang::prelude::*;

declare_id!("9AdsXdjHeX6smzMa7GFHx5EuswhVKkJ39f5QNr7rj3vM");

#[program]
pub mod counter {
    use super::*;

    /// Инструкция для создания и инициализации аккаунта счетчика
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter initialized with count = 0!");
        Ok(())
    }

    /// Инструкция для увеличения значения count на +1
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented! New count = {}", counter.count);
        Ok(())
    }
}

/// Контекст аккаунтов для инструкции initialize
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 8 // 8 байт дискриминатор Anchor + 8 байт u64 count
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Контекст аккаунтов для инструкции increment
#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
}

/// Структура состояния аккаунта Counter
#[account]
pub struct Counter {
    pub count: u64,
}
