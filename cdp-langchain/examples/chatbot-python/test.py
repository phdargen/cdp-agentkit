import requests
import json
import time
from eth_account import Account
from eth_account.messages import encode_typed_data

print("Starting script...")  # Debug print

# Constants
OPENSEA_TESTNET_API_URL = "https://testnets-api.opensea.io/v2"
API_KEY = ""
PRIVATE_KEY = ""

print("Creating listing payload...")  # Debug print

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

def create_listing_payload(
    offerer: str,
    token: str,
    token_id: int,
    price_wei: int,
    duration: int = 15552000  # 6 months
):
    """Create a listing payload with proper parameters."""
    print(f"Creating payload for {token_id} from {token}")  # Debug print
    current_time = int(time.time())
    end_time = current_time + duration

    # Calculate fees (2.5% OpenSea fee)
    fee_amount = int(price_wei * 0.025)  # 2.5% fee
    seller_amount = price_wei - fee_amount
    
    print(f"Fee calculation: Base={price_wei}, Fee={fee_amount}, Seller gets={seller_amount}")  # Debug print

    return {
        "parameters": {
            "orderType": 0,
            "offer": [
                {
                    "itemType": 2,  # ERC721
                    "token": token,
                    "identifierOrCriteria": token_id,
                    "startAmount": 1,
                    "endAmount": 1
                }
            ],
            "consideration": [
                {
                    "itemType": 0,  # ETH
                    "token": "0x0000000000000000000000000000000000000000",
                    "identifierOrCriteria": 0,
                    "startAmount": str(seller_amount),
                    "endAmount": str(seller_amount),
                    "recipient": offerer
                },
                {
                    "itemType": 0,  # ETH
                    "token": "0x0000000000000000000000000000000000000000",
                    "identifierOrCriteria": 0,
                    "startAmount": str(fee_amount),
                    "endAmount": str(fee_amount),
                    "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719"
                }
            ],
            "offerer": offerer,
            "startTime": current_time,
            "endTime": end_time,
            "zone": "0x0000000000000000000000000000000000000000",
            "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "salt": "0x0", 
            "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            "totalOriginalConsiderationItems": 2,
            "counter": "0"
        },
        "protocol_address": "0x0000000000000068f116a894984e2db1123eb395"
    }

def sign_listing(payload: dict, private_key: str) -> str:
    """Sign a listing payload using EIP-712."""
    print("Signing payload...")  # Debug print
    
    # Create the typed data structure
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
            "name": "Seaport",
            "version": "1.6",
            "chainId": 84532,  # Base Sepolia
            "verifyingContract": "0x0000000000000068f116a894984e2db1123eb395"
        },
        "message": payload["parameters"]
    }

    print(f"Typed data: {json.dumps(typed_data, indent=2)}")  # Debug print

    # Create account from private key
    account = Account.from_key(private_key)
    print(f"Signing with account: {account.address}")  # Debug print
    
    # Sign the typed data
    signed_message = Account.sign_message(
        encode_typed_data(typed_data),
        private_key
    )
    
    print(f"Signature created: {signed_message.signature.hex()[:10]}...")  # Debug print
    return signed_message.signature.hex()

def test_submit_listing():
    """Test submitting a listing to OpenSea API."""
    print("\nStarting test_submit_listing...")  # Debug print
    
    # Create listing payload
    payload = create_listing_payload(
        offerer="0x1fc53ac4d509839EC35003512905606a9e1D8b41",  # Replace with your address
        token="0x341444B4B6C1D2FC9897Fe578361880dd3F77CF5",  # NFT contract
        token_id=0,  # NFT ID
        price_wei=1000000000000000000  # 1 ETH in wei
    )
    
    # Sign the payload
    signature = sign_listing(payload, PRIVATE_KEY)
    payload["signature"] = signature
    
    api_url = f"{OPENSEA_TESTNET_API_URL}/orders/base_sepolia/seaport/listings"
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": API_KEY
    }

    print("\nSubmitting listing to OpenSea API...")
    print(f"URL: {api_url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(api_url, headers=headers, json=payload)
    
    print(f"\nResponse status: {response.status_code}")
    print(f"Response body: {response.text}")

def simple_test():
    print("Running simple test")
    try:
        response = requests.get("https://api.opensea.io/api/v2/chain/info")
        print(f"OpenSea API response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    try:
        print("\n=== Starting OpenSea Listing Test ===\n")
        test_submit_listing()
        print("\n=== Test Complete ===\n")
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
    simple_test() 