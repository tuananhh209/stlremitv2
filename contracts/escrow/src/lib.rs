#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
};

// ── Data structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum TxStatus {
    Funded,
    Completed,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub struct TxRecord {
    pub amount: i128,
    pub created_at: u64, // Unix timestamp (ledger time in seconds)
    pub status: TxStatus,
}

#[contracttype]
pub enum DataKey {
    Agent,
    TotalCollateral,
    TxRecord(String),
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientFunds = 4,
    TxNotFound = 5,
    TxAlreadyProcessed = 6,
    Expired = 7,
    NotExpired = 8,
}

// ── Contract ─────────────────────────────────────────────────────────────────

const TIMEOUT_SECONDS: u64 = 300; // 5 minutes

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the contract with the agent address.
    /// Can only be called once.
    pub fn initialize(env: Env, agent: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Agent) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &0_i128);
        Ok(())
    }

    /// Agent deposits USDC (represented as i128 stroops) into the collateral pool.
    pub fn fund(env: Env, agent: Address, amount: i128) -> Result<i128, ContractError> {
        agent.require_auth();
        Self::require_agent(&env, &agent)?;

        let current: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        let new_total = current + amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &new_total);

        env.events()
            .publish((symbol_short!("funded"),), (agent, amount, new_total));

        Ok(new_total)
    }

    /// Reserve USDC for a remittance request.
    /// Deducts from the available (unreserved) pool.
    pub fn reserve(
        env: Env,
        tx_id: String,
        amount: i128,
        agent: Address,
    ) -> Result<(), ContractError> {
        agent.require_auth();
        Self::require_agent(&env, &agent)?;

        // Check tx_id not already used
        if env
            .storage()
            .persistent()
            .has(&DataKey::TxRecord(tx_id.clone()))
        {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Check available balance
        let available = Self::available_balance(&env);
        if available < amount {
            return Err(ContractError::InsufficientFunds);
        }

        // Deduct from total collateral (reserved = total - available)
        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &(total - amount));

        // Store tx record
        let created_at = env.ledger().timestamp();
        let record = TxRecord {
            amount,
            created_at,
            status: TxStatus::Funded,
        };
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("reserved"),), (tx_id, amount, created_at));

        Ok(())
    }

    /// Agent confirms payout — releases reserved USDC back to the pool.
    pub fn confirm(env: Env, tx_id: String, caller: Address) -> Result<i128, ContractError> {
        caller.require_auth();
        Self::require_agent(&env, &caller)?;

        let mut record: TxRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TxRecord(tx_id.clone()))
            .ok_or(ContractError::TxNotFound)?;

        if record.status != TxStatus::Funded {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Check not expired
        let now = env.ledger().timestamp();
        if now > record.created_at + TIMEOUT_SECONDS {
            return Err(ContractError::Expired);
        }

        // Release USDC back to pool
        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        let new_total = total + record.amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &new_total);

        record.status = TxStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("confirm"),), (tx_id, record.amount, new_total));

        Ok(record.amount)
    }

    /// Refund reserved USDC back to pool after timeout.
    pub fn refund(env: Env, tx_id: String) -> Result<i128, ContractError> {
        let mut record: TxRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TxRecord(tx_id.clone()))
            .ok_or(ContractError::TxNotFound)?;

        if record.status != TxStatus::Funded {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Must be expired
        let now = env.ledger().timestamp();
        if now <= record.created_at + TIMEOUT_SECONDS {
            return Err(ContractError::NotExpired);
        }

        // Restore USDC to pool
        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        let new_total = total + record.amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalCollateral, &new_total);

        record.status = TxStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("refund"),), (tx_id, record.amount, new_total));

        Ok(record.amount)
    }

    /// Query total available collateral balance.
    pub fn get_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0)
    }

    /// Query reserved amount for a specific txId.
    pub fn get_reserved(env: Env, tx_id: String) -> i128 {
        env.storage()
            .persistent()
            .get::<DataKey, TxRecord>(&DataKey::TxRecord(tx_id))
            .map(|r| if r.status == TxStatus::Funded { r.amount } else { 0 })
            .unwrap_or(0)
    }

    /// Query status of a specific txId.
    pub fn get_tx_status(env: Env, tx_id: String) -> Result<TxStatus, ContractError> {
        env.storage()
            .persistent()
            .get::<DataKey, TxRecord>(&DataKey::TxRecord(tx_id))
            .map(|r| r.status)
            .ok_or(ContractError::TxNotFound)
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    fn require_agent(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let agent: Address = env
            .storage()
            .instance()
            .get(&DataKey::Agent)
            .ok_or(ContractError::NotInitialized)?;
        if *caller != agent {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    /// Available balance = total collateral (reserved amounts are already deducted).
    fn available_balance(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Ledger, Env, String};

    fn setup() -> (Env, EscrowContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);
        let agent = Address::generate(&env);
        client.initialize(&agent);
        (env, client, agent)
    }

    #[test]
    fn test_fund_and_balance() {
        let (_, client, agent) = setup();
        let balance = client.fund(&agent, &1000_i128);
        assert_eq!(balance, 1000);
        assert_eq!(client.get_balance(), 1000);
    }

    #[test]
    fn test_reserve_deducts_balance() {
        let (env, client, agent) = setup();
        client.fund(&agent, &1000_i128);
        let tx_id = String::from_str(&env, "tx001");
        client.reserve(&tx_id, &400_i128, &agent);
        // After reserve, available = 1000 - 400 = 600
        assert_eq!(client.get_balance(), 600);
        assert_eq!(client.get_reserved(&tx_id), 400);
    }

    #[test]
    fn test_confirm_releases_funds() {
        let (env, client, agent) = setup();
        client.fund(&agent, &1000_i128);
        let tx_id = String::from_str(&env, "tx002");
        client.reserve(&tx_id, &400_i128, &agent);
        client.confirm(&tx_id, &agent);
        // After confirm, available = 600 + 400 = 1000
        assert_eq!(client.get_balance(), 1000);
    }

    #[test]
    fn test_refund_after_timeout() {
        let (env, client, agent) = setup();
        client.fund(&agent, &1000_i128);
        let tx_id = String::from_str(&env, "tx003");
        client.reserve(&tx_id, &400_i128, &agent);

        // Advance ledger time past timeout
        env.ledger().with_mut(|l| {
            l.timestamp += TIMEOUT_SECONDS + 1;
        });

        client.refund(&tx_id);
        assert_eq!(client.get_balance(), 1000);
    }

    #[test]
    fn test_confirm_after_timeout_fails() {
        let (env, client, agent) = setup();
        client.fund(&agent, &1000_i128);
        let tx_id = String::from_str(&env, "tx004");
        client.reserve(&tx_id, &400_i128, &agent);

        env.ledger().with_mut(|l| {
            l.timestamp += TIMEOUT_SECONDS + 1;
        });

        let result = client.try_confirm(&tx_id, &agent);
        assert!(result.is_err());
    }

    #[test]
    fn test_insufficient_funds_rejected() {
        let (env, client, agent) = setup();
        client.fund(&agent, &100_i128);
        let tx_id = String::from_str(&env, "tx005");
        let result = client.try_reserve(&tx_id, &500_i128, &agent);
        assert!(result.is_err());
    }
}
