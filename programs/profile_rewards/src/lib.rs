use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("Cf2wLYFB3PQKJKDBuszFoAjdvKE8vjaziFLM2TkGZ62T");

pub const REWARD_MINT: Pubkey = pubkey!("ER68vjbbokgZpF8JDvFgHqMD1RUUzDUjrLg3ChgacDD2");
pub const REWARD_DECIMALS: u8 = 6;
pub const REWARD_BASE_UNITS: u64 = 10 * 1_000_000;
pub const REPUTATION_PER_TASK: u64 = 10;

#[program]
pub mod profile_rewards {
    use super::*;

    pub fn initialize_user(ctx: Context<InitializeUser>, name: String) -> Result<()> {
        validate_name(&name)?;
        let profile = &mut ctx.accounts.user_profile;
        profile.user = ctx.accounts.user.key();
        profile.name = name;
        profile.reputation = 0;
        profile.bump = ctx.bumps.user_profile;
        msg!("User initialized: {}, reputation: 0", profile.user);
        Ok(())
    }

    pub fn complete_task(ctx: Context<CompleteTask>) -> Result<()> {
        let reputation = next_reputation(ctx.accounts.user_profile.reputation)?;
        let bump = [ctx.bumps.reward_authority];
        let authority_seeds: &[&[u8]] = &[b"reward_authority", &bump];
        let signer_seeds = &[authority_seeds];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                    authority: ctx.accounts.reward_authority.to_account_info(),
                },
                signer_seeds,
            ),
            REWARD_BASE_UNITS,
        )?;

        ctx.accounts.user_profile.reputation = reputation;
        msg!(
            "Task completed: {}, reputation: {}, reward: 10 tokens",
            ctx.accounts.user.key(),
            reputation
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump,
        has_one = user @ RewardsError::Unauthorized
    )]
    pub user_profile: Account<'info, UserProfile>,
    pub user: Signer<'info>,
    #[account(
        mut,
        address = REWARD_MINT @ RewardsError::InvalidRewardMint,
        mint::decimals = REWARD_DECIMALS,
        mint::authority = reward_authority
    )]
    pub reward_mint: Account<'info, Mint>,
    /// CHECK: Only the canonical PDA can sign the mint CPI; it stores no data.
    #[account(seeds = [b"reward_authority"], bump)]
    pub reward_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = user
    )]
    pub user_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub user: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub reputation: u64,
    pub bump: u8,
}

fn validate_name(name: &str) -> Result<()> {
    require!(!name.trim().is_empty(), RewardsError::EmptyName);
    require!(name.len() <= 32, RewardsError::NameTooLong);
    Ok(())
}

fn next_reputation(current: u64) -> Result<u64> {
    current
        .checked_add(REPUTATION_PER_TASK)
        .ok_or_else(|| error!(RewardsError::ReputationOverflow))
}

#[error_code]
pub enum RewardsError {
    #[msg("Name must not be empty.")]
    EmptyName,
    #[msg("Name must be at most 32 UTF-8 bytes.")]
    NameTooLong,
    #[msg("Only the profile owner can complete a task.")]
    Unauthorized,
    #[msg("The supplied mint is not the configured reward mint.")]
    InvalidRewardMint,
    #[msg("Reputation overflow.")]
    ReputationOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_fit_allocated_utf8_bytes() {
        assert!(validate_name("Alice").is_ok());
        assert!(validate_name(&"a".repeat(32)).is_ok());
        assert!(validate_name(&"a".repeat(33)).is_err());
        assert!(validate_name(&"\u{00e9}".repeat(16)).is_ok());
        assert!(validate_name(&"\u{00e9}".repeat(17)).is_err());
        assert!(validate_name(" \t").is_err());
    }

    #[test]
    fn reputation_addition_never_wraps() {
        assert_eq!(next_reputation(0).unwrap(), 10);
        assert_eq!(next_reputation(10).unwrap(), 20);
        assert!(next_reputation(u64::MAX - 9).is_err());
        assert_eq!(next_reputation(u64::MAX - 10).unwrap(), u64::MAX);
    }
}
