use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8xSmfQW68bK4GzSfMk2iELyyVuPzdWEokpBHKCtrYjd9");

#[program]
pub mod stablecoin_pay {
    use super::*;

    pub fn create_invoice(ctx: Context<CreateInvoice>, invoice_id: u64, amount: u64) -> Result<()> {
        require!(amount > 0, PayError::InvalidAmount);
        let invoice = &mut ctx.accounts.invoice;
        invoice.merchant = ctx.accounts.merchant.key();
        invoice.mint = ctx.accounts.mint.key();
        invoice.amount = amount;
        invoice.invoice_id = invoice_id;
        invoice.paid = false;
        invoice.payer = Pubkey::default();
        invoice.bump = ctx.bumps.invoice;
        Ok(())
    }

    pub fn pay_invoice(ctx: Context<PayInvoice>) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        require!(!invoice.paid, PayError::AlreadyPaid);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.merchant_token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            invoice.amount,
        )?;
        invoice.paid = true;
        invoice.payer = ctx.accounts.payer.key();
        emit!(InvoicePaid {
            invoice: invoice.key(),
            merchant: invoice.merchant,
            payer: invoice.payer,
            mint: invoice.mint,
            amount: invoice.amount,
            invoice_id: invoice.invoice_id,
        });
        Ok(())
    }
}

#[account]
pub struct Invoice {
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub invoice_id: u64,
    pub paid: bool,
    pub payer: Pubkey,
    pub bump: u8,
}

#[event]
pub struct InvoicePaid {
    pub invoice: Pubkey,
    pub merchant: Pubkey,
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub invoice_id: u64,
}

#[derive(Accounts)]
#[instruction(invoice_id: u64)]
pub struct CreateInvoice<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = merchant,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 32 + 1,
        seeds = [b"invoice", merchant.key().as_ref(), &invoice_id.to_le_bytes()],
        bump
    )]
    pub invoice: Box<Account<'info, Invoice>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayInvoice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"invoice", invoice.merchant.as_ref(), &invoice.invoice_id.to_le_bytes()],
        bump = invoice.bump
    )]
    pub invoice: Box<Account<'info, Invoice>>,
    #[account(
        mut,
        constraint = payer_token_account.mint == invoice.mint @ PayError::InvalidMint,
        constraint = payer_token_account.owner == payer.key() @ PayError::InvalidPayerAccount
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = merchant_token_account.mint == invoice.mint @ PayError::InvalidMint,
        constraint = merchant_token_account.owner == invoice.merchant @ PayError::InvalidMerchantAccount
    )]
    pub merchant_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum PayError {
    #[msg("Invoice amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Invoice has already been paid.")]
    AlreadyPaid,
    #[msg("Token account mint does not match invoice stablecoin mint.")]
    InvalidMint,
    #[msg("Payer token account owner mismatch.")]
    InvalidPayerAccount,
    #[msg("Merchant token account owner mismatch.")]
    InvalidMerchantAccount,
}
