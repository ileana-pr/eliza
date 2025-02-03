import axios from 'axios';
import * as cheerio from 'cheerio';
import { ForumPost } from '../types';

interface DiscourseConfig {
  url: string;
  apiKey?: string;
}

interface DiscoursePost {
  id: number;
  title: string;
  raw: string;
  username: string;
  created_at: string;
  topic_slug: string;
  topic_id: number;
  reply_count: number;
  like_count: number;
}

export class DiscourseClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: DiscourseConfig) {
    this.baseUrl = config.url.endsWith("/") ? config.url.slice(0, -1) : config.url;
    this.apiKey = config.apiKey;
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
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Api-Key"] = this.apiKey;
      }

      // Get latest topics
      const response = await axios.get(`${this.baseUrl}/latest.json`, {
        headers,
        params: {
          category,
          page: 0,
          per_page: limit,
        },
      });

      const topics = response.data.topic_list.topics;
      const posts: ForumPost[] = [];

      for (const topic of topics) {
        // Get topic details
        const topicResponse = await axios.get(
          `${this.baseUrl}/t/${topic.slug}/${topic.id}.json`,
          { headers }
        );

        const post = topicResponse.data.post_stream.posts[0] as DiscoursePost;
        
        // Convert to common format
        posts.push({
          id: post.id.toString(),
          platform: "discourse",
          title: post.title,
          content: post.raw,
          author: post.username,
          timestamp: new Date(post.created_at),
          url: `${this.baseUrl}/t/${topic.slug}/${topic.id}`,
          replies: post.reply_count,
          reactions: {
            likes: post.like_count,
          },
        });

        if (posts.length >= limit) {
          break;
        }
      }

      return posts;
    } catch (error) {
      console.error("Error fetching Discourse posts:", error);
      throw error;
    }
  }
} 