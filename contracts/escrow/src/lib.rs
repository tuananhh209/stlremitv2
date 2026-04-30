#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, token, Address, Env, String,
};

// ── Data structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum TxStatus {
    Funded,    // USDC locked by agent, waiting for sender VND payment
    Completed, // Receiver confirmed → USDC released back to agent
    Expired,   // Timeout → USDC returned to agent
}

/// One escrow record per remittance request.
#[contracttype]
#[derive(Clone)]
pub struct TxRecord {
    pub amount: i128,
    pub created_at: u64,
    pub status: TxStatus,
    pub agent: Address,    // who locked the USDC (gets it back on complete/expire)
    pub receiver: Address, // who must confirm to release USDC
}

#[contracttype]
pub enum DataKey {
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
    TxNotFound         = 4,
    TxAlreadyProcessed = 5,
    Expired            = 6,
    NotExpired         = 7,
}

// ── Contract ─────────────────────────────────────────────────────────────────

const TIMEOUT_SECONDS: u64 = 300; // 5 minutes

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // ── Setup ────────────────────────────────────────────────────────────────

    /// Initialize with USDC token address. Called once on deploy.
    /// No hardcoded agent — anyone can act as agent.
    pub fn initialize(env: Env, usdc_token: Address) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::UsdcToken) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        Ok(())
    }

    // ── Accept (any agent) ────────────────────────────────────────────────────

    /// ANY wallet can act as agent by calling accept().
    /// Locks `amount` USDC from caller's wallet into this contract.
    /// The caller becomes the agent for this tx — they get USDC back on complete/expire.
    ///
    /// Single signature: caller signs this tx, Soroban captures nested
    /// token.transfer auth automatically via require_auth().
    pub fn accept(
        env: Env,
        agent: Address,   // the wallet locking USDC (must sign this tx)
        tx_id: String,
        amount: i128,
        receiver: Address, // who must confirm to release USDC
    ) -> Result<(), ContractError> {
        agent.require_auth();

        if env.storage().persistent().has(&DataKey::TxRecord(tx_id.clone())) {
            return Err(ContractError::TxAlreadyProcessed);
        }

        // Pull USDC from agent wallet → contract
        // agent.require_auth() above covers the nested token.transfer call
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&agent, &env.current_contract_address(), &amount);

        let record = TxRecord {
            amount,
            created_at: env.ledger().timestamp(),
            status: TxStatus::Funded,
            agent: agent.clone(),
            receiver,
        };
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("accepted"),), (agent, tx_id, amount));

        Ok(())
    }

    // ── Receiver confirm ──────────────────────────────────────────────────────

    /// Receiver confirms they received the PHP payout.
    /// Releases locked USDC back to the agent who locked it.
    /// Only the receiver address stored in TxRecord can call this.
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

        if record.receiver != receiver {
            return Err(ContractError::Unauthorized);
        }

        let now = env.ledger().timestamp();
        if now > record.created_at + TIMEOUT_SECONDS {
            return Err(ContractError::Expired);
        }

        // Release USDC: contract → agent (who originally locked it)
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&env.current_contract_address(), &record.agent, &record.amount);

        record.status = TxStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("released"),), (tx_id, record.amount, record.agent));

        Ok(record.amount)
    }

    // ── Timeout refund ────────────────────────────────────────────────────────

    /// Anyone can call refund after timeout.
    /// Returns USDC to the agent who originally locked it.
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

        // Return USDC to the agent who locked it
        let usdc = Self::usdc_client(&env)?;
        usdc.transfer(&env.current_contract_address(), &record.agent, &record.amount);

        record.status = TxStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::TxRecord(tx_id.clone()), &record);

        env.events()
            .publish((symbol_short!("refund"),), (tx_id, record.amount, record.agent));

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

    pub fn get_tx_record(env: Env, tx_id: String) -> Result<TxRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::TxRecord(tx_id))
            .ok_or(ContractError::TxNotFound)
    }

    pub fn get_usdc_token(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(ContractError::NotInitialized)
    }

    // ── Internal ──────────────────────────────────────────────────────────────

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
        Address, // agent1
        Address, // agent2 (different wallet — proves anyone can be agent)
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

        // No hardcoded agent — just initialize with USDC token
        client.initialize(&usdc_id.address());

        let agent1 = Address::generate(&env);
        let agent2 = Address::generate(&env);
        let receiver = Address::generate(&env);

        // Mint USDC to both agents
        usdc_asset.mint(&agent1, &10_000_i128);
        usdc_asset.mint(&agent2, &10_000_i128);

        (env, client, agent1, agent2, receiver, usdc_client)
    }

    #[test]
    fn test_any_wallet_can_be_agent() {
        let (env, client, agent1, agent2, receiver, usdc) = setup();

        // agent1 accepts tx1
        let tx1 = String::from_str(&env, "tx001");
        client.accept(&agent1, &tx1, &1000_i128, &receiver);
        assert_eq!(usdc.balance(&agent1), 9000);

        // agent2 accepts tx2 — different wallet, same contract
        let tx2 = String::from_str(&env, "tx002");
        client.accept(&agent2, &tx2, &500_i128, &receiver);
        assert_eq!(usdc.balance(&agent2), 9500);

        // Contract holds both
        assert_eq!(client.get_balance(), 1500);
    }

    #[test]
    fn test_receiver_confirm_releases_to_correct_agent() {
        let (env, client, agent1, agent2, receiver, usdc) = setup();

        let tx1 = String::from_str(&env, "tx001");
        client.accept(&agent1, &tx1, &1000_i128, &receiver);

        let tx2 = String::from_str(&env, "tx002");
        client.accept(&agent2, &tx2, &500_i128, &receiver);

        // Receiver confirms tx1 → USDC goes back to agent1
        client.receiver_confirm(&tx1, &receiver);
        assert_eq!(usdc.balance(&agent1), 10_000); // agent1 gets back 1000
        assert_eq!(usdc.balance(&agent2), 9500);   // agent2 unchanged

        // Receiver confirms tx2 → USDC goes back to agent2
        client.receiver_confirm(&tx2, &receiver);
        assert_eq!(usdc.balance(&agent2), 10_000);
    }

    #[test]
    fn test_refund_returns_to_original_agent() {
        let (env, client, agent1, _, receiver, usdc) = setup();
        let tx_id = String::from_str(&env, "tx003");
        client.accept(&agent1, &tx_id, &1000_i128, &receiver);

        env.ledger().with_mut(|l| { l.timestamp += TIMEOUT_SECONDS + 1; });
        client.refund(&tx_id);

        assert_eq!(usdc.balance(&agent1), 10_000); // agent1 gets back
        assert_eq!(client.get_balance(), 0);
    }

    #[test]
    fn test_wrong_receiver_cannot_confirm() {
        let (env, client, agent1, _, receiver, _) = setup();
        let tx_id = String::from_str(&env, "tx004");
        client.accept(&agent1, &tx_id, &1000_i128, &receiver);

        let impostor = Address::generate(&env);
        let result = client.try_receiver_confirm(&tx_id, &impostor);
        assert!(result.is_err());
    }

    #[test]
    fn test_double_accept_rejected() {
        let (env, client, agent1, _, receiver, _) = setup();
        let tx_id = String::from_str(&env, "tx005");
        client.accept(&agent1, &tx_id, &500_i128, &receiver);
        let result = client.try_accept(&agent1, &tx_id, &500_i128, &receiver);
        assert!(result.is_err());
    }
}
