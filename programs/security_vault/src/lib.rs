use anchor_lang::prelude::*;

declare_id!("CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP");

#[program]
pub mod security_vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault_info = ctx.accounts.vault.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        let rent_min = Rent::get()?.minimum_balance(vault_info.data_len());
        let available = vault_info.lamports().saturating_sub(rent_min);
        require!(amount > 0 && amount <= available, VaultError::InsufficientFunds);

        **vault_info.try_borrow_mut_lamports()? -= amount;
        **recipient_info.try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1,
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: INTENTIONALLY VULNERABLE - missing Signer check!
    pub authority: Signer<'info>,
    /// CHECK: Recipient of withdrawn lamports
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

#[error_code]
pub enum VaultError {
    #[msg("Insufficient available lamports in vault.")]
    InsufficientFunds,
}
