const { OpenSeaSDK, Chain } = require('opensea-js');
const ethers = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function main() {
    console.log('Starting script...');

    // Get wallet data
    const WALLET_ADDRESS = "0xa8c1a5D3C372C65c04f91f87a43F549619A9483f";
    const NFT_CONTRACT = "0x8612416a36f4A0295fC10FB23443730714dA51da";
    const TOKEN_ID = 0;
    const SEED_PHRASE = "";

    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromMnemonic(SEED_PHRASE);
    console.log(`Derived wallet address: ${wallet.address}`);

    // Connect wallet to provider
    const provider = new ethers.providers.JsonRpcProvider('https://chain-proxy.wallet.coinbase.com?targetName=base-sepolia');
    const walletWithProvider = wallet.connect(provider);

    // Initialize OpenSea SDK
    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
        chain: Chain.BaseSepolia,
        apiKey: ''
    });

    try {
        // Create the listing
        console.log('Creating listing...');
        
        const listing = await openseaSDK.createListing({
            asset: {
                tokenId: TOKEN_ID.toString(),
                tokenAddress: NFT_CONTRACT,
                schemaName: 'ERC721'
            },
            startAmount: ethers.utils.parseEther('1.0'),
            endAmount: ethers.utils.parseEther('1.0'),
            expirationTime: Math.round(Date.now() / 1000 + 15552000),
            quantity: 1,
            paymentTokenAddress: '0x0000000000000000000000000000000000000000',
            accountAddress: WALLET_ADDRESS
        });

        console.log('Listing created successfully!');
        console.log('Listing details:', JSON.stringify(listing, null, 2));

    } catch (error) {
        console.error('Error creating listing:', error);
    }
}

main().catch(console.error); 