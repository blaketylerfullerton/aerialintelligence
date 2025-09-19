# RTMP Server with AI Classification

A Node.js RTMP server that automatically captures frames from live streams and classifies them using NVIDIA's Florence-2 AI model.

## Features

- **RTMP Streaming Server**: Accepts live video streams on port 1935
- **HTTP Server**: Serves streams via HTTP-FLV on port 8000
- **Automatic Frame Capture**: Captures frames from active streams at configurable intervals
- **AI Classification**: Uses NVIDIA's Florence-2 model to classify captured frames
- **Configurable Settings**: Easy configuration via `config.js`
- **File Management**: Automatic cleanup of old frames and classification results
- **Graceful Shutdown**: Properly handles server shutdown and resource cleanup

## Project Structure

```
├── server.js              # Main RTMP server with organized class structure
├── image_classifier.py    # Python script for AI image classification
├── config.js             # JavaScript configuration file
├── config.py             # Python configuration file (contains API keys)
├── captured_frames/      # Directory for captured video frames
├── classification_results/ # Directory for AI classification results
└── site.html             # Web viewer for streams (if exists)
```

## Setup

### Prerequisites

- Node.js (v12 or higher)
- Python 3.7+
- FFmpeg installed and available in PATH
- NVIDIA API key for Florence-2 model

### Installation

1. **Install Node.js dependencies:**

   ```bash
   npm install node-media-server
   ```

2. **Install Python dependencies:**

   ```bash
   pip install requests
   ```

3. **Configure API Key:**

   Edit `config.py` and add your NVIDIA API key:

   ```python
   API_KEY = "your-nvidia-api-key-here"
   ```

   Alternatively, set the environment variable:

   ```bash
   export NVIDIA_API_KEY="your-nvidia-api-key-here"
   ```

## Configuration

Edit `config.js` to customize server behavior:

```javascript
module.exports = {
  server: {
    rtmp: { port: 1935 },
    http: { port: 8000 },
  },
  frameCapture: {
    captureIntervalMs: 10000, // Capture every 10 seconds
    initialDelayMs: 3000, // Wait 3 seconds before first capture
    quality: 2, // FFmpeg quality (1-31, lower is better)
  },
  classification: {
    enabled: true, // Enable/disable AI classification
    task: "<CAPTION>", // Classification task type
  },
  cleanup: {
    enabled: true,
    maxFiles: 100, // Keep last 100 files
  },
};
```

## Usage

### Starting the Server

```bash
node server.js
```

### Streaming to the Server

Use any RTMP-compatible streaming software (OBS, ffmpeg, etc.):

- **Stream URL**: `rtmp://localhost:1935/live`
- **Stream Key**: Any key you choose (e.g., "drone", "camera1")

Example with ffmpeg:

```bash
ffmpeg -i input.mp4 -c copy -f flv rtmp://localhost:1935/live/drone
```

### Viewing Streams

- **RTMP**: `rtmp://localhost:1935/live/YOUR_KEY`
- **HTTP-FLV**: `http://localhost:8000/live/YOUR_KEY.flv`
- **Web Viewer**: Open `site.html` in your browser (if available)

## AI Classification

The system automatically:

1. **Captures frames** from active streams at configured intervals
2. **Uploads frames** to NVIDIA's API service
3. **Classifies images** using the Florence-2 model
4. **Saves results** as JSON files in `classification_results/`
5. **Logs summary** to `classification_summary.jsonl`

### Classification Output

Each classification creates:

- Individual JSON file: `frame-X-timestamp_classification.json`
- Summary log entry in: `classification_summary.jsonl`

Example classification result:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "image_file": "frame-1-2024-01-01T12-00-00-000Z.jpg",
  "classification": "A person standing in front of a building",
  "processed_at": "2024-01-01T12:00:05.000Z"
}
```

## File Management

The system automatically manages disk space by:

- Keeping only the most recent 100 frames (configurable)
- Keeping only the most recent 100 classification results
- Running cleanup every hour
- Deleting files based on modification time

## Services Architecture

The cleaned-up code is organized into service classes:

- **ClassificationService**: Handles AI image classification
- **FrameCaptureService**: Manages video frame capture from streams
- **StreamManagementService**: Manages stream lifecycle and frame capture intervals
- **FileCleanupService**: Handles automatic file cleanup
- **SummaryLogger**: Manages classification result logging
- **EventHandlers**: Handles RTMP server events

## Error Handling

The system includes comprehensive error handling:

- Failed frame captures are logged but don't stop the server
- Classification errors are logged with details
- File operation errors are handled gracefully
- Server shutdown is handled cleanly with resource cleanup

## Security Notes

⚠️ **Important**:

- Never commit `config.py` with real API keys to version control
- The `.gitignore` file excludes sensitive configuration files
- Consider using environment variables for API keys in production

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure FFmpeg is installed and in your PATH
2. **Python not found**: The server tries `python3` first, then `python`
3. **Classification failures**: Check your NVIDIA API key and network connection
4. **Stream not appearing**: Verify your streaming software is using the correct URL and key

### Logs

- Server events are logged to console
- Set `logging.level: "debug"` in config.js for verbose output
- Classification results include error details when failures occur

## License

This project is for educational and development purposes. Ensure you comply with NVIDIA's API terms of service when using their classification services.
