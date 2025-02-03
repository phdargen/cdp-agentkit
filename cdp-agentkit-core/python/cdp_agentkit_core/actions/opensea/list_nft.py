from collections.abc import Callable
import time
import random
import json
import logging
from eth_utils import keccak
from eth_abi import encode
from eth_utils import to_bytes, to_hex
import requests
from typing import Optional

from cdp import Wallet
from cdp.payload_signature import PayloadSignature
from pydantic import BaseModel, Field

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.opensea.constants import (
    OPENSEA_CONTRACTS,
    SEAPORT_ABI,
    DEFAULT_ZONE,
    DEFAULT_CONDUIT_KEY,
    OPENSEA_ORDER_TYPE,
    OPENSEA_ITEM_TYPE
)
from cdp_agentkit_core.actions.opensea.utils import get_order_status

# EIP-712 type definitions
EIP_712_ORDER_TYPE = {
    "OrderComponents": [
        {"name": "offerer", "type": "address"},
        {"name": "zone", "type": "address"},
        {"name": "offer", "type": "OfferItem[]"},
        {"name": "consideration", "type": "ConsiderationItem[]"},
        {"name": "orderType", "type": "uint8"},
        {"name": "startTime", "type": "uint256"},
        {"name": "endTime", "type": "uint256"},
        {"name": "zoneHash", "type": "bytes32"},
        {"name": "salt", "type": "uint256"},
        {"name": "conduitKey", "type": "bytes32"},
        {"name": "counter", "type": "uint256"}
    ],
    "OfferItem": [
        {"name": "itemType", "type": "uint8"},
        {"name": "token", "type": "address"},
        {"name": "identifierOrCriteria", "type": "uint256"},
        {"name": "startAmount", "type": "uint256"},
        {"name": "endAmount", "type": "uint256"}
    ],
    "ConsiderationItem": [
        {"name": "itemType", "type": "uint8"},
        {"name": "token", "type": "address"},
        {"name": "identifierOrCriteria", "type": "uint256"},
        {"name": "startAmount", "type": "uint256"},
        {"name": "endAmount", "type": "uint256"},
        {"name": "recipient", "type": "address"}
    ]
}

# Update constants to match Seaport.js
SEAPORT_CONTRACT_NAME = "Seaport"
SEAPORT_CONTRACT_VERSION = "1.6"
CROSS_CHAIN_SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395"
OPENSEA_CONDUIT_KEY = "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"

# Add OpenSea API constants
OPENSEA_API_URL = "https://api.opensea.io/v2"
OPENSEA_TESTNET_API_URL = "https://testnets-api.opensea.io/v2"

LIST_NFT_PROMPT = """
This tool will list an NFT for sale on OpenSea marketplace.

Inputs:
- contract_address: The NFT contract address
- token_id: The ID of the NFT to list
- price_in_wei: Listing price in wei (1 ETH = 1000000000000000000 wei)
- duration_in_seconds: Optional listing duration (default 6 months)

Important notes:
- Ensure you own the NFT before listing
- Price must be in wei (no decimals)
- Duration defaults to 6 months if not specified
- The listing will be created off-chain using a signature
- Only supported on Base and Base Sepolia networks
"""

class ListNftInput(BaseModel):
    """Input argument schema for NFT listing action."""
    
    contract_address: str = Field(
        ..., 
        description="The NFT contract address to list"
    )
    token_id: str = Field(
        ..., 
        description="The ID of the NFT to list"
    )
    price_in_wei: str = Field(
        ..., 
        description="Listing price in wei (1 ETH = 1000000000000000000 wei)"
    )
    duration_in_seconds: int = Field(
        default=15552000,  # 6 months
        description="Duration of listing in seconds (default 6 months)"
    )

# Set up logger
logger = logging.getLogger(__name__)

def get_order_hash(typed_data):
    """Calculate Seaport order hash from typed data."""
    # Get domain separator
    domain_separator = keccak(encode(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
            keccak(text='EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
            keccak(text=typed_data['domain']['name']),
            keccak(text=typed_data['domain']['version']),
            int(typed_data['domain']['chainId']),
            to_bytes(hexstr=typed_data['domain']['verifyingContract'])
        ]
    ))

    # Get order hash
    order = typed_data['message']
    order_hash = keccak(encode(
        ['bytes32', 'address', 'address', 'uint8', 'uint256', 'uint256', 'bytes32', 'uint256', 'bytes32', 'uint256'],
        [
            domain_separator,
            to_bytes(hexstr=order['offerer']),
            to_bytes(hexstr=order['zone']),
            int(order['orderType']),
            int(order['startTime']),
            int(order['endTime']),
            to_bytes(hexstr=order['zoneHash']),
            int(order['salt']),
            to_bytes(hexstr=order['conduitKey']),
            int(order['counter'])
        ]
    ))
    
    return to_hex(order_hash)

def submit_listing_to_opensea(
    network_id: str,
    order: dict,
    api_key: str,
    wallet: Wallet
) -> Optional[dict]:
    """Submit listing to OpenSea API."""
    
    # Create the initial payload
    payload = {
        "parameters": {
            "orderType": 0,
            "consideration": [
                {
                    "itemType": 0,
                    "token": "0x0000000000000000000000000000000000000000",
                    "identifierOrCriteria": 0,
                    "startAmount": "975000000000000000",
                    "endAmount": "975000000000000000",
                    "recipient": "0x1fc53ac4d509839EC35003512905606a9e1D8b41"
                },
                {
                    "itemType": 0,
                    "token": "0x0000000000000000000000000000000000000000",
                    "identifierOrCriteria": 0,
                    "startAmount": "25000000000000000",
                    "endAmount": "25000000000000000",
                    "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719"
                }
            ],
            "offer": [
                {
                    "itemType": 2,
                    "token": "0x341444B4B6C1D2FC9897Fe578361880dd3F77CF5",
                    "identifierOrCriteria": 0,
                    "startAmount": 1,
                    "endAmount": 1
                }
            ],
            "offerer": "0x1fc53ac4d509839EC35003512905606a9e1D8b41",
            "startTime": 1737276045,
            "endTime": 1752914442,
            "zone": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "salt": "24446860302761739304752683030156737591518664810215442929813199115111869615072",
            "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            "totalOriginalConsiderationItems": 2,
            "counter": "0"
        },
        "protocol_address": "0x0000000000000068f116a894984e2db1123eb395"
    }

    # Create typed data for signing using the parameters
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            **EIP_712_ORDER_TYPE
        },
        "primaryType": "OrderComponents",
        "domain": {
            "name": SEAPORT_CONTRACT_NAME,
            "version": SEAPORT_CONTRACT_VERSION,
            "chainId": "84532",
            "verifyingContract": CROSS_CHAIN_SEAPORT_ADDRESS
        },
        "message": payload["parameters"]
    }

    # Sign the payload
    typed_data_json = json.dumps(typed_data)
    typed_data_hash = keccak(text=typed_data_json).hex()
    payload_signature = wallet.sign_payload(typed_data_hash)
    signed_payload = payload_signature.wait()
    
    if signed_payload.status == PayloadSignature.Status.FAILED:
        logger.error("Failed to sign the listing")
        return None

    # Update payload with the signature
    payload["signature"] = signed_payload.signature

    # Map CDP network IDs to OpenSea API network IDs
    network_mapping = {
        "base-sepolia": "base_sepolia",
        "base": "base"
    }
    opensea_network = network_mapping.get(network_id, network_id)
    
    # Choose API URL based on network
    base_url = OPENSEA_TESTNET_API_URL if "sepolia" in network_id else OPENSEA_API_URL
    api_url = f"{base_url}/orders/{opensea_network}/seaport/listings"

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": api_key  # Note: using lowercase x-api-key
    }

    logger.debug(f"Submitting listing to OpenSea API: {api_url}")
    logger.debug(f"Payload: {json.dumps(payload, indent=2)}")
    response = requests.post(api_url, headers=headers, json=payload)
    
    if response.status_code == 200:
        return response.json()
    else:
        logger.error(f"OpenSea API error: {response.status_code} - {response.text}")
        return None

def list_nft(
    wallet: Wallet,
    contract_address: str,
    token_id: str,
    price_in_wei: str,
    duration_in_seconds: int = 15552000,
    api_key: str = 'eb3f0c5ed549496bae57bc112d871a37'
) -> str:
    """List an NFT for sale on OpenSea using off-chain signature."""
    logger.debug(f"Creating listing for NFT {token_id} from contract {contract_address}")
    logger.debug(f"Price: {price_in_wei} wei, Duration: {duration_in_seconds} seconds")

    current_time = int(time.time())
    end_time = current_time + duration_in_seconds

    # Calculate fees (2.5% OpenSea fee)
    base_amount = int(price_in_wei)
    fee_amount = int(base_amount * 0.025)  # 2.5% fee
    seller_amount = base_amount - fee_amount
    
    logger.debug(f"Fee calculation: Base={base_amount}, Fee={fee_amount}, Seller gets={seller_amount}")

    # Create order components with exact format matching OpenSea
    order = {
        "offerer": wallet.default_address.address_id,
        "zone": "0x0000000000000000000000000000000000000000",
        "offer": [
            {
                "itemType": "2",
                "token": contract_address,
                "identifierOrCriteria": token_id,
                "startAmount": "1",
                "endAmount": "1"
            }
        ],
        "consideration": [
            {
                "itemType": "0",
                "token": "0x0000000000000000000000000000000000000000",
                "identifierOrCriteria": "0",
                "startAmount": str(seller_amount),
                "endAmount": str(seller_amount),
                "recipient": wallet.default_address.address_id
            },
            {
                "itemType": "0",
                "token": "0x0000000000000000000000000000000000000000",
                "identifierOrCriteria": "0",
                "startAmount": str(fee_amount),
                "endAmount": str(fee_amount),
                "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719"
            }
        ],
        "orderType": "0",
        "startTime": str(current_time),
        "endTime": str(end_time),
        "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "salt": str(random.randint(0, 2**256 - 1)),
        "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
        "counter": "0"
    }
    
    logger.debug("Created order structure:")
    logger.debug(json.dumps(order, indent=2))

    # Create EIP-712 typed data
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            **EIP_712_ORDER_TYPE
        },
        "primaryType": "OrderComponents",
        "domain": {
            "name": SEAPORT_CONTRACT_NAME,
            "version": SEAPORT_CONTRACT_VERSION,
            "chainId":  "84532",
            "verifyingContract": CROSS_CHAIN_SEAPORT_ADDRESS
        },
        "message": order
    }
    
    logger.debug("Created EIP-712 typed data:")
    logger.debug(json.dumps(typed_data, indent=2))

    try:
        logger.debug("Attempting to sign payload...")
        
        # Convert typed data to JSON and hash it
        typed_data_json = json.dumps(typed_data)
        typed_data_hash = keccak(text=typed_data_json).hex()
        logger.debug(f"Created hash of typed data: {typed_data_hash}")
        
        # Sign the hash
        payload_signature = wallet.sign_payload(typed_data_hash)
        logger.debug("Created payload signature request")
        
        # Wait for signature
        signed_payload = payload_signature.wait()
        logger.debug(f"Signature status: {signed_payload.status}")
        
        if signed_payload.status == PayloadSignature.Status.FAILED:
            logger.error("Failed to sign the listing")
            return "Error: Failed to sign the listing"
            
        logger.debug(f"Signature received: {signed_payload.signature[:10]}...")
        
        # Calculate order hash
        order_hash = get_order_hash(typed_data)
        logger.debug(f"Calculated order hash: {order_hash}")
        
        # Check order status
        status = get_order_status(wallet.network_id, order_hash)
        logger.debug(f"Order status: {status}")
        
        is_valid = not (
            status.get("isValidated", False) or 
            status.get("isCancelled", False) or 
            int(status.get("totalFilled", 0)) > 0
        )
            
        if api_key:
            # Submit to OpenSea API
            result = submit_listing_to_opensea(
                network_id=wallet.network_id,
                order=order,
                api_key=api_key,
                wallet=wallet
            )
            
            if result:
                return (
                    f"Successfully listed NFT {token_id} from contract {contract_address}\n"
                    f"Price: {price_in_wei} wei\n"
                    f"Order Hash: {result.get('order_hash')}\n"
                    f"Created: {result.get('created_date')}\n"
                    f"Listing URL: {result.get('protocol_data', {}).get('parameters', {}).get('listing_url')}"
                )

        # Return signature if API submission failed or no API key provided
        return (
            f"Created listing signature for NFT {token_id} from contract {contract_address}\n"
            f"Price: {price_in_wei} wei\n"
            f"Order Hash: {order_hash}\n"
            f"Order Status: {'Valid' if is_valid else 'Invalid'}\n"
            f"Typed Data: {typed_data_json}\n"
            f"Signature: {signed_payload.signature}\n"
            f"Order valid until: {end_time}"
        )
    except Exception as e:
        logger.error(f"Error creating listing: {e!s}", exc_info=True)
        return f"Error creating listing: {e!s}"

class ListNftAction(CdpAction):
    """OpenSea NFT listing action."""
    
    name: str = "list_nft_opensea"
    description: str = LIST_NFT_PROMPT
    args_schema: type[BaseModel] | None = ListNftInput
    func: Callable[..., str] = list_nft
