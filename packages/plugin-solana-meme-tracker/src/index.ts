import type { MemeTokenData } from "./types";
import axios from "axios";
import type { IAgentRuntime, Plugin } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { searchMemeTokensAction } from "./actions/search-meme-tokens";
import { analyzeHoldersAction } from "./actions/analyze-holders";
import { postTwitterUpdateAction } from "./actions/post-twitter-update";
import { isNewMemeToken } from "./evaluators/is-new-meme-token";
import { hasSignificantChange } from "./evaluators/has-significant-change";
import { memeTokenProvider } from "./providers/meme-token.provider";

export * from "./types";

// Log plugin initialization
elizaLogger.info("┌────────────────────────────────────────┐");
elizaLogger.info("│       SOLANA MEME TRACKER PLUGIN       │");
elizaLogger.info("├────────────────────────────────────────┤");
elizaLogger.info("│  Initializing Meme Tracker Services... │");
elizaLogger.info("│  Version: 0.1.0                        │");
elizaLogger.info("└────────────────────────────────────────┘");

// Test Birdeye connection on startup
const testBirdeyeConnection = async (apiKey: string) => {
    try {
        elizaLogger.info("\n=== Testing Birdeye Connection ===");
        elizaLogger.info(`Using API Key: ${apiKey.substring(0, 8)}...`);
        
        const response = await axios.get('https://public-api.birdeye.so/defi/tokenlist', {
            headers: {
                'X-API-KEY': apiKey,
                'Accept': 'application/json',
                'x-chain': 'solana'
            },
            params: {
                sort_by: 'v24hUSD',
                sort_type: 'desc',
                offset: 0,
                limit: 5,
                min_liquidity: 100
            }
        });

        if (!response.data?.success || !response.data?.data?.tokens) {
            elizaLogger.error("❌ Failed to connect to Birdeye API");
            elizaLogger.error("Response:", JSON.stringify(response.data, null, 2));
            return;
        }

        const tokens = response.data.data.tokens;
        elizaLogger.info(`✅ Successfully connected to Birdeye`);
        elizaLogger.info(`📊 Sample token data (top 5 by volume):`);
        tokens.slice(0, 5).forEach((token: any) => {
            elizaLogger.info(`
Token: ${token.symbol || 'UNKNOWN'}
- Address: ${token.address || 'N/A'}
- Price: $${Number(token.price || 0).toFixed(6)}
- Market Cap: $${(Number(token.mc || 0) / 1000000).toFixed(2)}M
- 24h Volume: $${(Number(token.v24hUSD || 0) / 1000000).toFixed(2)}M
-------------------`);
        });
    } catch (error: any) {
        elizaLogger.error("❌ Error testing Birdeye connection:", error.message);
        if (error.response?.data && typeof error.response.data !== 'string') {
            elizaLogger.error("API Error:", {
                status: error.response.status,
                message: error.response.data.message || 'Unknown error'
            });
        }
    }
};

// Test connection immediately with more detailed logging
const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
elizaLogger.info("Checking Birdeye API key configuration...");
if (birdeyeApiKey) {
    elizaLogger.info("✅ Birdeye API key found");
    testBirdeyeConnection(birdeyeApiKey).catch(error => {
        elizaLogger.error("❌ Failed to test Birdeye connection:", error.message);
    });
} else {
    elizaLogger.error("❌ No Birdeye API key configured in environment variables");
}

interface ActionContext extends IAgentRuntime {
    content?: {
        text?: string;
        action?: string;
    };
    roomId?: string;
}

// Initialize plugin in read-only mode if no wallet is configured
const walletPublicKey = process.env.SOLANA_PUBLIC_KEY || process.env.WALLET_PUBLIC_KEY;
if (!walletPublicKey) {
    elizaLogger.warn("⚠️ No wallet configured - running in read-only mode");
}

export const solanaMemeTrackerPlugin: Plugin = {
    name: "solana-meme-tracker",
    description: "Plugin for tracking and analyzing Solana meme tokens and posting updates to Twitter",
    actions: [
        searchMemeTokensAction,
        ...(walletPublicKey ? [analyzeHoldersAction] : []), // Only include holder analysis if wallet configured
        postTwitterUpdateAction
    ],
    evaluators: [
        isNewMemeToken,
        hasSignificantChange
    ],
    providers: [
        memeTokenProvider
    ]
};

export default solanaMemeTrackerPlugin; 