from typing import TypedDict

class OpenseaContracts(TypedDict):
    seaport: str
    conduit: str

OPENSEA_CONTRACTS: dict[str, OpenseaContracts] = {
    "base-mainnet": {
        "seaport": "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC",
        "conduit": "0x1E0049783F008A0085193E00003D00cd54003c71"  # OpenSea's conduit
    },
    "base-sepolia": {
        "seaport": "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC",
        "conduit": "0x1E0049783F008A0085193E00003D00cd54003c71"  # OpenSea's conduit
    }
}

# Constants for order types
OPENSEA_ORDER_TYPE = {
    "FULL_OPEN": 0,  # No partial fills, anyone can execute
    "PARTIAL_OPEN": 1,  # Partial fills supported, anyone can execute
    "FULL_RESTRICTED": 2,  # No partial fills, only approved can execute
    "PARTIAL_RESTRICTED": 3  # Partial fills supported, only approved can execute
}

# Item types for offer/consideration
OPENSEA_ITEM_TYPE = {
    "NATIVE": 0,  # Native token (ETH)
    "ERC20": 1,  # ERC20 tokens
    "ERC721": 2,  # ERC721 tokens (NFTs)
    "ERC1155": 3,  # ERC1155 tokens
    "ERC721_WITH_CRITERIA": 4,  # ERC721 tokens with criteria
    "ERC1155_WITH_CRITERIA": 5  # ERC1155 tokens with criteria
}

# Standard ERC721 interface for NFT operations
ERC721_ABI = [
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "operator", "type": "address"},
            {"name": "approved", "type": "bool"}
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "operator", "type": "address"}
        ],
        "name": "isApprovedForAll",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Full Seaport ABI for marketplace operations
SEAPORT_ABI = [
    # Create order (listing)
    {
        "inputs": [
            {
                "components": [
                    {"name": "offerer", "type": "address"},
                    {"name": "zone", "type": "address"},
                    {
                        "components": [
                            {"name": "itemType", "type": "uint8"},
                            {"name": "token", "type": "address"},
                            {"name": "identifierOrCriteria", "type": "uint256"},
                            {"name": "startAmount", "type": "uint256"},
                            {"name": "endAmount", "type": "uint256"}
                        ],
                        "name": "offer",
                        "type": "tuple[]"
                    },
                    {
                        "components": [
                            {"name": "itemType", "type": "uint8"},
                            {"name": "token", "type": "address"},
                            {"name": "identifierOrCriteria", "type": "uint256"},
                            {"name": "startAmount", "type": "uint256"},
                            {"name": "endAmount", "type": "uint256"},
                            {"name": "recipient", "type": "address"}
                        ],
                        "name": "consideration",
                        "type": "tuple[]"
                    },
                    {"name": "orderType", "type": "uint8"},
                    {"name": "startTime", "type": "uint256"},
                    {"name": "endTime", "type": "uint256"},
                    {"name": "zoneHash", "type": "bytes32"},
                    {"name": "salt", "type": "uint256"},
                    {"name": "conduitKey", "type": "bytes32"},
                    {"name": "counter", "type": "uint256"}
                ],
                "name": "parameters",
                "type": "tuple"
            }
        ],
        "name": "createOrder",
        "outputs": [{"name": "orderHash", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    # Fulfill order (buying)
    {
        "inputs": [
            {
                "components": [
                    {
                        "components": [
                            {"name": "offerer", "type": "address"},
                            {"name": "zone", "type": "address"},
                            {"name": "offer", "type": "tuple[]"},
                            {"name": "consideration", "type": "tuple[]"},
                            {"name": "orderType", "type": "uint8"},
                            {"name": "startTime", "type": "uint256"},
                            {"name": "endTime", "type": "uint256"},
                            {"name": "zoneHash", "type": "bytes32"},
                            {"name": "salt", "type": "uint256"},
                            {"name": "conduitKey", "type": "bytes32"},
                            {"name": "totalOriginalConsiderationItems", "type": "uint256"}
                        ],
                        "name": "parameters",
                        "type": "tuple"
                    },
                    {"name": "signature", "type": "bytes"}
                ],
                "name": "order",
                "type": "tuple"
            }
        ],
        "name": "fulfillOrder",
        "outputs": [{"name": "fulfilled", "type": "bool"}],
        "stateMutability": "payable",
        "type": "function"
    },
    # Get order status
    {
        "inputs": [{"name": "orderHash", "type": "bytes32"}],
        "name": "getOrderStatus",
        "outputs": [
            {"name": "isValidated", "type": "bool"},
            {"name": "isCancelled", "type": "bool"},
            {"name": "totalFilled", "type": "uint256"},
            {"name": "totalSize", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    # Cancel order
    {
        "inputs": [{"name": "orderHash", "type": "bytes32"}],
        "name": "cancelOrder",
        "outputs": [{"name": "cancelled", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    # Get counter for order nonce
    {
        "inputs": [{"name": "offerer", "type": "address"}],
        "name": "getCounter",
        "outputs": [{"name": "counter", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    # Validate order
    {
        "inputs": [
            {
                "components": [
                    {"name": "parameters", "type": "tuple"},
                    {"name": "signature", "type": "bytes"}
                ],
                "name": "order",
                "type": "tuple"
            }
        ],
        "name": "validate",
        "outputs": [{"name": "validated", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Default values
DEFAULT_ZONE = "0x004C00500000aD104D7DBd00e3ae0A5C00560C00"  # OpenSea's zone
DEFAULT_CONDUIT_KEY = "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"  # OpenSea's standard conduit key