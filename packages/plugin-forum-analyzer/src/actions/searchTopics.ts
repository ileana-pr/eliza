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

function formatSearchResults(posts: ForumPost[], searchTerm: string): string {
    if (posts.length === 0) {
        return `No forum discussions found matching "${searchTerm}".`;
    }

    const header = `🔍 Forum Search Results for "${searchTerm}"\n` + "─".repeat(50) + "\n\n";
    
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

export const searchTopicsAction: Action = {
    name: "SEARCH_FORUM_TOPICS",
    description: "Search forum discussions based on specific search terms",
    similes: ["search forum", "find topics", "find discussions", "search discussions", "look up forum posts"],
    examples: [
        [
            { user: "user1", content: { text: "search the forum for discussions about governance" } },
            { user: "agent", content: { text: "Here are the forum topics related to governance:" } }
        ],
        [
            { user: "user1", content: { text: "find forum posts about development" } },
            { user: "agent", content: { text: "Here are the forum topics related to development:" } }
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
                text: "I'm unable to search forum topics because the forum URL is not configured. Please set the DISCOURSE_FORUM_URL environment variable.",
                action: "SEARCH_FORUM_TOPICS"
            };
            await callback?.(response);
            return;
        }

        // Extract search term from the message
        const searchTerm = message.content.text
            .toLowerCase()
            .replace(/search.*forum.*for|find.*forum.*about|search.*for|find.*about|look.*up/gi, '')
            .trim();

        if (!searchTerm) {
            const response: Content = {
                type: "text",
                text: "Please provide a search term to look for in forum topics.",
                action: "SEARCH_FORUM_TOPICS"
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

            const posts = await client.searchPosts(searchTerm);
            const response: Content = {
                type: "text",
                text: formatSearchResults(posts, searchTerm),
                action: "SEARCH_FORUM_TOPICS"
            };
            await callback?.(response);
        } catch (error) {
            elizaLogger.error("Error searching forum topics:", error);
            const response: Content = {
                type: "text",
                text: `I encountered an error while searching forum topics: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later or contact support if the issue persists.`,
                action: "SEARCH_FORUM_TOPICS"
            };
            await callback?.(response);
        }
    }
}; 