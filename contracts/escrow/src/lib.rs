#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, token, Address, Env, String,
};

// ── Data structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum TxStatus {
    Funded,    // USDC locked, waiting for sender VND payment
    Completed, // Receiver confirmed → USDC released to agent
    Expired,   // Timeout → USDC returned to agent
}

#[contracttype]
#[derive(Clone)]
pub struct TxRecord {
    pub amount: i128,
    pub created_at: u64,
    pub status: TxStatus,
    pub receiver: Address, // receiver must confirm to release USDC
}

#[contracttype]
pub enum DataKey {
    Agent,
    UsdcToken,
    TxRecord(String),
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    Unauthorized       = 3,
    InsufficientFunds  = 4,
    TxNotFound         = 5,
    TxAlreadyProcessed = 6,
    Expired            = 7,
    NotExpired         = 8,
}

// ── Contract ─────────────────────────────────────────────────────────────────

const TIMEOUT_SECONDS: u64 = 300; // 5 minutes

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // ── Setup ────────────────────────────────────────────────────────────────

    /// Initialize with agent address and USDC token. Called once on deploy.
    pub fn initialize(
        env: Env,
        agent: Address,
        usdc_token: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Agent) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        Ok(())
    }

    // ── Agent: Accept request ─────────────────────────────────────────────────

    /// Agent accepts a sender request in ONE signed transaction:
    /// - Transfers `amount` USDC from agent wallet → contract (locked)
    /// - Records the tx with receiver address (who must confirm to release)
    /// - Starts the 5-minute countdown
    ///
    /// USDC is released back to agent ONLY when:
    ///   (a) receiver calls receiver_confirm() — happy path
    ///   (b) timeout expires and nobody paid — refund()
    pub fn accept(
        env: Env,
        agent: Address,
        tx_id: String,
        amount: i128,
        receiver: Address,
    ) -> Result<(), ContractError> {
        agent.require_auth();
        Self::require_agent(&env, &agent)?;

        if env.storage().persistent().has(&DataKey::TxRecord(tx_id.clone())) {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Lock USDC: agent wallet → contract (1 op, agent auth covers nested transfer)
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&agent, &env.current_contract_address(), &amount);

        let record = TxRecord {
            amount,
            created_at: env.ledger().timestamp(),
            status: TxStatus::Funded,
            receiver,
        };
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("accepted"),), (agent, tx_id, amount));

        Ok(())
    }

    // ── Receiver: Confirm received ────────────────────────────────────────────

    /// Receiver confirms they received the PHP payout.
    /// This releases the locked USDC back to the agent.
    ///
    /// Only the receiver address stored in the TxRecord can call this.
    pub fn receiver_confirm(
        env: Env,
        tx_id: String,
        receiver: Address,
    ) -> Result<i128, ContractError> {
        receiver.require_auth();

        let mut record: TxRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TxRecord(tx_id.clone()))
            .ok_or(ContractError::TxNotFound)?;

        if record.status != TxStatus::Funded {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Only the designated receiver can confirm
        if record.receiver != receiver {
            return Err(ContractError::Unauthorized);
        }

        // Check not expired
        let now = env.ledger().timestamp();
        if now > record.created_at + TIMEOUT_SECONDS {
            return Err(ContractError::Expired);
        }

        // Release USDC: contract → agent
        let agent = Self::get_agent(&env)?;
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&env.current_contract_address(), &agent, &record.amount);

        record.status = TxStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("released"),), (tx_id, record.amount));

        Ok(record.amount)
    }

    // ── Timeout: Refund ───────────────────────────────────────────────────────

    /// Anyone can call refund after timeout if sender never paid.
    /// Returns locked USDC to agent.
    pub fn refund(env: Env, tx_id: String) -> Result<i128, ContractError> {
        let mut record: TxRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TxRecord(tx_id.clone()))
            .ok_or(ContractError::TxNotFound)?;

        if record.status != TxStatus::Funded {
            return Err(ContractError::TxAlreadyProcessed);
        }

        let now = env.ledger().timestamp();
        if now <= record.created_at + TIMEOUT_SECONDS {
            return Err(ContractError::NotExpired);
        }

        // Return USDC to agent
        let agent = Self::get_agent(&env)?;
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&env.current_contract_address(), &agent, &record.amount);

        record.status = TxStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("refund"),), (tx_id, record.amount));

        Ok(record.amount)
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /// Total USDC currently locked in this contract.
    pub fn get_balance(env: Env) -> i128 {
        if let Ok(usdc) = Self::usdc_client(&env) {
            usdc.balance(&env.current_contract_address())
        } else {
            0
        }
    }

    pub fn get_tx_status(env: Env, tx_id: String) -> Result<TxStatus, ContractError> {
        env.storage()
            .persistent()
            .get::<DataKey, TxRecord>(&DataKey::TxRecord(tx_id))
            .map(|r| r.status)
            .ok_or(ContractError::TxNotFound)
    }

    pub fn get_usdc_token(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(ContractError::NotInitialized)
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    fn require_agent(env: &Env, caller: &Address) -> Result<(), ContractError> {
        let agent = Self::get_agent(env)?;
        if *caller != agent {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn get_agent(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Agent)
            .ok_or(ContractError::NotInitialized)
    }

    fn usdc_client(env: &Env) -> Result<token::Client<'_>, ContractError> {
        let usdc_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(ContractError::NotInitialized)?;
        Ok(token::Client::new(env, &usdc_addr))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env, String,
    };

    fn setup() -> (
        Env,
        EscrowContractClient<'static>,
        Address, // agent
        Address, // receiver
        TokenClient<'static>,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let usdc_admin = Address::generate(&env);
        let usdc_id = env.register_stellar_asset_contract_v2(usdc_admin.clone());
        let usdc_client = TokenClient::new(&env, &usdc_id.address());
        let usdc_asset = StellarAssetClient::new(&env, &usdc_id.address());

        let contract_id = env.register(EscrowContract, ());
        let client = EscrowContractClient::new(&env, &contract_id);

        let agent = Address::generate(&env);
        let receiver = Address::generate(&env);

        client.initialize(&agent, &usdc_id.address());
        usdc_asset.mint(&agent, &10_000_i128);

        (env, client, agent, receiver, usdc_client)
    }

    #[test]
    fn test_accept_locks_usdc() {
        let (env, client, agent, receiver, usdc) = setup();
        let tx_id = String::from_str(&env, "tx001");
        client.accept(&agent, &tx_id, &1000_i128, &receiver);
        // USDC locked in contract
        assert_eq!(client.get_balance(), 1000);
        assert_eq!(usdc.balance(&agent), 9000);
    }

    #[test]
    fn test_receiver_confirm_releases_usdc() {
        let (env, client, agent, receiver, usdc) = setup();
        let tx_id = String::from_str(&env, "tx002");
        client.accept(&agent, &tx_id, &1000_i128, &receiver);
        // Receiver confirms → USDC back to agent
        client.receiver_confirm(&tx_id, &receiver);
        assert_eq!(client.get_balance(), 0);
        assert_eq!(usdc.balance(&agent), 10_000);
    }

    #[test]
    fn test_wrong_receiver_cannot_confirm() {
        let (env, client, agent, receiver, _) = setup();
        let tx_id = String::from_str(&env, "tx003");
        client.accept(&agent, &tx_id, &1000_i128, &receiver);
        let impostor = Address::generate(&env);
        let result = client.try_receiver_confirm(&tx_id, &impostor);
        assert!(result.is_err());
    }

    #[test]
    fn test_refund_after_timeout() {
        let (env, client, agent, receiver, usdc) = setup();
        let tx_id = String::from_str(&env, "tx004");
        client.accept(&agent, &tx_id, &1000_i128, &receiver);
        env.ledger().with_mut(|l| { l.timestamp += TIMEOUT_SECONDS + 1; });
        client.refund(&tx_id);
        assert_eq!(client.get_balance(), 0);
        assert_eq!(usdc.balance(&agent), 10_000);
    }

    #[test]
    fn test_confirm_after_timeout_fails() {
        let (env, client, agent, receiver, _) = setup();
        let tx_id = String::from_str(&env, "tx005");
        client.accept(&agent, &tx_id, &1000_i128, &receiver);
        env.ledger().with_mut(|l| { l.timestamp += TIMEOUT_SECONDS + 1; });
        let result = client.try_receiver_confirm(&tx_id, &receiver);
        assert!(result.is_err());
    }

    #[test]
    fn test_double_accept_rejected() {
        let (env, client, agent, receiver, _) = setup();
        let tx_id = String::from_str(&env, "tx006");
        client.accept(&agent, &tx_id, &500_i128, &receiver);
        let result = client.try_accept(&agent, &tx_id, &500_i128, &receiver);
        assert!(result.is_err());
    }
}
