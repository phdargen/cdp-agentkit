from collections.abc import Callable

from cdp import Wallet
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.opensea.constants import (
    OPENSEA_CONTRACTS,
    ERC721_ABI
)

APPROVE_NFT_PROMPT = """
This tool approves an NFT contract for trading on OpenSea marketplace.

Inputs:
- contract_address: The NFT contract address to approve

Important notes:
- This approval is required before listing NFTs from this contract
- Approval is per contract, not per NFT
- Only supported on Base and Base Sepolia networks
"""

class ApproveNftInput(BaseModel):
    """Input argument schema for NFT approval action."""
    
    contract_address: str = Field(
        ..., 
        description="The NFT contract address to approve for trading"
    )

def approve_nft_for_trading(
    wallet: Wallet,
    contract_address: str
) -> str:
    """Approve NFT contract for trading on OpenSea.

    Args:
        wallet: The wallet to approve from
        contract_address: The NFT contract address

    Returns:
        str: A message containing the approval status and transaction hash
    """
    try:
        approval = wallet.invoke_contract(
            contract_address=contract_address,
            method="setApprovalForAll",
            abi=ERC721_ABI,
            args={
                "operator": OPENSEA_CONTRACTS[wallet.network_id]["conduit"],
                "approved": True
            }
        ).wait()
        return f"Approved OpenSea to trade NFTs. Transaction hash: {approval.transaction.transaction_hash}"
    except Exception as e:
        return f"Error approving marketplace: {e!s}"

class ApproveNftAction(CdpAction):
    """OpenSea NFT approval action."""
    
    name: str = "approve_nft_opensea"
    description: str = APPROVE_NFT_PROMPT
    args_schema: type[BaseModel] | None = ApproveNftInput
    func: Callable[..., str] = approve_nft_for_trading
