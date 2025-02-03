# @elizaos/plugin-forum-analyzer

A powerful forum analysis plugin for DAOra that helps identify potential governance proposals from various DAO discussion platforms.

## Features

- Multi-platform support:
  - Discourse forums (public and private)
  - Discord channels
  - Commonwealth discussions
- Advanced analysis capabilities:
  - Proposal identification
  - Sentiment analysis
  - Engagement metrics
  - Consensus detection
  - Key points extraction
- Public forum support without API access
- Configurable analysis thresholds

## Installation

```bash
pnpm add @elizaos/plugin-forum-analyzer
```

## Configuration

Add the plugin to your DAOra character configuration:

```json
{
  "name": "DAOra",
  "plugins": ["@elizaos/plugin-forum-analyzer"],
  "settings": {
    "plugins": {
      "forum-analyzer": {
        "platforms": {
          "discourse": {
            "usePublicDiscourse": true,
            "baseUrl": "https://your-forum.com"
          },
          "discord": {
            "token": "your-bot-token",
            "channels": ["channel-id-1", "channel-id-2"]
          },
          "commonwealth": {
            "space": "your-dao-space"
          }
        },
        "analysisOptions": {
          "minEngagementThreshold": 0.3,
          "proposalThreshold": 0.7,
          "includeSentiment": true,
          "includeConsensus": true
        }
      }
    }
  }
}
```

## Usage

The plugin automatically enhances DAOra's capabilities to:

1. Monitor forum discussions for potential governance proposals
2. Analyze community sentiment and consensus
3. Track engagement metrics
4. Extract key points from discussions

Example interactions:

```
User: Can you analyze recent discussions for potential proposals?
DAOra: I'll scan the configured platforms and analyze the discussions. I'll look for:
- High engagement topics
- Proposal-like content
- Community consensus
- Supporting evidence
```

## API Reference

### ForumAnalyzerPlugin

Main plugin class that implements forum analysis functionality.

```typescript
interface ForumAnalyzerConfig {
  platforms: {
    discourse?: {
      usePublicDiscourse?: boolean;
      apiKey?: string;
      baseUrl?: string;
    };
    discord?: {
      token?: string;
      channels?: string[];
    };
    commonwealth?: {
      apiKey?: string;
      space?: string;
    };
  };
  analysisOptions?: {
    minEngagementThreshold?: number;
    proposalThreshold?: number;
    includeSentiment?: boolean;
    includeConsensus?: boolean;
  };
}
```

## License

MIT 