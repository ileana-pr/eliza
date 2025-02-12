# Sage - Solana Meme Token Tracking Agent

Sage is an AI-powered agent built on the Eliza framework, specialized in tracking and analyzing Solana meme tokens. It provides real-time market data monitoring, security analysis, and automated social media updates.

## 🌟 Key Features

- **Real-time Token Tracking**: Monitor Solana meme tokens using Birdeye API
- **Market Analysis**: Track price movements, volume, market cap, and liquidity
- **Security Scanning**: Detect potential risks and suspicious token behavior
- **Social Integration**: Automated Twitter updates for significant market events
- **Configurable Parameters**: Customize tracking criteria and thresholds
- **Plugin Architecture**: Extensible design for adding new features

## 🚀 Quick Start

1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/sage.git
cd sage
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
Create a `.env` file in the root directory:
```env
BIRDEYE_API_KEY=your_birdeye_api_key
SOLANA_PUBLIC_KEY=your_wallet_public_key  # Optional
TWITTER_API_KEY=your_twitter_api_key      # Optional
```

4. **Start the Agent**
```bash
npm start
```

## 📦 Project Structure

```
sage/
├── packages/
│   ├── core/                 # Eliza core framework
│   ├── agent/               # Agent runtime
│   └── plugin-solana-meme-tracker/  # Main plugin
├── characters/              # Agent personalities
└── docs/                    # Documentation
```

## 🔌 Plugin System

The main functionality is implemented as a plugin (`plugin-solana-meme-tracker`). See the [plugin documentation](packages/plugin-solana-meme-tracker/README.md) for detailed information.

## 🛠️ Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Birdeye API key
- (Optional) Solana wallet
- (Optional) Twitter API credentials

### Running Tests
```bash
npm test
```

### Building
```bash
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the Eliza framework
- Powered by Birdeye API
- Solana blockchain community

## 📬 Contact

- GitHub Issues: For bug reports and feature requests
- Twitter: [@YourTwitterHandle](https://twitter.com/yourtwitterhandle)
- Discord: [Join our community](your-discord-link) 