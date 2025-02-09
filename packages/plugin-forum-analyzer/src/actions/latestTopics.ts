import { 
    type Action,
    type Memory,
    type HandlerCallback,
    type IAgentRuntime,
    type Content,
    elizaLogger
} from "@elizaos/core";
import { DiscourseClient } from "../platforms/discourse";
import { ForumPost } from "../types";

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

function formatSummary(posts: ForumPost[]): string {
    if (posts.length === 0) {
        return "No recent forum discussions found.";
    }

    const header = "📢 Recent Forum Discussions\n" + "─".repeat(50) + "\n\n";
    
    const formattedPosts = posts.map((post, index) => {
        const date = formatDate(post.created_at);
        const number = (index + 1).toString().padStart(2, '0');
        
        // Extract DAO proposal ID if present
        const daoMatch = post.title.match(/\[DAO:([a-f0-9]+)\]/);
        const title = daoMatch 
            ? `${post.title.replace(/\[DAO:[a-f0-9]+\]\s*/, '🏛️ [DAO-${daoMatch[1].slice(0,6)}] ')}`
            : post.title;

        // Create a brief summary (first 150 characters of content)
        const summary = post.content
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 150) + (post.content.length > 150 ? '...' : '');

        // Add engagement metrics
        const engagement = `💬 ${post.reply_count} replies · 👁️ ${post.views} views · ❤️ ${post.like_count} likes`;

        return `${number}. ${title}\n` +
               `   📅 Posted on ${date}\n` +
               `   📝 ${summary}\n` +
               `   ${engagement}\n` +
               `   🔗 ${post.url}\n`;
    }).join("\n");

    return header + formattedPosts;
}

export const latestTopicsAction: Action = {
    name: "LATEST_FORUM_TOPICS",
    description: "Provides a detailed summary of recent forum discussions including content previews and engagement metrics",
    similes: ["analyze forum", "check forum", "summarize forum", "get forum updates", "latest topics", "recent topics"],
    examples: [
        [
            { user: "user1", content: { text: "what are people discussing on the forum" } },
            { user: "agent", content: { text: "Here are the latest forum topics:" } }
        ],
        [
            { user: "user1", content: { text: "show me the latest forum discussions" } },
            { user: "agent", content: { text: "Here are the latest forum topics:" } }
        ]
    ],
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const forumUrl = runtime.getSetting("DISCOURSE_FORUM_URL");
        return !!forumUrl;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: any, options?: any, callback?: HandlerCallback): Promise<void> => {
        const forumUrl = runtime.getSetting("DISCOURSE_FORUM_URL");
        if (!forumUrl) {
            elizaLogger.warn("DISCOURSE_FORUM_URL is not configured");
            const response: Content = {
                type: "text",
                text: "I'm unable to fetch forum topics because the forum URL is not configured. Please set the DISCOURSE_FORUM_URL environment variable.",
                action: "LATEST_FORUM_TOPICS"
            };
            await callback?.(response);
            return;
        }

        try {
            const client = new DiscourseClient({
                url: forumUrl,
                usePublicScraping: true,
                fetchOptions: {
                    maxPosts: 10,
                    includeReplies: false
                }
            });

            const posts = await client.getPosts();
            const response: Content = {
                type: "text",
                text: formatSummary(posts),
                action: "LATEST_FORUM_TOPICS"
            };
            await callback?.(response);
        } catch (error) {
            elizaLogger.error("Error fetching forum topics:", error);
            const response: Content = {
                type: "text",
                text: `I encountered an error while fetching forum topics: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later or contact support if the issue persists.`,
                action: "LATEST_FORUM_TOPICS"
            };
            await callback?.(response);
        }
    }
}; 