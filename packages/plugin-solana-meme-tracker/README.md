# Solana Meme Tracker Plugin

A plugin for tracking and analyzing Solana meme tokens with real-time market data from Birdeye API and optional Twitter integration.

## Features

- Real-time token tracking using Birdeye API
- Market data monitoring including:
  - Price movements
  - Trading volume
  - Market capitalization
  - Liquidity
- Token security analysis
- Optional Twitter integration for automated updates
- Configurable tracking parameters
- Read-only mode support (when no wallet is configured)

## Prerequisites

- Birdeye API Key
- (Optional) Solana Wallet Public Key for holder analysis
- (Optional) Twitter API credentials for posting updates

## Configuration

### Environment Variables

```env
BIRDEYE_API_KEY=your_birdeye_api_key
SOLANA_PUBLIC_KEY=your_wallet_public_key  # Optional
WALLET_PUBLIC_KEY=your_wallet_public_key   # Alternative to SOLANA_PUBLIC_KEY
BIRDEYE_SEARCH_LIMIT=50                    # Optional, defaults to 50
```

### Default Configuration

- Minimum Market Cap: $10M
- Price Change Threshold: 10%
- Holder Increase Threshold: 5%
- Long-term Holder Threshold: 5%
- Default Search Limit: 50 tokens
- Minimum Liquidity: $100

## Token Tracking Criteria

The plugin tracks tokens based on:
- 24h Trading Volume
- Market Capitalization
- Liquidity Levels
- Price Changes
- Holder Distribution (when wallet configured)

## Security Features

Tokens are analyzed for potential risks including:
- Top holder concentration (>80% considered risky)
- Honeypot detection
- Rug pull indicators

## API Integration

### Birdeye API

The plugin uses Birdeye's V1 API endpoints:
- `/defi/tokenlist` - For fetching token market data
- Configurable sorting and filtering:
  - Sort by 24h volume
  - Minimum liquidity requirements
  - Customizable result limits

## Usage

The plugin initializes automatically and provides:

1. Startup Diagnostics:
   - API key validation
   - Connection testing
   - Sample token data display

2. Available Actions:
   - `searchMemeTokens` - Search and analyze meme tokens
   - `analyzeHolders` - Analyze holder distribution (requires wallet)
   - `postTwitterUpdate` - Post updates to Twitter

3. Automatic Evaluations:
   - New token detection
   - Significant change monitoring

## Example Output

On startup, the plugin displays:
```
┌────────────────────────────────────────┐
│       SOLANA MEME TRACKER PLUGIN       │
├────────────────────────────────────────┤
│  Initializing Meme Tracker Services... │
│  Version: 0.1.0                        │
└────────────────────────────────────────┘
```

Sample token data includes:
```
Token: SYMBOL
- Address: token_address
- Price: $X.XXXXXX
- Market Cap: $XX.XXM
- 24h Volume: $XX.XXM
```

## Error Handling

The plugin includes robust error handling for:
- API connection issues
- Rate limiting
- Authentication errors
- Invalid responses
- HTML response detection and filtering

## Development

The plugin is built with TypeScript and integrates with the Eliza OS core system. It uses:
- Axios for API requests
- Custom interceptors for response handling
- Type-safe interfaces for data management

## License

MIT
