import type { Evaluator, EvaluationExample } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { searchMemeTokensAction } from "../actions/search-meme-tokens";
import { analyzeHoldersAction } from "../actions/analyze-holders";
import { postTwitterUpdateAction } from "../actions/post-twitter-update";
import type { MemeTokenData } from "../types";

let isFirstRun = true;

const evaluationExample: EvaluationExample = {
    context: "Checking for significant token changes",
    messages: [{
        user: "system",
        content: { text: "Check for token changes" }
    }],
    outcome: "Found significant token changes"
};

interface TokenUpdate {
    token: MemeTokenData;
    updateType: 'price_change' | 'holder_change';
    holderAnalysis: any;
}

export const hasSignificantChange: Evaluator = {
    name: "has-significant-change",
    description: "Evaluates if a token has significant changes in price or holders",
    similes: ["CHECK_TOKEN_CHANGES", "MONITOR_TOKENS", "TRACK_CHANGES"],
    examples: [evaluationExample],
    validate: async () => true,
    handler: async (context) => {
        try {
            // Create a UUID-formatted ID for the system user
            const systemId = "00000000-0000-0000-0000-000000000000";
            const memory = {
                userId: systemId as `${string}-${string}-${string}-${string}-${string}`,
                agentId: systemId as `${string}-${string}-${string}-${string}-${string}`,
                roomId: systemId as `${string}-${string}-${string}-${string}-${string}`,
                content: { text: "Check for significant changes" }
            };

            // If this is the first run, log initialization
            if (isFirstRun) {
                elizaLogger.info("🚀 Running initial meme token scan...");
                elizaLogger.info("Will post an update for the top token to verify the system is working");
            }

            // Search for tokens
            const searchResult = await searchMemeTokensAction.handler(context, memory);
            const searchData = searchResult as any;

            if (searchData?.success) {
                const tokens = searchData.data.tokens as MemeTokenData[];
                elizaLogger.info(`Found ${tokens.length} tokens to analyze`);

                // Collect all significant changes
                const significantUpdates: TokenUpdate[] = [];

                // Process each token
                for (const token of tokens) {
                    try {
                        const holderResult = await analyzeHoldersAction.handler(context, {
                            ...memory,
                            content: { text: `Analyze holders for ${token.symbol}`, token }
                        });
                        const holderData = holderResult as any;

                        if (holderData?.success) {
                            // On first run, include first token regardless of changes
                            // After first run, only include if there are significant changes
                            const shouldInclude = isFirstRun || 
                                Math.abs(token.priceChange24h) >= 10 || // 10% price change
                                holderData.data.holderChangePercent >= 5; // 5% holder change

                            if (shouldInclude) {
                                significantUpdates.push({
                                    token,
                                    updateType: token.priceChange24h >= 10 ? 'price_change' : 'holder_change',
                                    holderAnalysis: holderData.data
                                });

                                // If this is first run, we only need one token
                                if (isFirstRun) {
                                    break;
                                }
                            }
                        }
                    } catch (error) {
                        elizaLogger.error(`Error processing token ${token.symbol}:`, error);
                    }
                }

                // Post update if we have any significant changes
                if (significantUpdates.length > 0) {
                    // Format multi-token update message
                    const updateMessage = significantUpdates.map(update => {
                        const { token, updateType, holderAnalysis } = update;
                        if (updateType === 'price_change') {
                            return `$${token.symbol}: ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}% | MC: $${(token.marketCap / 1000000).toFixed(2)}M`;
                        } else {
                            return `$${token.symbol}: ${holderAnalysis.longTermHolders} holders (${holderAnalysis.longTermHoldingPercent.toFixed(2)}%)`;
                        }
                    }).join('\n');

                    // Post the combined update
                    await postTwitterUpdateAction.handler(context, {
                        ...memory,
                        content: {
                            text: `Meme Token Update\n\n${updateMessage}\n\n#Solana #SolanaMemeTokens`,
                            tokens: significantUpdates
                        }
                    });

                    if (isFirstRun) {
                        elizaLogger.info("✅ Posted initial update to verify system is working");
                        isFirstRun = false;
                    } else {
                        elizaLogger.info(`✅ Posted update for ${significantUpdates.length} tokens`);
                    }
                }
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in hasSignificantChange evaluator:", error);
            return false;
        }
    }
}; 