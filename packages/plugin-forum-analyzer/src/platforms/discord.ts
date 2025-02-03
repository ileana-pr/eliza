import { Client, GatewayIntentBits, TextChannel, Message } from "discord.js";
import { ForumPost } from "../types";
import { elizaLogger } from '@elizaos/core';

interface DiscordConfig {
  token: string;
  channels: string[];
}

export class DiscordClient {
  private client: Client;
  private channels: string[];

  constructor(config: DiscordConfig) {
    this.channels = config.channels;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    elizaLogger.info('[DISCORD] Initializing client...');
    this.client.login(config.token);
  }

  async getPosts(options: {
    timeframe?: string;
    category?: string;
    limit?: number;
  } = {}): Promise<ForumPost[]> {
    const {
      timeframe = "week",
      limit = 30,
    } = options;

    const posts: ForumPost[] = [];
    const timeframeMs = this.getTimeframeMs(timeframe);
    const cutoffDate = new Date(Date.now() - timeframeMs);

    try {
      await this.client.guilds.fetch();

      for (const channelId of this.channels) {
        try {
          const channel = await this.client.channels.fetch(channelId);
          if (!channel || !(channel instanceof TextChannel)) {
            elizaLogger.warn(`[DISCORD] Channel ${channelId} not found or not a text channel`);
            continue;
          }

          const messages = await channel.messages.fetch({ limit: 100 });
          for (const message of messages.values()) {
            if (message.createdAt < cutoffDate || posts.length >= limit) {
              break;
            }

            // Only consider messages that might be proposals/discussions
            if (message.content.length < 100) {
              continue;
            }

            posts.push(this.convertMessageToPost(message));
          }

          if (posts.length >= limit) {
            break;
          }
        } catch (error) {
          elizaLogger.error(`[DISCORD] Error fetching messages from channel ${channelId}:`, error);
          continue;
        }
      }

      return posts;
    } catch (error) {
      elizaLogger.error("[DISCORD] Error fetching Discord posts:", error);
      throw error;
    } finally {
      // Don't destroy the client as it might be reused
    }
  }

  async destroy(): Promise<void> {
    await this.client.destroy();
  }

  private convertMessageToPost(message: Message): ForumPost {
    const reactions: Record<string, number> = {};
    message.reactions.cache.forEach((reaction) => {
      reactions[reaction.emoji.name || reaction.emoji.id || "unknown"] = reaction.count;
    });

    const thread = message.thread;
    const replyCount = thread ? thread.messageCount || 0 : message.reactions.cache.size;

    return {
      id: message.id,
      platform: "discord",
      title: message.content.split("\n")[0].slice(0, 100),
      content: message.content,
      author: message.author.username,
      timestamp: message.createdAt,
      url: message.url,
      replies: replyCount,
      reactions,
    };
  }

  private getTimeframeMs(timeframe: string): number {
    const day = 24 * 60 * 60 * 1000;
    switch (timeframe.toLowerCase()) {
      case "day":
        return day;
      case "week":
        return 7 * day;
      case "month":
        return 30 * day;
      default:
        return 7 * day;
    }
  }
} 