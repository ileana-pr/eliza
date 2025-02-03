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
import type { ForumPost, DiscussionAnalysis, ForumAnalyzerConfig, DiscourseConfig } from "../types";

// Helper functions
function getPlatformsFromState(state: State): ForumAnalyzerConfig {
    return state.plugins?.["forum-analyzer"] || { platforms: {} };
}

async function fetchPosts(platform: string, config: ForumAnalyzerConfig): Promise<ForumPost[]> {
    elizaLogger.debug(`[ForumAnalyzer] Fetching posts for ${platform}`);
    
    try {
        let client;
        switch (platform) {
            case 'discourse':
                client = new DiscourseClient(config.platforms.discourse);
                break;
            case 'discord':
                client = new DiscordClient(config.platforms.discord);
                break;
            case 'commonwealth':
                client = new CommonwealthClient(config.platforms.commonwealth);
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        const posts = await client.getPosts();
        elizaLogger.info(`[ForumAnalyzer] Retrieved ${posts.length} posts from ${platform}`);
        return posts;
    } catch (error) {
        elizaLogger.error(`[ForumAnalyzer] Error fetching posts from ${platform}:`, error);
        throw error;
    }
}

async function analyzePosts(posts: ForumPost[], options: ForumAnalyzerConfig["analysisOptions"]): Promise<DiscussionAnalysis[]> {
    elizaLogger.debug(`[ForumAnalyzer] Analyzing ${posts.length} posts`);
    
    const analyses = await Promise.all(posts.map(async post => {
        const analysis = await analyzeDiscussion(post, options);
        return analysis;
    }));

    // Filter for high-potential governance proposals
    const threshold = options?.proposalThreshold || 0.7;
    const potentialProposals = analyses.filter(
        analysis => analysis.proposalPotential.governanceRelevance >= threshold
    );

    elizaLogger.info(`[ForumAnalyzer] Found ${potentialProposals.length} potential governance proposals`);
    return potentialProposals;
}

function formatAnalysisResponse(analyses: DiscussionAnalysis[]): string {
    if (analyses.length === 0) {
        return "No significant governance proposals identified in recent discussions.";
    }

    const summary = analyses.map(analysis => {
        const score = Math.round(analysis.proposalPotential.governanceRelevance * 100);
        const consensus = Math.round(analysis.proposalPotential.consensus.level * 100);
        
        return `
📋 Potential Proposal: "${analysis.post.title}"
- Governance Relevance: ${score}%
- Community Consensus: ${consensus}%
- Key Points:
${analysis.proposalPotential.keyPoints.map(point => `  • ${point}`).join('\n')}
`;
    }).join('\n');

    return `
Found ${analyses.length} potential governance proposals:
${summary}

Would you like to:
1. Generate full proposals for any of these discussions
2. Analyze more discussions
3. Filter by different criteria
`;
}

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
        elizaLogger.info(`[ForumAnalyzer] Starting forum analysis for ${runtime.character.name}`);
        
        try {
            const platforms = getPlatformsFromState(state);
            elizaLogger.debug(`[ForumAnalyzer] Detected platforms: ${Object.keys(platforms).join(', ')}`);

            const allAnalyses: DiscussionAnalysis[] = [];

            for (const [platform, config] of Object.entries(platforms)) {
                elizaLogger.info(`[ForumAnalyzer] Analyzing platform: ${platform}`);
                
                try {
                    const posts = await fetchPosts(platform, config);
                    elizaLogger.debug(`[ForumAnalyzer] Fetched ${posts.length} posts from ${platform}`);
                    
                    const analyses = await analyzePosts(posts, config.analysisOptions);
                    allAnalyses.push(...analyses);
                    
                    // Provide immediate feedback for this platform
                    await callback({
                        text: `Analyzed ${platform}: Found ${analyses.length} potential proposals.`,
                        action: "CONTINUE"
                    });
                } catch (error) {
                    elizaLogger.error(`[ForumAnalyzer] Error analyzing ${platform}:`, error);
                    await callback({
                        text: `Error analyzing ${platform}: ${error.message}`,
                        action: "CONTINUE"
                    });
                }
            }
            
            // Provide final summary and options
            await callback({
                text: formatAnalysisResponse(allAnalyses),
                action: "COMPLETE",
                data: { analyses: allAnalyses }
            });
            
            elizaLogger.success(`[ForumAnalyzer] Completed forum analysis for all platforms`);
            return true;
        } catch (error) {
            elizaLogger.error(`[ForumAnalyzer] Error in forum analysis:`, error);
            return false;
        }
    }
};  