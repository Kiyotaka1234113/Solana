# defi_swap Integration Result

**Network**: Solana Devnet

**Wallet**: `F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM`

**Program ID**: `9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM`

**Deploy Signature**: `3ZBegR9dqcQstnhfnwrA2T6RyzXELwMTUQMwxDaXrWYQ7hf85pd1hifp7HRSw6mwQu8iawZARRMp3VD661es9hsQ`

## Token Mints
- **Mint A**: `6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1`
- **Mint B**: `3bgrYo7V5QzKiWHuwZuEnUrLpaoXaPR3FdKZR65gXKeF`

## PDA Addresses
- **Pool PDA**: `BqAKfyF2K61DxvfBLMi9WPjYuem6Ni53YMPm2j11bbvE`
- **Vault A PDA**: `BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F`
- **Vault B PDA**: `H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp`

## Transaction Signatures
- **initialize_pool**: `4kRBLr5xhu1oRpeV5TVdFVx3yBarxaM7syWd4Wznr9khWPSuMdqdXgEm2iCG6SYonSaLnHBsjiG9NVcZ1dQpCnan`
- **Liquidity A**: `5VVkdB1wtLtR3g2bDayYF4w2Yvaq9fS2rBAs5H6hyHu9votaaWqMfMu2MipuZAzsV9Ad9mEZ5oGZ4GH1mBwKZn2M`
- **Liquidity B**: `5psYAV1K6wtCLa1kpChk96LBVwcABoDiDJrKuEveVuGSAxfyDYPCYprvLPUEnsVxqSgAXLHvmxG7XKyfE5rcTZKE`
- **swap**: `GtvqmbqYaqgY7mPAye4mRzF6vFH4x3TNqZUoToiyCzhkV2jwUV6wLALXNCREQjRaZGB6KpVFSgTvSE1D4uh47JR`

## Full Test Log
```
Wallet: F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM
Program ID: 9tXLf1ZEbjycpb3E2vcBqbfe6DAnLYuxpWjtYBDaLZtM
Mint A: 6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1
Mint B: 3bgrYo7V5QzKiWHuwZuEnUrLpaoXaPR3FdKZR65gXKeF
Pool PDA: BqAKfyF2K61DxvfBLMi9WPjYuem6Ni53YMPm2j11bbvE
Vault A PDA: BESX1w1g9doqwXP6rPpyDFk5v8V4b7sD72bLCSurfM4F
Vault B PDA: H3RQb293vviJsYmfbvjJGxe1DNpUaz88qnNdkMSJgkcp
initialize_pool tx: 4kRBLr5xhu1oRpeV5TVdFVx3yBarxaM7syWd4Wznr9khWPSuMdqdXgEm2iCG6SYonSaLnHBsjiG9NVcZ1dQpCnan
Liquidity A tx: 5VVkdB1wtLtR3g2bDayYF4w2Yvaq9fS2rBAs5H6hyHu9votaaWqMfMu2MipuZAzsV9Ad9mEZ5oGZ4GH1mBwKZn2M
Liquidity B tx: 5psYAV1K6wtCLa1kpChk96LBVwcABoDiDJrKuEveVuGSAxfyDYPCYprvLPUEnsVxqSgAXLHvmxG7XKyfE5rcTZKE
Before swap -> User A: 1000000000 User B: 1000000000
swap tx: GtvqmbqYaqgY7mPAye4mRzF6vFH4x3TNqZUoToiyCzhkV2jwUV6wLALXNCREQjRaZGB6KpVFSgTvSE1D4uh47JR
After swap  -> User A: 900000000 User B: 1090661089
Delta A: -100000000 Delta B: 90661089
SUCCESS: AMM pool initialized and swap verified on Devnet!
```
