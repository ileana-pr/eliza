import axios from 'axios';
import { ForumPost } from '../types';
import { elizaLogger } from '@elizaos/core';

interface DiscourseConfig {
    url: string;
    usePublicScraping: boolean;
    fetchOptions: {
        maxPosts: number;
        includeReplies: boolean;
    };
}

export class DiscourseClient {
    private baseUrl: string;

    constructor(config: DiscourseConfig) {
        this.baseUrl = config.url.endsWith("/") ? config.url.slice(0, -1) : config.url;
        elizaLogger.debug(`[Discourse] Initializing client with URL: ${this.baseUrl}`);
    }

    private async getTopicContent(topicId: number): Promise<string> {
        try {
            const url = `${this.baseUrl}/t/${topicId}.json`;
            const response = await axios.get(url);
            if (response.data?.post_stream?.posts?.[0]?.cooked) {
                // Remove HTML tags and decode entities
                return response.data.post_stream.posts[0].cooked
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"');
            }
            return '';
        } catch (error) {
            elizaLogger.error(`[Discourse] Error fetching topic content for ID ${topicId}:`, error);
            return '';
        }
    }

    async getPosts(): Promise<ForumPost[]> {
        try {
            const url = `${this.baseUrl}/latest.json`;
            elizaLogger.debug('[Discourse] Making request to:', { url });

            const response = await axios.get(url);
            elizaLogger.debug('[Discourse] Response received', {
                status: response.status,
                hasData: !!response.data,
                hasTopicList: !!response.data?.topic_list,
                topicsCount: response.data?.topic_list?.topics?.length || 0
            });
            
            if (!response.data?.topic_list?.topics) {
                elizaLogger.error('[Discourse] Unexpected API response format:', {
                    data: response.data
                });
                return [];
            }

            const posts = await Promise.all(response.data.topic_list.topics.map(async (topic: any) => {
                elizaLogger.debug('[Discourse] Processing topic:', {
                    id: topic.id,
                    title: topic.title
                });

                const content = await this.getTopicContent(topic.id);

                return {
                    id: topic.id,
                    title: topic.title,
                    content,
                    created_at: topic.created_at,
                    views: topic.views,
                    reply_count: topic.posts_count - 1,
                    like_count: topic.like_count || 0,
                    category_id: topic.category_id,
                    pinned: topic.pinned,
                    tags: topic.tags || [],
                    url: `${this.baseUrl}/t/${topic.slug}/${topic.id}`
                };
            }));

            elizaLogger.debug(`[Discourse] Successfully processed ${posts.length} posts`);
            return posts;
        } catch (error) {
            elizaLogger.error('[Discourse] Error fetching posts:', error);
            if (error instanceof Error) {
                elizaLogger.error('[Discourse] Error details:', {
                    message: error.message,
                    stack: error.stack
                });
            }
            if (axios.isAxiosError(error)) {
                elizaLogger.error('[Discourse] Axios error details:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
            }
            throw error;
        }
    }

    async searchPosts(query: string): Promise<ForumPost[]> {
        try {
            const url = `${this.baseUrl}/search.json`;
            elizaLogger.debug('[Discourse] Making search request:', { url, query });

            const response = await axios.get(url, {
                params: {
                    q: query,
                    order: 'latest',
                }
            });

            elizaLogger.debug('[Discourse] Search response received', {
                status: response.status,
                hasData: !!response.data,
                topicsCount: response.data?.topics?.length || 0
            });

            if (!response.data?.topics) {
                elizaLogger.error('[Discourse] Unexpected search API response format:', {
                    data: response.data
                });
                return [];
            }

            const posts = await Promise.all(response.data.topics.map(async (topic: any) => {
                elizaLogger.debug('[Discourse] Processing search result:', {
                    id: topic.id,
                    title: topic.title
                });

                const content = await this.getTopicContent(topic.id);

                return {
                    id: topic.id,
                    title: topic.title,
                    content,
                    created_at: topic.created_at,
                    views: topic.views,
                    reply_count: topic.posts_count - 1,
                    like_count: topic.like_count || 0,
                    category_id: topic.category_id,
                    pinned: topic.pinned,
                    tags: topic.tags || [],
                    url: `${this.baseUrl}/t/${topic.slug}/${topic.id}`
                };
            }));

            elizaLogger.debug(`[Discourse] Successfully processed ${posts.length} search results`);
            return posts;
        } catch (error) {
            elizaLogger.error('[Discourse] Error searching posts:', error);
            if (error instanceof Error) {
                elizaLogger.error('[Discourse] Error details:', {
                    message: error.message,
                    stack: error.stack
                });
            }
            if (axios.isAxiosError(error)) {
                elizaLogger.error('[Discourse] Axios error details:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
            }
            throw error;
        }
    }
} 