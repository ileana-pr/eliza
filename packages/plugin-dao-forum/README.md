# @eliza/plugin-dao-forum

A plugin for Eliza that enables automated scraping and analysis of DAO governance discussions from multiple platforms including Discourse forums, Discord channels, and Commonwealth.

## Features

- Multi-platform support for major DAO communication channels
  - Discourse forums (with API or public access)
  - Discord channels
  - Commonwealth discussions
- Automatic message aggregation and chronological sorting
- Metadata preservation (timestamps, authors, sources)
- Configurable endpoints and credentials
- Rate-limiting and pagination support
- Error handling and retry mechanisms

## Installation

```bash
# Using pnpm (recommended)
pnpm add @eliza/plugin-dao-forum

# Using npm
npm install @eliza/plugin-dao-forum

# Using yarn
yarn add @eliza/plugin-dao-forum
```

## Configuration

The plugin accepts the following configuration options:

```typescript
interface DAOForumConfig {
  // Discourse forum configuration
  discourseUrl?: string;        // URL of your Discourse forum
  discourseApiKey?: string;     // API key for Discourse (optional)
  usePublicDiscourse?: boolean; // Use public scraping instead of API

  // Discord configuration
  discordToken?: string;        // Discord bot token
  discordChannelIds?: string[]; // Array of channel IDs to monitor

  // Commonwealth configuration
  commonwealthUrl?: string;     // URL of your Commonwealth space
}
```

## Usage

### Basic Setup

```typescript
// Using public Discourse access (no API key needed)
const daoForumPlugin = new DAOForumPlugin({
  discourseUrl: 'https://forum.yourdao.org',
  usePublicDiscourse: true,
  discordToken: process.env.DISCORD_BOT_TOKEN,
  discordChannelIds: ['channel-id-1', 'channel-id-2'],
  commonwealthUrl: 'https://commonwealth.im/your-dao'
});

// Using Discourse API (requires admin access)
const daoForumPlugin = new DAOForumPlugin({
  discourseUrl: 'https://forum.yourdao.org',
  discourseApiKey: process.env.DISCOURSE_API_KEY,
  discordToken: process.env.DISCORD_BOT_TOKEN,
  discordChannelIds: ['channel-id-1', 'channel-id-2'],
  commonwealthUrl: 'https://commonwealth.im/your-dao'
});
```

### Integration with Eliza

```typescript
import { Eliza } from '@eliza/core';

const eliza = new Eliza({
  // ... other configuration options
  plugins: [daoForumPlugin]
});
```

## Platform-Specific Setup

### Discourse Setup

#### Option 1: Public Access (Recommended for non-admins)
1. Set `usePublicDiscourse: true` in your configuration
2. Provide the forum URL
3. No API key needed
4. Works with any Discourse forum you can access publicly

Limitations of public access:
- Respects rate limiting automatically (1 second delay between requests)
- Only fetches publicly available posts
- May be slightly slower than API access

#### Option 2: API Access (Requires admin privileges)
1. Go to your Discourse admin panel
2. Navigate to API settings
3. Generate a new API key with appropriate permissions
4. Set the API key in your configuration

Required permissions:
- Read topics
- List categories
- Read users

### Discord Setup

1. Create a new Discord application at https://discord.com/developers/applications
2. Create a bot for your application
3. Enable necessary intents (MESSAGE CONTENT, GUILD MESSAGES)
4. Add the bot to your server with required permissions
5. Get the channel IDs you want to monitor (Developer Mode must be enabled)

Required permissions:
- Read Messages/View Channels
- Read Message History

### Commonwealth Setup

1. No API key required
2. Provide the URL of your DAO's Commonwealth space
3. Ensure the discussions are public

## Message Format

The plugin normalizes messages from all sources into a standard format:

```typescript
interface Message {
  content: {
    text: string;
    metadata: {
      source: 'discourse' | 'discord' | 'commonwealth';
      url?: string;
      channelId?: string;
      timestamp: Date;
    }
  };
  user: string;
}
```

## Advanced Usage

### Custom Message Processing

```typescript
const daoForumPlugin = new DAOForumPlugin({
  // ... configuration
});

// Access raw messages from specific platform
const discourseMessages = await daoForumPlugin.scrapeDiscourse();
const discordMessages = await daoForumPlugin.scrapeDiscord();
const commonwealthMessages = await daoForumPlugin.scrapeCommonwealth();
```

### Error Handling

The plugin implements automatic retries for failed requests and graceful degradation when certain platforms are unavailable. Errors are logged but won't crash the application.

## Limitations

- Discord: Limited to 100 messages per channel per request due to API restrictions
- Commonwealth: HTML scraping may need updates if the site structure changes
- Rate limits apply to all platforms and should be considered in high-frequency scenarios

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](../CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/elizaOS/eliza.git

# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Run tests
pnpm test
```

## License

MIT - see [LICENSE](../LICENSE) for details