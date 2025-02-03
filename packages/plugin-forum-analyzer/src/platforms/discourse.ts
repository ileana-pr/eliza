import type { AxiosResponse } from 'axios';
import axios from 'axios';
import type { CheerioAPI, Element } from 'cheerio';
import { load } from 'cheerio';
import { ForumPost } from '../types';

interface DiscourseConfig {
  url: string;
  apiKey?: string;
  usePublicScraping?: boolean;
  fetchOptions?: {
    maxPosts?: number;
    includeReplies?: boolean;
    fetchFullThread?: boolean;
    cacheTimeout?: number;
    scrapingDelay?: number;
  };
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
  category_id?: number;
  tags?: string[];
}

interface TopicMetadata {
  views: number;
  categoryName: string;
  tags: string[];
  lastActivity: Date;
}

export class DiscourseClient {
  private baseUrl: string;
  private apiKey?: string;
  private usePublicScraping: boolean;
  private fetchOptions: Required<DiscourseConfig>['fetchOptions'];
  private cache: Map<string, { data: ForumPost[]; timestamp: number }>;

  constructor(config: DiscourseConfig) {
    this.baseUrl = config.url.endsWith("/") ? config.url.slice(0, -1) : config.url;
    this.apiKey = config.apiKey;
    this.usePublicScraping = config.usePublicScraping || !config.apiKey;
    this.fetchOptions = {
      maxPosts: config.fetchOptions?.maxPosts || 100,
      includeReplies: config.fetchOptions?.includeReplies || true,
      fetchFullThread: config.fetchOptions?.fetchFullThread || true,
      cacheTimeout: config.fetchOptions?.cacheTimeout || 300,
      scrapingDelay: config.fetchOptions?.scrapingDelay || 500,
    };
    this.cache = new Map();
  }

  private getCacheKey(options: { timeframe?: string; category?: string; limit?: number }): string {
    return `${options.timeframe || 'week'}-${options.category || 'all'}-${options.limit || 30}`;
  }

  private async getFromCache(key: string): Promise<ForumPost[] | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.fetchOptions.cacheTimeout * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: ForumPost[]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async scrapeTopicMetadata($: CheerioAPI, topicEl: cheerio.Element): Promise<TopicMetadata> {
    const $topic = $(topicEl);
    return {
      views: parseInt($topic.find('.views').text().trim()) || 0,
      categoryName: $topic.find('.category-name').text().trim(),
      tags: $topic.find('.discourse-tag').map((_, el) => $(el).text().trim()).get(),
      lastActivity: new Date($topic.find('.last-activity-time').attr('data-time') || Date.now())
    };
  }

  private async scrapeTopicPage(url: string): Promise<ForumPost | null> {
    try {
      const response = await axios.get(url);
      const $ = load(response.data);
      
      // Extract main post content
      const mainPost = $('.topic-post:first-child');
      const title = $('.fancy-title').text().trim();
      const content = mainPost.find('.cooked').text().trim();
      const author = mainPost.find('.username').text().trim();
      const timestamp = mainPost.find('.post-date').attr('data-time') || '';
      const replyCount = $('.post-count').text().trim();
      const likeCount = mainPost.find('.like-count').text().trim();
      
      // Extract additional metadata
      const category = $('.category-name').text().trim();
      const tags = $('.discourse-tags .discourse-tag').map((_, el) => $(el).text().trim()).get();
      const views = parseInt($('.views-count').text().trim()) || 0;
      const isSticky = $('.topic-status .pinned').length > 0;
      const isLocked = $('.topic-status .locked').length > 0;
      const participantCount = new Set($('.topic-post .username').map((_, el) => $(el).text().trim()).get()).size;
      
      if (!title || !content) return null;

      // Get replies if enabled
      const replies: { author: string; content: string; timestamp: Date }[] = [];
      if (this.fetchOptions.includeReplies) {
        $('.topic-post:not(:first-child)').each((_, el) => {
          const $reply = $(el);
          replies.push({
            author: $reply.find('.username').text().trim(),
            content: $reply.find('.cooked').text().trim(),
            timestamp: new Date($reply.find('.post-date').attr('data-time') || '')
          });
        });
      }

      return {
        id: url.split('/').pop() || '',
        platform: 'discourse',
        title,
        content,
        author,
        timestamp: new Date(timestamp),
        url,
        category,
        tags,
        views,
        replies: parseInt(replyCount) || 0,
        reactions: {
          likes: parseInt(likeCount) || 0,
        },
        threadReplies: this.fetchOptions.includeReplies ? replies : undefined,
        metadata: {
          isSticky,
          isLocked,
          participantCount,
          lastEditedAt: new Date(mainPost.find('.post-info.edits').attr('title') || timestamp)
        }
      };
    } catch (error) {
      console.error(`Error scraping topic page ${url}:`, error);
      return null;
    }
  }

  private async getPostsViaAPI(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  }): Promise<ForumPost[]> {
    const {
      timeframe = "week",
      category,
      limit = this.fetchOptions.maxPosts,
    } = options;

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["Api-Key"] = this.apiKey;
    }

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
      const topicResponse = await axios.get(
        `${this.baseUrl}/t/${topic.slug}/${topic.id}.json`,
        { headers }
      );

      const post = topicResponse.data.post_stream.posts[0] as DiscoursePost;
      
      posts.push({
        id: post.id.toString(),
        platform: "discourse",
        title: post.title,
        content: post.raw,
        author: post.username,
        timestamp: new Date(post.created_at),
        url: `${this.baseUrl}/t/${topic.slug}/${topic.id}`,
        category: post.category_id ? await this.getCategoryName(post.category_id) : undefined,
        tags: post.tags,
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
  }

  private async getCategoryName(categoryId: number): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/c/${categoryId}/show.json`);
      return response.data.category.name;
    } catch {
      return undefined;
    }
  }

  private async getPostsViaScraping(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  }): Promise<ForumPost[]> {
    const {
      timeframe = "week",
      category,
      limit = this.fetchOptions.maxPosts,
    } = options;

    try {
      const cacheKey = this.getCacheKey(options);
      const cachedPosts = await this.getFromCache(cacheKey);
      if (cachedPosts) return cachedPosts;

      // Scrape the latest topics page
      const latestPageUrl = category 
        ? `${this.baseUrl}/c/${category}/l/latest`
        : `${this.baseUrl}/latest`;
      
      const response = await axios.get(latestPageUrl);
      const $ = load(response.data);
      
      const topicElements = $('.topic-list-item').toArray();
      const topicLinks: string[] = [];
      const topicMetadata: Map<string, TopicMetadata> = new Map();

      // Extract links and metadata in parallel
      await Promise.all(topicElements.slice(0, limit).map(async (el) => {
        const $el = $(el);
        const link = $el.find('.title a').attr('href');
        if (link) {
          const fullUrl = `${this.baseUrl}${link}`;
          topicLinks.push(fullUrl);
          topicMetadata.set(fullUrl, await this.scrapeTopicMetadata($, el));
        }
      }));

      // Scrape each topic page with rate limiting
      const posts: ForumPost[] = [];
      for (const url of topicLinks) {
        const post = await this.scrapeTopicPage(url);
        if (post) {
          const metadata = topicMetadata.get(url);
          if (metadata) {
            post.views = metadata.views;
            post.category = metadata.categoryName;
            post.tags = metadata.tags;
            post.lastActivity = metadata.lastActivity;
          }
          posts.push(post);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.fetchOptions.scrapingDelay));
      }

      this.setCache(cacheKey, posts);
      return posts;
    } catch (error) {
      console.error("Error scraping forum posts:", error);
      throw error;
    }
  }

  async getPosts(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  } = {}): Promise<ForumPost[]> {
    try {
      return this.usePublicScraping 
        ? await this.getPostsViaScraping(options)
        : await this.getPostsViaAPI(options);
    } catch (error) {
      console.error("Error fetching Discourse posts:", error);
      throw error;
    }
  }
} 