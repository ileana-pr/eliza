import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { load } from 'cheerio';
import { ForumPost, DiscourseConfig } from '../types';
import { elizaLogger } from '@elizaos/core';

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
  private config: DiscourseConfig;
  private baseUrl: string;
  private apiKey?: string;
  private usePublicScraping: boolean;
  private fetchOptions: Required<DiscourseConfig>['fetchOptions'];
  private cache: Map<string, { data: ForumPost[]; timestamp: number }>;

  constructor(config: DiscourseConfig) {
    this.config = config;
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
    elizaLogger.info(`[Discourse] Initializing client with URL: ${config.url}`);
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

  private async scrapeTopicMetadata($: cheerio.Root, topicEl: cheerio.Element): Promise<TopicMetadata> {
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
      elizaLogger.error(`[DISCOURSE] Error scraping topic page ${url}:`, error);
      return null;
    }
  }

  private async getPostsViaAPI(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  }): Promise<ForumPost[]> {
    elizaLogger.info('[DISCOURSE] Making API request to fetch posts...');
    elizaLogger.debug('[DISCOURSE] API request options:', { ...options, baseUrl: this.baseUrl });
    
    const {
      timeframe = "week",
      category,
      limit = this.fetchOptions.maxPosts,
    } = options;

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      elizaLogger.info('[DISCOURSE] Using API key for authentication');
      headers["Api-Key"] = this.apiKey;
      elizaLogger.debug('[DISCOURSE] Headers configured:', { headers: { ...headers, 'Api-Key': '***' } });
    }

    try {
      const url = `${this.baseUrl}/latest.json`;
      elizaLogger.info(`[DISCOURSE] Requesting ${url}`);
      
      const response = await axios.get(url, { headers });
      elizaLogger.info(`[DISCOURSE] Received response with status ${response.status}`);
      elizaLogger.debug('[DISCOURSE] Response headers:', response.headers);
      
      if (!response.data?.topic_list?.topics) {
        const error = '[DISCOURSE] Invalid API response - no topics found in response';
        elizaLogger.error(error, { 
          responseData: JSON.stringify(response.data).substring(0, 500),
          url,
          headers: { ...headers, 'Api-Key': '***' }
        });
        throw new Error(error);
      }

      const topics = response.data.topic_list.topics;
      elizaLogger.info(`[DISCOURSE] Found ${topics.length} topics in response`);
      elizaLogger.debug('[DISCOURSE] First topic preview:', { 
        title: topics[0]?.title,
        id: topics[0]?.id,
        created_at: topics[0]?.created_at
      });

      const posts = await Promise.all(topics.map(async (topic) => {
        try {
          elizaLogger.debug(`[DISCOURSE] Processing topic: ${topic.title} (ID: ${topic.id})`);
          const post = await this.convertAPIResponseToPost(topic);
          elizaLogger.debug(`[DISCOURSE] Successfully processed topic: ${topic.title} (ID: ${topic.id})`);
          return post;
        } catch (error) {
          elizaLogger.error(`[DISCOURSE] Failed to process topic: ${error.message}`, {
            topicId: topic.id,
            topicTitle: topic.title,
            error: error.stack
          });
          return null;
        }
      }));

      const validPosts = posts.filter((post): post is ForumPost => post !== null);
      elizaLogger.info(`[DISCOURSE] Successfully processed ${validPosts.length} out of ${topics.length} posts`);
      if (validPosts.length > 0) {
        elizaLogger.debug('[DISCOURSE] First processed post:', {
          title: validPosts[0].title,
          author: validPosts[0].author,
          timestamp: validPosts[0].timestamp
        });
      }
      
      return validPosts;
    } catch (error) {
      elizaLogger.error(`[DISCOURSE] API request failed: ${error.message}`, {
        url: this.baseUrl,
        error: error.stack,
        options
      });
      throw error;
    }
  }

  private async convertAPIResponseToPost(response: any): Promise<ForumPost> {
    elizaLogger.debug(`[DISCOURSE] Converting topic to post format: ${response.title}`);
    
    const topic = response.post_stream?.posts[0] || response;
    let categoryName;
    
    if (topic.category_id) {
      try {
        categoryName = await this.getCategoryName(topic.category_id);
        elizaLogger.debug(`[DISCOURSE] Retrieved category name: ${categoryName} for ID: ${topic.category_id}`);
      } catch (error) {
        elizaLogger.error(`[DISCOURSE] Failed to get category name for ID ${topic.category_id}: ${error.message}`);
      }
    }
    
    const post = {
      id: topic.id.toString(),
      platform: "discourse",
      title: topic.title || response.title,
      content: topic.raw || response.raw || '',
      author: topic.username || response.username || '',
      timestamp: new Date(topic.created_at || response.created_at),
      url: `${this.baseUrl}/t/${topic.slug || response.slug}/${topic.id || response.id}`,
      category: categoryName,
      tags: topic.tags || response.tags || [],
      replies: topic.reply_count || response.reply_count || 0,
      views: topic.views || response.views || 0,
      reactions: {
        likes: topic.like_count || response.like_count || 0,
      },
      metadata: {
        isSticky: topic.pinned || response.pinned || false,
        isLocked: topic.closed || response.closed || false,
        participantCount: topic.participant_count || response.participant_count || 1
      }
    };

    elizaLogger.debug(`[DISCOURSE] Successfully converted post: ${post.title} by ${post.author}`);
    return post;
  }

  private async getPostsViaScraping(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  }): Promise<ForumPost[]> {
    elizaLogger.info("[DISCOURSE] Fetching posts via scraping");
    const {
      timeframe = "week",
      category,
      limit = this.fetchOptions.maxPosts,
    } = options;
  
    try {
      const cacheKey = this.getCacheKey(options);
      const cachedPosts = await this.getFromCache(cacheKey);
      if (cachedPosts) {
        elizaLogger.info("[DISCOURSE] Returning cached posts");
        return cachedPosts;
      }
  
      elizaLogger.debug(`[DISCOURSE] Scraping latest page: ${category ? `category ${category}` : 'all categories'}`);
      const latestPageUrl = category 
        ? `${this.baseUrl}/c/${category}/l/latest`
        : `${this.baseUrl}/latest`;
      
      elizaLogger.debug(`[DISCOURSE] Requesting URL: ${latestPageUrl}`);
      const response = await axios.get(latestPageUrl);
      elizaLogger.debug(`[DISCOURSE] Got response status: ${response.status}`);
      
      const $ = load(response.data);
      
      // Try multiple possible selectors since forums can customize their themes
      const topicElements = $('.topic-list-item, .topic-list tr:not(.topic-list-header)').toArray();
      elizaLogger.debug(`[DISCOURSE] Found ${topicElements.length} topics on page`);
  
      if (topicElements.length === 0) {
        elizaLogger.debug('[DISCOURSE] No topics found, dumping page structure:', {
          bodyClasses: $('body').attr('class'),
          possibleTopicContainers: [
            $('.topic-list').length,
            $('.topic-list-item').length,
            $('.topic-list tr').length
          ]
        });
      }
  
      const posts: ForumPost[] = [];
      for (const el of topicElements.slice(0, limit)) {
        try {
          const post = await this.scrapeTopicElement($, el);
          if (post) {
            posts.push(post);
            elizaLogger.debug(`[DISCOURSE] Scraped topic: ${post.title}`);
          }
        } catch (error) {
          elizaLogger.error('[DISCOURSE] Error scraping topic:', error);
          // Continue with next topic instead of failing entirely
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.fetchOptions.scrapingDelay));
      }
  
      this.setCache(cacheKey, posts);
      elizaLogger.info(`[DISCOURSE] Successfully scraped ${posts.length} posts`);
      return posts;
    } catch (error) {
      elizaLogger.error("[DISCOURSE] Scraping failed:", {
        error,
        url: this.baseUrl,
        message: error.message
      });
      throw error;
    }
  }

  private async scrapeTopicElement($: any, el: any): Promise<ForumPost | null> {
    try {
      const $el = $(el);
      
      // Update selector to match Decentraland's forum structure
      const titleEl = $el.find('.title.raw-link.raw-topic-link');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href');
      
      elizaLogger.debug('[DISCOURSE] Found topic:', { title, link });
      
      if (!link) {
        elizaLogger.debug('[DISCOURSE] No link found for topic');
        return null;
      }
  
      // Handle both relative and absolute URLs
      const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      
      // Get the full topic content
      const response = await axios.get(fullUrl);
      const $topic = load(response.data);
      
      // Extract main post content
      const mainPost = $topic('.topic-post:first-child');
      const content = mainPost.find('.cooked').text().trim();
      const author = mainPost.find('.username').text().trim();
      const timestamp = mainPost.find('.post-date').attr('data-time') || '';
      
      // Extract metadata
      const category = $topic('.category-name').text().trim();
      const tags = $topic('.discourse-tags .discourse-tag').map((_, el) => $(el).text().trim()).get();
      const views = parseInt($topic('.views-count').text().trim()) || 0;
      const replyCount = $topic('.post-count').text().trim();
      const likeCount = mainPost.find('.like-count').text().trim();
  
      const post: ForumPost = {
        id: fullUrl.split('/').pop() || '',
        platform: 'discourse',
        title,
        content,
        author,
        timestamp: new Date(timestamp),
        url: fullUrl,
        category,
        tags,
        views,
        replies: parseInt(replyCount) || 0,
        reactions: {
          likes: parseInt(likeCount) || 0,
        },
        metadata: {
          isSticky: $topic('.topic-status .pinned').length > 0,
          isLocked: $topic('.topic-status .locked').length > 0,
          participantCount: new Set($topic('.topic-post .username').map((_, el) => $(el).text().trim()).get()).size
        }
      };
  
      elizaLogger.debug(`[DISCOURSE] Successfully scraped topic: ${title}`);
      return post;
      
    } catch (error) {
      elizaLogger.error('[DISCOURSE] Error scraping topic:', {
        error: error.message,
        element: $(el).html()?.substring(0, 200)
      });
      return null;
    }
  }

  private async getCategoryName(categoryId: number): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/c/${categoryId}/show.json`);
      return response.data.category.name;
    } catch {
      return undefined;
    }
  }

  async getPosts(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  } = {}): Promise<ForumPost[]> {
    elizaLogger.info("\n[DISCOURSE] Starting to fetch posts from Discourse...");
    
    try {
      elizaLogger.info(`[Discourse] Starting to fetch posts from ${this.baseUrl}`);
      elizaLogger.debug(`[Discourse] Fetch options:`, options);

      // Add logging before each API call or scraping attempt
      if (this.usePublicScraping) {
        elizaLogger.debug(`[Discourse] Starting public scraping with delay: ${this.fetchOptions.scrapingDelay}ms`);
      } else {
        elizaLogger.debug(`[Discourse] Making API request with key ${this.apiKey ? 'present' : 'missing'}`);
      }

      let posts: ForumPost[];
      if (this.usePublicScraping) {
        posts = await this.getPostsViaScraping(options);
      } else {
        posts = await this.getPostsViaAPI(options);
      }
      
      elizaLogger.info(`[Discourse] Successfully fetched ${posts.length} posts from forum`);
      elizaLogger.debug(`[Discourse] Cache status: ${this.fetchOptions.cacheTimeout ? 'enabled' : 'disabled'}`);
      
      return posts;
    } catch (error) {
      elizaLogger.error(`[Discourse] Error fetching posts:`, error);
      throw error;
    }
  }
} 