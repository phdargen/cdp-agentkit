# ENS Action Provider

This directory contains the **ENSActionProvider** implementation, which provides actions to interact with the **Ethereum Name Service (ENS)** on Ethereum networks.

## Directory Structure

```
ens/
├── ensActionProvider.ts         # Main provider with ENS functionality
├── ensActionProvider.test.ts    # Test file for ENS provider
├── schemas.ts                   # ENS action schemas
├── index.ts                     # Main exports
└── README.md                    # This file
```

## Actions

- `get_ens_address`: Resolve an ENS name to an Ethereum address

  - Takes an ENS name (e.g., 'vitalik.eth') as input
  - Returns the **Ethereum address** associated with the ENS name
  - Automatically normalizes ENS names using UTS-46 normalization

- `get_ens_name`: Reverse resolve an Ethereum address to an ENS name

  - Takes an Ethereum address as input
  - Returns the **primary ENS name** if one is configured
  - Useful for displaying human-readable names for addresses

- `get_ens_text`: Get a text record for an ENS name

  - Takes an ENS name and a text record key as inputs
  - Returns the **text record value**
  - Common keys include: 'description', 'url', 'avatar', 'email', 'com.twitter', 'com.github', 'com.discord'

- `get_ens_avatar`: Get the avatar URL for an ENS name

  - Takes an ENS name as input
  - Returns the **avatar URL**
  - Supports various avatar types (images, NFTs, etc.)

## Adding New Actions

To add new ENS actions:

1. Define your action schema in `schemas.ts`. See [Defining the input schema](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING-TYPESCRIPT.md#defining-the-input-schema) for more information.
2. Implement the action in `ensActionProvider.ts`
3. Implement tests in `ensActionProvider.test.ts`

## Network Support

The ENS provider currently supports:
- Ethereum Mainnet
- Ethereum Sepolia (testnet)
- Ethereum Goerli (testnet)

ENS is primarily an Ethereum-based service, though some other networks may have ENS support.

## Notes

For more information on **ENS**, visit [ENS Documentation](https://docs.ens.domains/).

For Viem ENS actions, see [Viem ENS Actions](https://viem.sh/docs/ens/actions/getEnsResolver).


