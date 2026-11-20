use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM");

#[program]
pub mod defi_swap {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
        require!(fee_bps < 10_000, DefiError::InvalidFee);

        let pool = &mut ctx.accounts.pool;
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.vault_a = ctx.accounts.vault_a.key();
        pool.vault_b = ctx.accounts.vault_b.key();
        pool.fee_bps = fee_bps;
        pool.bump = ctx.bumps.pool;

        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
        a_to_b: bool,
    ) -> Result<()> {
        require!(amount_in > 0, DefiError::InvalidAmount);

        let pool = &ctx.accounts.pool;

        if a_to_b {
            require!(
                ctx.accounts.user_source.mint == pool.token_a_mint
                    && ctx.accounts.user_destination.mint == pool.token_b_mint,
                DefiError::InvalidMint
            );
        } else {
            require!(
                ctx.accounts.user_source.mint == pool.token_b_mint
                    && ctx.accounts.user_destination.mint == pool.token_a_mint,
                DefiError::InvalidMint
            );
        }

        let (reserve_in, reserve_out) = if a_to_b {
            (
                ctx.accounts.vault_a.amount as u128,
                ctx.accounts.vault_b.amount as u128,
            )
        } else {
            (
                ctx.accounts.vault_b.amount as u128,
                ctx.accounts.vault_a.amount as u128,
            )
        };
        require!(reserve_in > 0 && reserve_out > 0, DefiError::EmptyPool);

        let fee_factor = 10_000u128
            .checked_sub(pool.fee_bps as u128)
            .ok_or(DefiError::MathOverflow)?;
        let amount_in_with_fee = (amount_in as u128)
            .checked_mul(fee_factor)
            .ok_or(DefiError::MathOverflow)?;
        let numerator = amount_in_with_fee
            .checked_mul(reserve_out)
            .ok_or(DefiError::MathOverflow)?;
        let denominator = reserve_in
            .checked_mul(10_000u128)
            .ok_or(DefiError::MathOverflow)?
            .checked_add(amount_in_with_fee)
            .ok_or(DefiError::MathOverflow)?;
        let amount_out = u64::try_from(
            numerator
                .checked_div(denominator)
                .ok_or(DefiError::MathOverflow)?,
        )
        .map_err(|_| DefiError::MathOverflow)?;

        require!(amount_out >= minimum_amount_out, DefiError::SlippageExceeded);

        let (vault_in, vault_out) = if a_to_b {
            (
                ctx.accounts.vault_a.to_account_info(),
                ctx.accounts.vault_b.to_account_info(),
            )
        } else {
            (
                ctx.accounts.vault_b.to_account_info(),
                ctx.accounts.vault_a.to_account_info(),
            )
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_source.to_account_info(),
                    to: vault_in,
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        let bump = [pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            pool.token_a_mint.as_ref(),
            pool.token_b_mint.as_ref(),
            &bump,
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: vault_out,
                    to: ctx.accounts.user_destination.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount_out,
        )?;

        Ok(())
    }
}

#[account]
pub struct SwapPool {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl SwapPool {
    pub const SPACE: usize = 32 + 32 + 32 + 32 + 2 + 1;
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + SwapPool::SPACE,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, SwapPool>>,
    pub token_a_mint: Box<Account<'info, Mint>>,
    pub token_b_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = payer,
        token::mint = token_a_mint,
        token::authority = pool,
        seeds = [b"vault_a", pool.key().as_ref()],
        bump
    )]
    pub vault_a: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        token::mint = token_b_mint,
        token::authority = pool,
        seeds = [b"vault_b", pool.key().as_ref()],
        bump
    )]
    pub vault_b: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        seeds = [b"pool", pool.token_a_mint.as_ref(), pool.token_b_mint.as_ref()],
        bump = pool.bump,
        has_one = vault_a,
        has_one = vault_b
    )]
    pub pool: Box<Account<'info, SwapPool>>,
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_source: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub user_destination: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub vault_a: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub vault_b: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum DefiError {
    #[msg("Fee must be less than 10000 bps.")]
    InvalidFee,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Token mint does not match pool.")]
    InvalidMint,
    #[msg("Pool reserves must be greater than zero.")]
    EmptyPool,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("Slippage limit exceeded.")]
    SlippageExceeded,
}
