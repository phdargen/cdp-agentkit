# Across Action Provider

This directory contains the **AcrossActionProvider** implementation, which provides actions to interact with the **Across Protocol** for bridging tokens across multiple EVM chains.

## Directory Structure

```
across/
├── acrossActionProvider.ts        # Main provider with Across Protocol functionality
├── acrossActionProvider.test.ts   # Tests
├── schemas.ts                     # Bridge token schema
├── utils.ts                       # Utility functions for Across integration
├── index.ts                       # Main exports
└── README.md                      # This file
```

## Actions

- `bridge_token`: Bridge tokens from one chain to another using the Across Protocol
- `check_deposit_status`: Check the status of a cross-chain bridge deposit on the Across Protocol 

## Adding New Actions

To add new Across actions:

1. Define your action schema in `schemas.ts`
2. Implement the action in `acrossActionProvider.ts`
3. Add tests in `acrossActionProvider.test.ts`

## Network Support

The Across provider supports cross-chain transfers between EVM-compatible chains, for example:
- Ethereum Mainnet to Base Mainnet
- Base Sepolia to Ethereum Sepolia
The status of bridge deposit can only be checked on Mainnets.

## Configuration

The provider requires the following configuration:
- `privateKey`: Private key of the wallet provider

## Notes

For more information on the **Across Protocol**, visit [Across Protocol Documentation](https://docs.across.to/). 