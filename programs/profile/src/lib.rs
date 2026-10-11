use anchor_lang::prelude::*;

declare_id!("v2ViaeEaxvCQfutQzic1VyEVqXTxqJLLsFt2MsiJMHb");

#[program]
pub mod profile {
    use super::*;

    /// Инструкция для создания и инициализации PDA-профиля пользователя
    pub fn create_profile(
        ctx: Context<CreateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        require!(name.len() <= 32, ProfileError::NameTooLong);
        require!(bio.len() <= 256, ProfileError::BioTooLong);

        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.user = ctx.accounts.user.key();
        user_profile.name = name;
        user_profile.bio = bio;
        user_profile.bump = ctx.bumps.user_profile;

        msg!("User profile created for: {}", user_profile.user);
        Ok(())
    }

    /// Инструкция для обновления данных PDA-профиля
    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        name: String,
        bio: String,
    ) -> Result<()> {
        require!(name.len() <= 32, ProfileError::NameTooLong);
        require!(bio.len() <= 256, ProfileError::BioTooLong);

        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.name = name;
        user_profile.bio = bio;

        msg!("User profile updated for: {}", user_profile.user);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + (4 + 32) + (4 + 256) + 1,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump,
        has_one = user @ ProfileError::Unauthorized
    )]
    pub user_profile: Account<'info, UserProfile>,
    pub user: Signer<'info>,
}

#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub name: String,
    pub bio: String,
    pub bump: u8,
}

#[error_code]
pub enum ProfileError {
    #[msg("Имя не должно превышать 32 символа.")]
    NameTooLong,
    #[msg("Описание bio не должно превышать 256 символов.")]
    BioTooLong,
    #[msg("Пользователь не авторизован для обновления этого профиля.")]
    Unauthorized,
}
