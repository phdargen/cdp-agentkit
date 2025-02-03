const { OpenSeaSDK, Chain } = require('opensea-js');
const { ethers } = require('ethers');
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

    // Create wallet from mnemonic using ethers v6
    const wallet = ethers.HDNodeWallet.fromPhrase(SEED_PHRASE);
    console.log(`Derived wallet address: ${wallet.address}`);

    // Connect wallet to provider using ethers v6
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const walletWithProvider = wallet.connect(provider);

    // Initialize OpenSea SDK
    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
        chain: Chain.BaseSepolia,
        apiKey: 'eb3f0c5ed549496bae57bc112d871a37'
    });

    try {
        // Create the listing
        console.log('Creating listing...');
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24);

        const listing = await openseaSDK.createListing({
            asset: {
                tokenId: TOKEN_ID.toString(),
                tokenAddress: NFT_CONTRACT,
                schemaName: 'ERC721'
            },
            startAmount: 1,
            endAmount: 1,
            expirationTime: expirationTime,
            quantity: 1,
            paymentTokenAddress: '0x0000000000000000000000000000000000000000',
            accountAddress: WALLET_ADDRESS
        });

        console.log('Listing created successfully!');
        // Handle BigInt serialization
        const listingStr = JSON.stringify(listing, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        , 2);
        console.log('Listing details:', listingStr);

    } catch (error) {
        console.error('Error creating listing:', error);
    }
}

main().catch(console.error); 