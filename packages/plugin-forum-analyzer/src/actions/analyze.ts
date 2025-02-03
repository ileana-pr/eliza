import { 
    type Action,
    type Memory,
    type State,
    type HandlerCallback,
    type IAgentRuntime,
    ModelClass,
    elizaLogger,
    composeContext,
    generateMessageResponse
} from "@elizaos/core";
import { DiscourseClient } from "../platforms/discourse";
import { DiscordClient } from "../platforms/discord";
import { CommonwealthClient } from "../platforms/commonwealth";
import { analyzeDiscussion } from "../analysis";
import { ProposalGenerator } from "../proposal/generator";
import { ProposalWorkflow } from "../proposal/workflow";
import type { ForumAnalyzerPlugin } from "..";

export const analyzeForumAction: Action = {
    name: "ANALYZE_FORUM",
    similes: ["ANALYZE_DISCUSSIONS", "SCAN_FORUM", "REVIEW_DISCUSSIONS"],
    description: "Analyzes forum discussions to identify potential governance proposals",
    examples: [
        [{
            user: "user",
            content: { text: "Analyze recent forum discussions" }
        }],
        [{
            user: "user",
            content: { text: "Check Discord for governance proposals" }
        }],
        [{
            user: "user",
            content: { text: "Review Commonwealth discussions from last week" }
        }]
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        // Check if plugin is properly configured
        const plugin = runtime.plugins.find(p => p.name === "forum-analyzer");
        return !!plugin;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: Record<string, unknown>,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            elizaLogger.info("[ANALYZE_FORUM] Starting discussion analysis");
            
            const plugin = runtime.plugins.find(p => p.name === "forum-analyzer") as ForumAnalyzerPlugin;
            if (!plugin) {
                if (callback) {
                    callback({
                        text: "Forum analyzer plugin is not properly configured",
                        content: { error: "Plugin not found" }
                    });
                }
                return false;
            }

            const platform = options?.platform as string || "discourse";
            const timeframe = options?.timeframe as string || "week";
            const category = options?.category as string;
            const limit = options?.limit as number || 30;

            const results = await plugin.analyzeForum(platform, {
                timeframe,
                category,
                limit,
            });

            if (results.length === 0) {
                if (callback) {
                    callback({
                        text: "No potential governance proposals found in the analyzed discussions.",
                        content: { results }
                    });
                }
                return true;
            }

            // Generate summary response
            let responseText = `Found ${results.length} potential governance proposals:\n\n`;
            
            results.forEach((analysis, index) => {
                responseText += `${index + 1}. Proposal Potential: ${Math.round(analysis.proposalPotential.score * 100)}%\n`;
                responseText += `   Confidence: ${Math.round(analysis.proposalPotential.confidence * 100)}%\n`;
                responseText += `   Reasons:\n${analysis.proposalPotential.reasons.map(r => `   - ${r}`).join('\n')}\n`;
                
                if (analysis.sentiment) {
                    responseText += `   Sentiment: ${analysis.sentiment.score} (magnitude: ${analysis.sentiment.magnitude})\n`;
                }
                
                if (analysis.keywords?.length) {
                    responseText += `   Keywords: ${analysis.keywords.join(', ')}\n`;
                }
                
                if (analysis.summary) {
                    responseText += `   Summary: ${analysis.summary}\n`;
                }
                
                responseText += '\n';
            });

            if (callback) {
                callback({
                    text: responseText,
                    content: { results }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("[ANALYZE_FORUM] Error during discussion analysis", error);
            if (callback) {
                callback({
                    text: `Error analyzing forum: ${error.message}`,
                    content: { error: error.message }
                });
            }
            return false;
        }
    }
};  