import { Plugin } from "@elizaos/core";
import { ForumAnalyzerConfig, ForumPost, DiscussionAnalysis, PluginContext } from './types';
import { DiscourseClient } from './platforms/discourse';
import { DiscordClient } from './platforms/discord';
import { CommonwealthClient } from './platforms/commonwealth';
import { analyzeDiscussion } from './analysis';
import { analyzeForumAction } from './actions/analyze';

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
    this.context = context;
    await this.initializeClients();
  }

  private async initializeClients() {
    if (this.config.platforms.discourse) {
      this.discourseClient = new DiscourseClient(this.config.platforms.discourse);
    }
    if (this.config.platforms.discord) {
      this.discordClient = new DiscordClient(this.config.platforms.discord);
    }
    if (this.config.platforms.commonwealth) {
      this.commonwealthClient = new CommonwealthClient(this.config.platforms.commonwealth);
    }
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
    const posts = await this.getPosts(platform, options);
    const analyses = await Promise.all(posts.map(post => this.analyzePost(post)));
    return analyses.filter(analysis => 
      analysis.proposalPotential.score >= (this.config.analysisOptions?.proposalThreshold || 0.7)
    );
  }

  private async getPosts(platform: string, options: any): Promise<ForumPost[]> {
    switch (platform) {
      case 'discourse':
        return this.discourseClient?.getPosts(options) || [];
      case 'discord':
        return this.discordClient?.getPosts(options) || [];
      case 'commonwealth':
        return this.commonwealthClient?.getPosts(options) || [];
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async analyzePost(post: ForumPost): Promise<DiscussionAnalysis> {
    return analyzeDiscussion(post, this.config.analysisOptions);
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