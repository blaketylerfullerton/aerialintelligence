# RTMP Server with AI Classification

A real-time RTMP streaming server with AI-powered image classification and Telegram notifications.

## 📁 Project Structure

```
├── src/                    # Source code
│   ├── server.ts          # Main RTMP server (TypeScript)
│   ├── server.js          # Legacy JavaScript server
│   ├── imageClassifier.ts # AI classification service
│   ├── telegramNotifier.ts# Telegram notification service
│   └── site.html          # Web viewer interface
├── config/                # Configuration files
│   ├── config.js          # Main configuration (JavaScript)
│   └── config.py          # Python configuration (legacy)
├── data/                  # Runtime data (ignored by git)
│   ├── captured_frames/   # Video frame captures
│   └── classification_results/ # AI classification results
├── docs/                  # Documentation
│   └── README.md          # Detailed documentation
├── package.json           # Node.js dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── .gitignore             # Git ignore rules
```

## 🚀 Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure API keys** in `config/config.js`

3. **Start the server**:

   ```bash
   npm start          # TypeScript version
   npm run start:js   # JavaScript version
   ```

4. **Stream to**: `rtmp://localhost:1935/live/{stream_key}`

## 📖 Full Documentation

See [docs/README.md](docs/README.md) for complete setup instructions, configuration options, and usage examples.

## 🛠️ Development

- `npm run dev` - Start with auto-reload
- `npm run build` - Compile TypeScript
- `npm run classify` - Test AI classification
- `npm run notify` - Test Telegram notifications

## 🔧 Configuration

Key configuration files:

- `config/config.js` - Main server and AI settings
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript compiler options

Data directories are automatically created and managed by the application.
