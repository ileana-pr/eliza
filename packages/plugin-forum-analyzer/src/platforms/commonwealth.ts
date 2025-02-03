import axios from 'axios';
import { ForumPost } from '../types';
import { elizaLogger } from '@elizaos/core';

interface CommonwealthConfig {
  url: string;
  apiKey?: string;
}

interface CommonwealthThread {
  id: number;
  title: string;
  body: string;
  address: string;
  created_at: string;
  thread_id: number;
  reaction_count: number;
  comment_count: number;
}

export class CommonwealthClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: CommonwealthConfig) {
    this.baseUrl = config.url.endsWith("/") ? config.url.slice(0, -1) : config.url;
    this.apiKey = config.apiKey;
    elizaLogger.info('[COMMONWEALTH] Initializing client with URL:', this.baseUrl);
  }

  async getPosts(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  } = {}): Promise<ForumPost[]> {
    const {
      timeframe = "week",
      category,
      limit = 30,
    } = options;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
        elizaLogger.debug('[COMMONWEALTH] Using API key for authentication');
      }

      elizaLogger.debug('[COMMONWEALTH] Fetching threads with options:', { timeframe, category, limit });

      // Get latest threads
      const response = await axios.get(`${this.baseUrl}/api/threads`, {
        headers,
        params: {
          category,
          limit,
          sort_by: "created_at",
          sort_direction: "desc",
        },
      });

      const threads = response.data.result as CommonwealthThread[];
      const timeframeCutoff = this.getTimeframeCutoff(timeframe);

      elizaLogger.debug(`[COMMONWEALTH] Retrieved ${threads.length} threads`);

      const filteredPosts = threads
        .filter((thread) => new Date(thread.created_at) >= timeframeCutoff)
        .slice(0, limit)
        .map((thread) => ({
          id: thread.id.toString(),
          platform: "commonwealth",
          title: thread.title,
          content: thread.body,
          author: thread.address,
          timestamp: new Date(thread.created_at),
          url: `${this.baseUrl}/discussion/${thread.thread_id}`,
          replies: thread.comment_count,
          reactions: {
            total: thread.reaction_count,
          },
        }));

      elizaLogger.info(`[COMMONWEALTH] Successfully processed ${filteredPosts.length} posts`);
      return filteredPosts;
    } catch (error) {
      elizaLogger.error("[COMMONWEALTH] Error fetching Commonwealth posts:", error);
      throw error;
    }
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    switch (timeframe.toLowerCase()) {
      case "day":
        return new Date(now.getTime() - day);
      case "week":
        return new Date(now.getTime() - 7 * day);
      case "month":
        return new Date(now.getTime() - 30 * day);
      default:
        return new Date(now.getTime() - 7 * day);
    }
  }
} 