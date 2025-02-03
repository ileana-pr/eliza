import { Plugin } from "@elizaos/core";
import { ForumAnalyzerConfig, ForumPost, DiscussionAnalysis, PluginContext } from './types';
import { DiscourseClient } from './platforms/discourse';
import { DiscordClient } from './platforms/discord';
import { CommonwealthClient } from './platforms/commonwealth';
import { analyzeDiscussion } from './analysis';
import { analyzeForumAction } from './actions/analyze';
import { elizaLogger } from '@elizaos/core';

export class ForumAnalyzerPlugin implements Plugin {
  public readonly name = 'forum-analyzer';
  public readonly version = '0.1.0';
  public readonly description = 'Analyzes DAO forum discussions to identify governance proposals';
  
  private config: ForumAnalyzerConfig;
  private context?: PluginContext;
  private discourseClient?: DiscourseClient;
  private discordClient?: DiscordClient;
  private commonwealthClient?: CommonwealthClient;

  constructor(config: ForumAnalyzerConfig) {
    this.config = config;
  }

  async onLoad(context: PluginContext): Promise<void> {
    elizaLogger.info('\n[FORUM-ANALYZER] Loading ForumAnalyzerPlugin...');
    this.context = context;
    await this.initializeClients();
    elizaLogger.info('[FORUM-ANALYZER] Plugin loaded successfully');
  }

  private async initializeClients() {
    elizaLogger.info('[FORUM-ANALYZER] Initializing forum clients...');
    
    if (this.config.platforms.discourse) {
      elizaLogger.info('[FORUM-ANALYZER] Initializing Discourse client with config:', {
        url: this.config.platforms.discourse.url
      });
      this.discourseClient = new DiscourseClient(this.config.platforms.discourse);
    }
    
    if (this.config.platforms.discord) {
      elizaLogger.info('[FORUM-ANALYZER] Initializing Discord client...');
      this.discordClient = new DiscordClient(this.config.platforms.discord);
    }
    
    if (this.config.platforms.commonwealth) {
      elizaLogger.info('[FORUM-ANALYZER] Initializing Commonwealth client...');
      this.commonwealthClient = new CommonwealthClient(this.config.platforms.commonwealth);
    }
    
    elizaLogger.info('[FORUM-ANALYZER] Forum clients initialized');
  }

  async onUnload(): Promise<void> {
    if (this.discordClient) {
      await this.discordClient.destroy();
    }
  }

  public readonly actions = [
    analyzeForumAction
  ];

  public readonly evaluators = [];

  async analyzeForum(platform: string, options: { 
    timeframe?: string, 
    category?: string,
    limit?: number 
  } = {}): Promise<DiscussionAnalysis[]> {
    elizaLogger.info(`\n[FORUM-ANALYZER] Starting forum analysis for platform: ${platform}`, { options });
    
    const posts = await this.getPosts(platform, options);
    elizaLogger.info(`[FORUM-ANALYZER] Retrieved ${posts.length} posts for analysis`);
    
    const analyses = await Promise.all(posts.map(async post => {
      elizaLogger.debug(`[FORUM-ANALYZER] Analyzing post: ${post.id} - ${post.title}`);
      const analysis = await this.analyzePost(post);
      elizaLogger.debug(`[FORUM-ANALYZER] Analysis complete for post ${post.id}`, { 
        proposalScore: analysis.proposalPotential.score 
      });
      return analysis;
    }));
    
    const filteredAnalyses = analyses.filter(analysis => 
      analysis.proposalPotential.score >= (this.config.analysisOptions?.proposalThreshold || 0.7)
    );
    
    elizaLogger.info(`[FORUM-ANALYZER] Analysis complete. Found ${filteredAnalyses.length} potential proposals`);
    return filteredAnalyses;
  }

  private async getPosts(platform: string, options: any): Promise<ForumPost[]> {
    elizaLogger.debug(`[FORUM-ANALYZER] Fetching posts for platform: ${platform}`, { options });
    let posts: ForumPost[] = [];
    
    try {
      switch (platform) {
        case 'discourse':
          elizaLogger.debug('[FORUM-ANALYZER] Using Discourse client to fetch posts');
          posts = await this.discourseClient?.getPosts(options) || [];
          break;
        case 'discord':
          elizaLogger.debug('[FORUM-ANALYZER] Using Discord client to fetch posts');
          posts = await this.discordClient?.getPosts(options) || [];
          break;
        case 'commonwealth':
          elizaLogger.debug('[FORUM-ANALYZER] Using Commonwealth client to fetch posts');
          posts = await this.commonwealthClient?.getPosts(options) || [];
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      elizaLogger.debug(`[FORUM-ANALYZER] Successfully fetched ${posts.length} posts`);
      return posts;
    } catch (error) {
      elizaLogger.error(`[FORUM-ANALYZER] Error fetching posts:`, error);
      throw error;
    }
  }

  private async analyzePost(post: ForumPost): Promise<DiscussionAnalysis> {
    try {
      const analysis = await analyzeDiscussion(post, this.config.analysisOptions);
      return analysis;
    } catch (error) {
      elizaLogger.error(`Error analyzing post ${post.id}: ${error.message}`, { error });
      throw error;
    }
  }

  getCapabilities(): string[] {
    return [
      'forum:analyze',
      'forum:scrape',
      'proposal:identify',
      'sentiment:analyze'
    ];
  }
}

// Export both the class and a default instance
export const createPlugin = (config: ForumAnalyzerConfig): Plugin => {
  return new ForumAnalyzerPlugin(config);
};

export default createPlugin; 