import type { Evaluator, Memory, State, Action } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { searchMemeTokensAction } from "../actions/search-meme-tokens";
import { postTwitterUpdateAction } from "../actions/post-twitter-update";
import type { MemeTokenProviderAPI } from "../providers/meme-token.provider";
import type { MemeTokenData } from "../types";

export const SYSTEM_ROOM_ID = "00000000-0000-0000-0000-000000000000";

export const isNewMemeToken: Evaluator = {
    name: "is-new-meme-token",
    description: "Automatically searches for new meme tokens on startup and hourly",
    similes: ["FIND_NEW_MEME_TOKENS", "DISCOVER_MEME_TOKENS", "SCAN_MEME_TOKENS"],
    examples: [{
        context: "Searching for new meme tokens",
        messages: [{
            user: "system",
            content: { text: "Check for new meme tokens" }
        }],
        outcome: "Found new meme tokens to track"
    }],
    handler: async (runtime) => {
        try {
            // Get provider API
            const providerInstance = runtime.providers.find(p => p.get && typeof p.get === 'function');
            if (!providerInstance) {
                elizaLogger.error("Meme token provider not found");
                return false;
            }

            const provider = await providerInstance.get(runtime, {
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: SYSTEM_ROOM_ID,
                content: { text: "get config" }
            }) as MemeTokenProviderAPI;

            // Get config
            const config = provider.getConfig();

            // Search for top 10 meme tokens
            const state: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                roomId: SYSTEM_ROOM_ID,
                recentMessages: "",
                recentMessagesData: [],
                actors: "",
                minMarketCap: config.minMarketCap,
                limit: 10,
                sortBy: "mc",
                sortType: "desc"
            };

            const result = await runtime.processActions(
                { 
                    userId: runtime.agentId,
                    agentId: runtime.agentId,
                    roomId: SYSTEM_ROOM_ID,
                    content: { text: "search meme tokens" }
                } as Memory,
                [],
                state
            ) as unknown as { success: boolean; data: { tokens: MemeTokenData[] } };

            if (result?.success && result.data?.tokens?.length > 0) {
                // Post tweet about new tokens
                await runtime.processActions(
                    {
                        userId: runtime.agentId,
                        agentId: runtime.agentId,
                        roomId: SYSTEM_ROOM_ID,
                        content: {
                            text: "post meme token update",
                            params: {
                                token: result.data.tokens[0],
                                updateType: 'new_token'
                            }
                        }
                    } as Memory,
                    [],
                    state
                );
            }

            elizaLogger.info(`Processed meme token search`);
            return true;
        } catch (error) {
            elizaLogger.error("Error in meme token evaluator:", error);
            return false;
        }
    },
    validate: async (runtime) => {
        try {
            return runtime.providers.some(p => p.get && typeof p.get === 'function');
        } catch (error) {
            return false;
        }
    },
    alwaysRun: true
}; 