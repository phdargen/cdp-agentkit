from cdp import SmartContract

from cdp_agentkit_core.actions.opensea.constants import (
    OPENSEA_CONTRACTS,
    SEAPORT_ABI,
    ERC721_ABI
)
from cdp_agentkit_core.actions.get_balance_nft import get_balance_nft

def check_marketplace_approval(
    network_id: str,
    contract_address: str,
    owner_address: str
) -> bool:
    """Check if OpenSea marketplace is approved for an NFT contract."""
    try:
        is_approved = SmartContract.read(
            network_id,
            contract_address,
            "isApprovedForAll",
            abi=ERC721_ABI,
            args={
                "owner": owner_address,
                "operator": OPENSEA_CONTRACTS[network_id]["seaport"]
            }
        )
        return is_approved
    except Exception as e:
        return False

def get_order_status(network_id: str, order_hash: str) -> dict:
    """Get the status of an order."""
    return SmartContract.read(
        network_id,
        OPENSEA_CONTRACTS[network_id]["seaport"],
        "getOrderStatus",
        abi=SEAPORT_ABI,
        args={"orderHash": order_hash}
    )
