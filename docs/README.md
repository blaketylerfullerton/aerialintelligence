# RTMP Server with AI Classification (TypeScript)

A real-time RTMP streaming server with AI-powered image classification and Telegram notifications, now fully converted to TypeScript.

## Features

- **RTMP Streaming**: Receive live video streams
- **AI Classification**: Automatically classify captured frames using NVIDIA's Florence-2 model
- **Telegram Notifications**: Send classification results with images to Telegram
- **Real-time Processing**: Capture frames at configurable intervals during streaming
- **Type Safety**: Full TypeScript implementation with proper error handling
- **File Management**: Automatic cleanup of old frames and classification results
- **Configurable Triggers**: Send notifications only when specific keywords are detected

##  Prerequisites

- Node.js (v16 or higher)
- FFmpeg (for frame capture)
- NVIDIA API key (for AI classification)
- Telegram Bot Token and Chat ID (for notifications)

##  Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   # For Telegram notifications
   export TELEGRAM_BOT_TOKEN="your_bot_token_here"
   export TELEGRAM_CHAT_ID="your_chat_id_here"

   # Alternative: Set NVIDIA API key as environment variable
   export NVIDIA_API_KEY="your_nvidia_api_key_here"
   ```

3. **Create config.js** (if not exists):

   ```javascript
   module.exports = {
     // NVIDIA API Configuration
     API_KEY: "your_nvidia_api_key_here",
     NVAi_URL: "https://ai.api.nvidia.com/v1/vlm/microsoft/florence-2",

     // Server configuration
     server: {
       rtmp: {
         port: 1935,
         chunk_size: 60000,
         gop_cache: true,
         ping: 30,
         ping_timeout: 60,
       },
       http: { port: 8000, allow_origin: "*" },
     },

     // Path configuration
     paths: {
       capturedFrames: "captured_frames",
       classificationResults: "classification_results",
     },

     // Frame capture settings
     frameCapture: {
       captureIntervalMs: 10000, // Capture every 10 seconds
       initialDelayMs: 3000, // Wait 3 seconds before first capture
       quality: 2, // FFmpeg quality setting
     },

     // Classification settings
     classification: {
       enabled: true,
       task: "<CAPTION>", // or "<DETAILED_CAPTION>", "<MORE_DETAILED_CAPTION>"
       processDelayMs: 1000, // Wait 1 second before processing captured frame
     },

     // Notification settings
     notifications: {
       enabled: true,
       triggers: {
         enabled: true, // Enable keyword filtering
         keywords: ["person", "vehicle", "motion"], // Keywords to trigger notifications
         requireAll: false, // true = ALL keywords required, false = ANY keyword triggers
       },
     },

     // File cleanup settings
     cleanup: {
       enabled: true,
       maxFiles: 100, // Keep last 100 files
       intervalMs: 300000, // Clean up every 5 minutes
     },

     // Logging settings
     logging: {
       level: "info", // "debug" for verbose output
       showFFmpegOutput: false,
     },
   };
   ```

##  Usage

### Start the Server

**TypeScript version (recommended)**:

```bash
npm start
# or for development with auto-restart
npm run dev
```

**JavaScript version (legacy)**:

```bash
npm run start:js
# or for development
npm run dev:js
```

### Streaming to the Server

1. **Stream URL**: `rtmp://localhost:1935/live`
2. **Stream Key**: Any key you choose (e.g., "drone", "webcam", "security")

Example with OBS Studio:

- Server: `rtmp://localhost:1935/live`
- Stream Key: `drone`

Example with FFmpeg:

```bash
ffmpeg -i input.mp4 -c copy -f flv rtmp://localhost:1935/live/drone
```

### Viewing the Stream

- **RTMP**: `rtmp://localhost:1935/live/drone`
- **HTTP-FLV**: `http://localhost:8000/live/drone.flv`

##  AI Classification

The system automatically:

1. Captures frames from live streams at configured intervals
2. Sends frames to NVIDIA's Florence-2 model for classification
3. Saves results to JSON files in `classification_results/`
4. Sends Telegram notifications based on configured triggers

### Classification Tasks

Configure the `classification.task` in config.js:

- `<CAPTION>`: Simple caption
- `<DETAILED_CAPTION>`: More detailed description
- `<MORE_DETAILED_CAPTION>`: Very detailed description

## 📱 Telegram Notifications

### Setup Bot

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
3. Set environment variables or update config

### Keyword Triggers

Configure notification triggers in config.js:

- `enabled: true` - Enable keyword filtering
- `keywords: []` - Array of trigger keywords
- `requireAll: false` - Trigger behavior:
  - `false`: ANY keyword triggers notification
  - `true`: ALL keywords must be present

## 🔧 TypeScript Development

### Build TypeScript

```bash
npm run build
```

### Run Individual Modules

```bash
# Test image classification
npm run classify -- /path/to/image.jpg ./output_dir --task "<CAPTION>" --debug

# Test Telegram notification
npm run notify -- --image /path/to/image.jpg --message "Test notification"
```

### Project Structure

```
├── server.ts              # Main RTMP server (TypeScript)
├── imageClassifier.ts     # AI classification service
├── telegramNotifier.ts    # Telegram notification service
├── server.js              # Legacy JavaScript server
├── config.js              # Configuration file
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## 📊 Output Files

- **Frames**: `captured_frames/frame-{count}-{timestamp}.jpg`
- **Classifications**: `classification_results/frame-{count}-{timestamp}_classification.json`
- **Summary Log**: `classification_results/classification_summary.jsonl`

## 🔍 Debugging

Enable debug mode in config.js:

```javascript
logging: {
  level: "debug",
  showFFmpegOutput: true
}
```

Or run individual modules with debug:

```bash
npm run classify -- /path/to/image.jpg ./output --debug
```

