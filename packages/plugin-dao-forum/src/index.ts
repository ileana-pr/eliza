import { Plugin, Message, Context } from '@eliza/core';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Client as DiscordClient } from 'discord.js';
import { DiscourseAPI } from '@discourse/discourse-api';

export interface DAOForumConfig {
  discourseUrl?: string;
  discourseApiKey?: string;
  discordToken?: string;
  discordChannelIds?: string[];
  commonwealthUrl?: string;
  usePublicDiscourse?: boolean;
}

interface ProposalIdea {
  title: string;
  context: string;
  supportingEvidence: string[];
  relatedTopics: string[];
  sentiment: {
    score: number;  // -1 to 1
    keywords: string[];
    communityReaction: string;
  };
}

interface DiscussionAnalysis {
  topicId: string | number;
  title: string;
  url: string;
  mainPost: {
    content: string;
    author: string;
    timestamp: Date;
  };
  responses: {
    count: number;
    uniqueParticipants: number;
    averageSentiment: number;
  };
  sentiment: {
    overall: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
    keyPhrases: string[];
  };
  proposalPotential: {
    score: number;  // 0 to 1
    type: 'improvement' | 'feature' | 'governance' | 'other';
    relevantTopics: string[];
  };
  communityEngagement: {
    level: 'high' | 'medium' | 'low';
    participationRate: number;
    consensusLevel: number;
  };
}

export class DAOForumPlugin implements Plugin {
  private config: DAOForumConfig;
  private discordClient?: DiscordClient;
  private discourseApi?: any;

  constructor(config: DAOForumConfig) {
    this.config = config;
    this.setupClients();
  }

  private async setupClients() {
    // Setup Discord client if configured
    if (this.config.discordToken) {
      this.discordClient = new DiscordClient({
        intents: ['GuildMessages', 'MessageContent']
      });
      await this.discordClient.login(this.config.discordToken);
    }

    // Setup Discourse client if configured and not using public scraping
    if (this.config.discourseUrl && this.config.discourseApiKey && !this.config.usePublicDiscourse) {
      this.discourseApi = new DiscourseAPI({
        baseUrl: this.config.discourseUrl,
        apiKey: this.config.discourseApiKey
      });
    }
  }

  private async scrapePublicDiscourse(): Promise<Message[]> {
    if (!this.config.discourseUrl) return [];

    const messages: Message[] = [];
    try {
      // Fetch latest topics page
      const response = await axios.get(`${this.config.discourseUrl}/latest.json`);
      const topicList = response.data.topic_list.topics;

      // Process each topic
      for (const topic of topicList) {
        try {
          // Fetch individual topic
          const topicResponse = await axios.get(`${this.config.discourseUrl}/t/${topic.id}.json`);
          const posts = topicResponse.data.post_stream.posts;

          // Process posts in the topic
          for (const post of posts) {
            messages.push({
              content: {
                text: `${topic.title}\n\n${post.cooked.replace(/<[^>]*>/g, '')}`, // Remove HTML tags
                metadata: {
                  source: 'discourse',
                  url: `${this.config.discourseUrl}/t/${topic.id}/${post.post_number}`,
                  timestamp: new Date(post.created_at),
                  topicId: topic.id,
                  postNumber: post.post_number
                }
              },
              user: post.username
            });
          }

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching topic ${topic.id}:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error('Error fetching Discourse topics:', error);
    }

    return messages;
  }

  async scrapeDiscourse(): Promise<Message[]> {
    // Use public scraping if configured or if API is not available
    if (this.config.usePublicDiscourse || !this.discourseApi) {
      return this.scrapePublicDiscourse();
    }

    // Otherwise use API method
    if (!this.discourseApi) return [];

    const topics = await this.discourseApi.getLatestTopics();
    return topics.map(topic => ({
      content: {
        text: `${topic.title}\n\n${topic.content}`,
        metadata: {
          source: 'discourse',
          url: `${this.config.discourseUrl}/t/${topic.id}`,
          timestamp: topic.created_at
        }
      },
      user: topic.author
    }));
  }

  async scrapeDiscord(): Promise<Message[]> {
    if (!this.discordClient || !this.config.discordChannelIds) return [];

    const messages: Message[] = [];
    for (const channelId of this.config.discordChannelIds) {
      const channel = await this.discordClient.channels.fetch(channelId);
      if (!channel?.isTextBased()) continue;

      const channelMessages = await channel.messages.fetch({ limit: 100 });
      messages.push(...channelMessages.map(msg => ({
        content: {
          text: msg.content,
          metadata: {
            source: 'discord',
            channelId: channelId,
            timestamp: msg.createdAt
          }
        },
        user: msg.author.username
      })));
    }
    return messages;
  }

  async scrapeCommonwealth(): Promise<Message[]> {
    if (!this.config.commonwealthUrl) return [];

    const response = await axios.get(this.config.commonwealthUrl);
    const $ = cheerio.load(response.data);
    const messages: Message[] = [];

    // Customize this based on Commonwealth's HTML structure
    $('.discussion-item').each((_, element) => {
      const title = $(element).find('.title').text();
      const content = $(element).find('.content').text();
      const author = $(element).find('.author').text();
      const timestamp = $(element).find('.timestamp').attr('datetime');

      messages.push({
        content: {
          text: `${title}\n\n${content}`,
          metadata: {
            source: 'commonwealth',
            timestamp: timestamp ? new Date(timestamp) : new Date()
          }
        },
        user: author
      });
    });

    return messages;
  }

  private analyzeSentiment(text: string): { score: number; keywords: string[] } {
    const keywords = new Set<string>();
    let score = 0;

    // Simple keyword-based sentiment analysis
    const positiveTerms = ['support', 'agree', 'good', 'great', 'improve', 'benefit', 'positive', 'yes', 'approve'];
    const negativeTerms = ['against', 'disagree', 'bad', 'poor', 'harm', 'negative', 'no', 'reject', 'oppose'];

    const words = text.toLowerCase().split(/\W+/);
    let totalTerms = 0;

    words.forEach(word => {
      if (positiveTerms.includes(word)) {
        score += 1;
        keywords.add(word);
        totalTerms++;
      }
      if (negativeTerms.includes(word)) {
        score -= 1;
        keywords.add(word);
        totalTerms++;
      }
    });

    return {
      score: totalTerms > 0 ? score / totalTerms : 0,
      keywords: Array.from(keywords)
    };
  }

  private extractProposalIdeas(discussion: DiscussionAnalysis): ProposalIdea[] {
    const ideas: ProposalIdea[] = [];
    const proposalIndicators = [
      'should', 'could', 'propose', 'suggest', 'idea', 'improve',
      'change', 'implement', 'add', 'remove', 'modify', 'update'
    ];

    // Extract sentences that might contain proposal ideas
    const sentences = discussion.mainPost.content.split(/[.!?]+/);
    let currentIdea: Partial<ProposalIdea> | null = null;

    sentences.forEach(sentence => {
      const hasIndicator = proposalIndicators.some(indicator =>
        sentence.toLowerCase().includes(indicator)
      );

      if (hasIndicator) {
        if (currentIdea) {
          ideas.push(currentIdea as ProposalIdea);
        }

        const sentiment = this.analyzeSentiment(sentence);
        currentIdea = {
          title: sentence.trim(),
          context: discussion.title,
          supportingEvidence: [],
          relatedTopics: discussion.proposalPotential.relevantTopics,
          sentiment: {
            score: sentiment.score,
            keywords: sentiment.keywords,
            communityReaction: discussion.responses.averageSentiment > 0 ? 'positive' : 'negative'
          }
        };
      } else if (currentIdea) {
        currentIdea.supportingEvidence?.push(sentence.trim());
      }
    });

    if (currentIdea) {
      ideas.push(currentIdea as ProposalIdea);
    }

    return ideas;
  }

  private analyzeDiscussion(messages: Message[]): DiscussionAnalysis {
    const mainPost = messages[0];
    const responses = messages.slice(1);

    // Calculate sentiment scores
    const sentiments = messages.map(msg => this.analyzeSentiment(msg.content.text));
    const overallSentiment = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

    // Count sentiment distribution
    const sentimentBreakdown = {
      positive: sentiments.filter(s => s.score > 0.3).length / sentiments.length,
      neutral: sentiments.filter(s => Math.abs(s.score) <= 0.3).length / sentiments.length,
      negative: sentiments.filter(s => s.score < -0.3).length / sentiments.length
    };

    // Analyze proposal potential
    const proposalKeywords = ['governance', 'proposal', 'vote', 'change', 'improve', 'implement'];
    const proposalScore = proposalKeywords.reduce((score, keyword) =>
      score + (mainPost.content.text.toLowerCase().includes(keyword) ? 1 : 0), 0
    ) / proposalKeywords.length;

    return {
      topicId: mainPost.content.metadata.topicId!,
      title: mainPost.content.text.split('\n')[0].replace('Title: ', ''),
      url: mainPost.content.metadata.url!,
      mainPost: {
        content: mainPost.content.text,
        author: mainPost.user,
        timestamp: mainPost.content.metadata.timestamp
      },
      responses: {
        count: responses.length,
        uniqueParticipants: new Set(responses.map(r => r.user)).size,
        averageSentiment: responses.length > 0
          ? responses.map(r => this.analyzeSentiment(r.content.text).score).reduce((a, b) => a + b) / responses.length
          : 0
      },
      sentiment: {
        overall: overallSentiment,
        breakdown: sentimentBreakdown,
        keyPhrases: Array.from(new Set(sentiments.flatMap(s => s.keywords)))
      },
      proposalPotential: {
        score: proposalScore,
        type: this.determineProposalType(mainPost.content.text),
        relevantTopics: this.extractRelevantTopics(mainPost.content.text)
      },
      communityEngagement: {
        level: this.determineEngagementLevel(responses.length),
        participationRate: responses.length / (responses.length + 1),
        consensusLevel: this.calculateConsensusLevel(sentiments)
      }
    };
  }

  private determineProposalType(text: string): 'improvement' | 'feature' | 'governance' | 'other' {
    const lowercase = text.toLowerCase();
    if (lowercase.includes('governance') || lowercase.includes('policy') || lowercase.includes('rule')) {
      return 'governance';
    }
    if (lowercase.includes('improve') || lowercase.includes('update') || lowercase.includes('fix')) {
      return 'improvement';
    }
    if (lowercase.includes('new') || lowercase.includes('add') || lowercase.includes('create')) {
      return 'feature';
    }
    return 'other';
  }

  private extractRelevantTopics(text: string): string[] {
    const topics = new Set<string>();
    const commonTopics = [
      'governance', 'treasury', 'voting', 'proposal', 'community',
      'development', 'security', 'token', 'protocol', 'upgrade'
    ];

    commonTopics.forEach(topic => {
      if (text.toLowerCase().includes(topic)) {
        topics.add(topic);
      }
    });

    return Array.from(topics);
  }

  private determineEngagementLevel(responseCount: number): 'high' | 'medium' | 'low' {
    if (responseCount > 10) return 'high';
    if (responseCount > 5) return 'medium';
    return 'low';
  }

  private calculateConsensusLevel(sentiments: { score: number }[]): number {
    if (sentiments.length < 2) return 1;

    const scores = sentiments.map(s => s.score);
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    // Convert variance to consensus level (0-1)
    return 1 / (1 + variance);
  }

  async processMessages(context: Context): Promise<void> {
    const messages = await this.scrapeDiscourse();

    // Group messages by topic
    const messagesByTopic = messages.reduce((acc, msg) => {
      const topicId = msg.content.metadata.topicId;
      if (!acc[topicId!]) acc[topicId!] = [];
      acc[topicId!].push(msg);
      return acc;
    }, {} as Record<string | number, Message[]>);

    // Analyze each discussion
    for (const topicMessages of Object.values(messagesByTopic) as Message[][]) {
      const analysis = this.analyzeDiscussion(topicMessages);
      const ideas = this.extractProposalIdeas(analysis);

      // Add analysis results to context
      context.addMessage({
        content: {
          text: JSON.stringify({ analysis, ideas }, null, 2),
          metadata: {
            source: 'dao-forum-plugin',
            type: 'analysis',
            timestamp: new Date(),
            topicId: analysis.topicId
          }
        },
        user: 'system'
      });
    }
  }
}