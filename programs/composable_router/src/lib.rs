use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    hash::hash,
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

declare_id!("9t56Ysmdii2T2fk6cnXihjW5Q1k7WCCspD7wsMFQzrB4");

#[program]
pub mod composable_router {
    use super::*;

    pub fn execute_routed_swap(
        ctx: Context<RoutedSwap>,
        amount_in: u64,
        minimum_amount_out: u64,
        a_to_b: bool,
        memo: String,
    ) -> Result<()> {
        // CPI #1: defi_swap::swap
        let mut data = Vec::with_capacity(25);
        data.extend_from_slice(&hash(b"global:swap").to_bytes()[..8]);
        data.extend_from_slice(&amount_in.to_le_bytes());
        data.extend_from_slice(&minimum_amount_out.to_le_bytes());
        data.push(if a_to_b { 1 } else { 0 });

        let swap_ix = Instruction {
            program_id: ctx.accounts.defi_swap_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.pool.key(), false),
                AccountMeta::new_readonly(ctx.accounts.user.key(), true),
                AccountMeta::new(ctx.accounts.user_source.key(), false),
                AccountMeta::new(ctx.accounts.user_destination.key(), false),
                AccountMeta::new(ctx.accounts.vault_a.key(), false),
                AccountMeta::new(ctx.accounts.vault_b.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            ],
            data,
        };
        invoke(
            &swap_ix,
            &[
                ctx.accounts.pool.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.user_source.to_account_info(),
                ctx.accounts.user_destination.to_account_info(),
                ctx.accounts.vault_a.to_account_info(),
                ctx.accounts.vault_b.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.defi_swap_program.to_account_info(),
            ],
        )?;

        // CPI #2: SPL Memo write
        let memo_ix = Instruction {
            program_id: ctx.accounts.memo_program.key(),
            accounts: vec![AccountMeta::new_readonly(ctx.accounts.user.key(), true)],
            data: memo.into_bytes(),
        };
        invoke(
            &memo_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.memo_program.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct RoutedSwap<'info> {
    /// CHECK: Verified by defi_swap program via CPI
    pub pool: UncheckedAccount<'info>,
    pub user: Signer<'info>,
    /// CHECK: Verified by defi_swap and SPL Token via CPI
    #[account(mut)]
    pub user_source: UncheckedAccount<'info>,
    /// CHECK: Verified by defi_swap and SPL Token via CPI
    #[account(mut)]
    pub user_destination: UncheckedAccount<'info>,
    /// CHECK: Verified by defi_swap via CPI
    #[account(mut)]
    pub vault_a: UncheckedAccount<'info>,
    /// CHECK: Verified by defi_swap via CPI
    #[account(mut)]
    pub vault_b: UncheckedAccount<'info>,
    /// CHECK: SPL Token program
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: Deployed defi_swap program
    pub defi_swap_program: UncheckedAccount<'info>,
    /// CHECK: SPL Memo program
    pub memo_program: UncheckedAccount<'info>,
}
