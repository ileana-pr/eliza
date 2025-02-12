import type { Action } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import type { MemeTokenData } from "../types";
import type { HolderAnalysis } from "./analyze-holders";

export interface UpdateData {
    token: MemeTokenData;
    updateType: 'price_change' | 'holder_change' | 'new_token';
    holderAnalysis?: HolderAnalysis;
    priceChange?: number;
}

export const postTwitterUpdateAction: Action = {
    name: "post-twitter-update",
    description: "Post meme token updates to Twitter",
    similes: ["POST_MEME_UPDATE", "TWEET_MEME_UPDATE", "SHARE_MEME_UPDATE"],
    examples: [[{
        user: "user",
        content: { text: "Post a meme token update" }
    }]],
    validate: async (context) => {
        const twitterClient = context.clients['twitter'];
        if (!twitterClient) {
            elizaLogger.error("❌ Twitter client not available");
            return false;
        }
        return true;
    },
    handler: async (context, message) => {
        try {
            elizaLogger.info("🐦 Starting Twitter update process...");
            const updateData = message.content as unknown as UpdateData;
            const { token, updateType, holderAnalysis, priceChange } = updateData;

            elizaLogger.info(`📝 Preparing ${updateType} update for ${token.symbol}...`);
            let content = '';

            // Format message based on update type
            if (updateType === 'new_token') {
                elizaLogger.info(`🆕 Formatting new token alert: ${token.symbol}`);
                content = `🚀 New Token Alert: $${token.symbol} 🚀\n\n` +
                         `Name: ${token.name}\n` +
                         `Price: $${token.price.toFixed(6)}\n` +
                         `Market Cap: $${(token.marketCap / 1000000).toFixed(2)}M\n` +
                         `24h Volume: $${(token.volume24h / 1000000).toFixed(2)}M\n\n` +
                         `#Solana #${token.symbol} #SolanaMemeTokens`;
            } else if (updateType === 'price_change') {
                elizaLogger.info(`💰 Formatting price update: ${token.symbol} changed by ${priceChange}%`);
                content = `🚨 $${token.symbol} Price Alert 🚨\n\n` +
                         `Price: $${token.price.toFixed(6)} (${priceChange! >= 0 ? '+' : ''}${priceChange!.toFixed(2)}%)\n` +
                         `Market Cap: $${(token.marketCap / 1000000).toFixed(2)}M\n` +
                         `24h Volume: $${(token.volume24h / 1000000).toFixed(2)}M\n\n` +
                         `#Solana #${token.symbol} #SolanaMemeTokens`;
            } else if (updateType === 'holder_change' && holderAnalysis) {
                elizaLogger.info(`👥 Formatting holder update: ${token.symbol} with ${holderAnalysis.longTermHolders} long-term holders`);
                content = `📊 $${token.symbol} Holder Update 📊\n\n` +
                         `Long-term Holders: ${holderAnalysis.longTermHolders} (${holderAnalysis.longTermHoldingPercent.toFixed(2)}%)\n` +
                         `Average Holding Time: ${holderAnalysis.averageHoldingTime.toFixed(1)} days\n` +
                         `Price: $${token.price.toFixed(6)}\n\n` +
                         `#Solana #${token.symbol} #SolanaMemeTokens`;
            }

            // Get the Twitter client from the runtime's clients
            elizaLogger.info("🔄 Getting Twitter client...");
            const twitterClient = context.clients['twitter'];
            if (!twitterClient) {
                elizaLogger.error("❌ Twitter client not available");
                throw new Error("Twitter client not available");
            }

            // Post to Twitter using the client's post functionality
            elizaLogger.info("📤 Posting to Twitter...");
            await twitterClient.post.sendStandardTweet(twitterClient.client, content);

            elizaLogger.info(`✅ Successfully posted ${updateType} update for ${token.symbol} to Twitter`);
            elizaLogger.info("Tweet content:", content);

            return {
                success: true,
                message: `Successfully posted ${updateType} update to Twitter`,
                data: { content }
            };
        } catch (error) {
            elizaLogger.error("❌ Error posting to Twitter:", error);
            throw error;
        }
    }
}; 