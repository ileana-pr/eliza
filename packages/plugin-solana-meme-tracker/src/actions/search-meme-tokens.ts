import type { Action, IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import type { MemeTokenData } from "../types";
import type { MemeTokenProviderAPI } from "../providers/meme-token.provider";
import { SYSTEM_ROOM_ID } from "../evaluators/is-new-meme-token";

interface ActionContext extends IAgentRuntime {
    content?: {
        text?: string;
        action?: string;
    };
    roomId?: string;
}

export const searchMemeTokensAction: Action = {
    name: "search-meme-tokens",
    description: "Search for meme tokens using meme token provider",
    similes: ["SEARCH_MEME_TOKENS", "FIND_MEME_TOKENS", "GET_MEME_TOKENS"],
    examples: [[{
        user: "user",
        content: { text: "Search for meme tokens" }
    }]],
    validate: async (context: ActionContext) => {
        try {
            // Skip validation for initialization messages
            if (context.content?.action === "initialize") {
                elizaLogger.info("⏭️ Skipping validation for initialization message");
                return true;
            }

            // Validate Birdeye API key
            const birdeyeApiKey = context.getSetting("BIRDEYE_API_KEY");
            if (!birdeyeApiKey) {
                elizaLogger.error("❌ Birdeye API key not configured in settings");
                return false;
            }

            // For non-initialization actions, require content
            if (!context.content?.text) {
                elizaLogger.debug("⚠️ Empty message content, skipping validation");
                return false;
            }

            // Validate provider
            const provider = await context.providers.find(p => p.get)?.get(context, {
                userId: context.agentId,
                agentId: context.agentId,
                roomId: SYSTEM_ROOM_ID,
                content: { 
                    text: "validate meme token provider",
                    action: "validate"
                }
            }) as MemeTokenProviderAPI;

            if (!provider) {
                elizaLogger.error("❌ Meme token provider not found");
                return false;
            }

            return true;
        } catch (error) {
            elizaLogger.error("❌ Error validating meme token action:", error);
            return false;
        }
    },
    handler: async (context: ActionContext) => {
        // Skip processing for initialization messages
        if (!context.content?.text && context.content?.action === "initialize") {
            elizaLogger.info("⏭️ Skipping initialization message");
            return {
                success: true,
                data: {
                    totalTokens: 0,
                    tokens: []
                }
            };
        }

        elizaLogger.info("\n🔍 Starting meme token search action...");
        elizaLogger.info("Context:", {
            userId: context.agentId,
            roomId: context.roomId,
            content: context.content
        });

        try {
            // Get meme token provider
            elizaLogger.info("Looking for meme token provider...");
            const provider = await context.providers.find(p => p.get)?.get(context, {
                userId: context.agentId,
                agentId: context.agentId,
                roomId: SYSTEM_ROOM_ID,
                content: { 
                    text: context.content?.text || "search meme tokens",
                    action: "search"
                }
            }) as MemeTokenProviderAPI;

            if (!provider) {
                throw new Error("❌ Meme token provider not found");
            }

            elizaLogger.info("✅ Provider found, fetching token data...");

            // Search for meme tokens
            const tokens = await provider.getTrackedTokens();

            if (!tokens || tokens.length === 0) {
                elizaLogger.warn("⚠️ No meme tokens found");
                return {
                    success: true,
                    data: {
                        totalTokens: 0,
                        tokens: []
                    }
                };
            }

            elizaLogger.info(`\n✅ Found ${tokens.length} meme tokens`);
            elizaLogger.info("\n📈 Top 5 Tokens by Market Cap:");
            tokens
                .sort((a, b) => b.marketCap - a.marketCap)
                .slice(0, 5)
                .forEach(token => {
                    elizaLogger.info(`
${token.symbol} (${token.name})
- Price: $${token.price.toFixed(6)}
- Market Cap: $${(token.marketCap / 1000000).toFixed(2)}M
- 24h Volume: $${(token.volume24h / 1000000).toFixed(2)}M
- 24h Change: ${token.priceChange24h.toFixed(2)}%
- Holders: ${token.holders.toLocaleString()}
- Liquidity: $${(token.liquidityUSD / 1000000).toFixed(2)}M
-------------------`);
                });

            return {
                success: true,
                data: {
                    totalTokens: tokens.length,
                    tokens: tokens
                }
            };
        } catch (error) {
            elizaLogger.error("❌ Error searching meme tokens:", error);
            if (error.response) {
                elizaLogger.error("API Response error:", {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            return {
                success: false,
                error: error.message
            };
        }
    }
}; 