import { 
    type Action,
    type Memory,
    type State,
    type HandlerCallback,
    AgentRuntime,
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
    const settings = state?.settings as { plugins?: { [key: string]: any } } | undefined;
    const config = settings?.plugins?.["forum-analyzer"];
    if (!config) {
        elizaLogger.error('[ForumAnalyzer] Plugin configuration not found in state.settings.plugins["forum-analyzer"]');
        throw new Error('Forum analyzer plugin configuration not found. Please check your configuration.');
    }
    return config as ForumAnalyzerConfig;
}

async function fetchPosts(platform: string, config: ForumAnalyzerConfig): Promise<ForumPost[]> {
    elizaLogger.debug(`[ForumAnalyzer] Fetching posts for ${platform}`);
    
    try {
        let client;
        const platformConfig = config.platforms[platform];
        
        if (!platformConfig) {
            throw new Error(`Platform ${platform} is not configured. Please check your configuration.`);
        }

        switch (platform) {
            case 'discourse':
                if (!platformConfig.url) {
                    throw new Error('Discourse platform requires a forum URL in configuration.');
                }
                client = new DiscourseClient(platformConfig);
                break;
            case 'discord':
                if (!platformConfig.token || !platformConfig.channels?.length) {
                    throw new Error('Discord platform requires a token and at least one channel ID.');
                }
                client = new DiscordClient(platformConfig);
                break;
            case 'commonwealth':
                if (!platformConfig.space) {
                    throw new Error('Commonwealth platform requires a space name in configuration.');
                }
                client = new CommonwealthClient(platformConfig);
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        const posts = await client.getPosts();
        elizaLogger.info(`[ForumAnalyzer] Retrieved ${posts.length} posts from ${platform}`);
        return posts;
    } catch (error) {
        elizaLogger.error(`[ForumAnalyzer] Error fetching posts from ${platform}:`, error);
        throw new Error(`Failed to fetch posts from ${platform}: ${error.message}`);
    }
}

async function analyzePosts(posts: ForumPost[], options: ForumAnalyzerConfig["analysisOptions"]): Promise<DiscussionAnalysis[]> {
    elizaLogger.info(`[ForumAnalyzer] Starting batch analysis of ${posts.length} posts`);
    
    const analyses = await Promise.all(posts.map(async (post, index) => {
        elizaLogger.info(`[ForumAnalyzer] Analyzing post ${index + 1}/${posts.length}: "${post.title}"`);
        const analysis = await analyzeDiscussion(post, options);
        return analysis;
    }));

    // Filter for high-potential governance proposals
    const threshold = options?.proposalThreshold || 0.7;
    const potentialProposals = analyses.filter(
        analysis => analysis.proposalPotential.governanceRelevance >= threshold
    );

    elizaLogger.info(`[ForumAnalyzer] Analysis complete:`, {
        totalPosts: posts.length,
        potentialProposals: potentialProposals.length,
        threshold: threshold,
        averageScore: potentialProposals.reduce((sum, a) => sum + a.proposalPotential.score, 0) / potentialProposals.length || 0
    });
    
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
    validate: async (runtime: InstanceType<typeof AgentRuntime>, _message: Memory) => {
        // Check if plugin is properly configured
        const plugin = runtime.plugins.find(p => p.name === "forum-analyzer");
        if (!plugin) {
            elizaLogger.error('[ForumAnalyzer] Plugin not found in runtime');
            return false;
        }
        return true;
    },
    handler: async (
        runtime: InstanceType<typeof AgentRuntime>,
        message: Memory,
        state?: State,
        options?: Record<string, unknown>,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.info(`[ForumAnalyzer] Starting forum analysis`, {
            character: runtime.character.name,
            messageId: message.id
        });
        
        try {
            if (!state) {
                throw new Error('State is required for forum analysis');
            }

            const config = getPlatformsFromState(state);
            const platforms = Object.keys(config.platforms);
            elizaLogger.info(`[ForumAnalyzer] Configured platforms: ${platforms.join(', ')}`);

            if (platforms.length === 0) {
                throw new Error('No platforms configured in forum analyzer plugin');
            }

            // Start with Discourse platform first since it's configured for public access
            if (config.platforms.discourse) {
                elizaLogger.info(`[ForumAnalyzer] Processing Discourse platform`, {
                    url: config.platforms.discourse.url,
                    options: config.analysisOptions
                });
                
                try {
                    const posts = await fetchPosts('discourse', config);
                    elizaLogger.info(`[ForumAnalyzer] Retrieved ${posts.length} posts from Discourse`);
                    
                    if (posts.length === 0) {
                        await callback({
                            text: "No posts found on the Discourse forum. Please check forum access and configuration.",
                            action: "COMPLETE"
                        });
                        return false;
                    }
                    
                    // Provide progress update
                    await callback({
                        text: `Starting analysis of ${posts.length} Discourse forum posts...`,
                        action: "CONTINUE"
                    });
                    
                    const analyses = await analyzePosts(posts, config.analysisOptions);
                    
                    // Provide final summary
                    await callback({
                        text: formatAnalysisResponse(analyses),
                        action: "COMPLETE",
                        data: { analyses }
                    });
                    
                    return true;
                } catch (error) {
                    elizaLogger.error(`[ForumAnalyzer] Error analyzing Discourse forum:`, {
                        error: error.message,
                        url: config.platforms.discourse.url
                    });
                    throw error;
                }
            }
            
            return false;
        } catch (error) {
            elizaLogger.error(`[ForumAnalyzer] Fatal error during forum analysis:`, {
                error: error.message,
                character: runtime.character.name,
                messageId: message.id
            });
            throw error;
        }
    }
};  