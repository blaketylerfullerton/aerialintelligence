/**
 * Configuration Template for Aerial Intelligence AI Classification
 *
 * INSTRUCTIONS:
 * 1. Copy this file to config.js
 * 2. Replace YOUR_NVIDIA_API_KEY with your actual API key
 * 3. Adjust other settings as needed
 */

module.exports = {
  // Server Configuration
  server: {
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      port: 8000,
      allow_origin: "*",
    },
  },

  // NVIDIA AI API Configuration
  nvidia: {
    apiKey: "YOUR_NVIDIA_API_KEY", // Replace with your actual API key
    apiUrl: "https://ai.api.nvidia.com/v1/vlm/microsoft/florence-2",
    assetUploadUrl: "https://api.nvcf.nvidia.com/v2/nvcf/assets",
    uploadTimeoutSeconds: 30,
    classificationTimeoutSeconds: 300,
  },

  // File Paths
  paths: {
    capturedFrames: "./data/captured_frames",
    classificationResults: "./data/classification_results",
  },

  // Classification Configuration
  classification: {
    enabled: true,
    processDelayMs: 1000,
    task: "<DETAILED_CAPTION>", // Detailed description for better analysis
    outputDir: "./data/classification_results",
    safetyFocused: false, // Set to true for safety-focused analysis
  },

  // Telegram Notifications Configuration
  notifications: {
    enabled: false, // Set to true to enable notifications
    botToken: process.env.TELEGRAM_BOT_TOKEN || "", // Or set directly
    chatId: process.env.TELEGRAM_CHAT_ID || "", // Or set directly
    triggers: {
      enabled: true,
      keywords: [
        "gun",
        "weapon",
        "knife",
        "fight",
        "violence",
        "blood",
        "assault",
        "fire",
        "smoke",
        "flames",
        "burning",
        "explosion",
        "collapsed",
        "unconscious",
        "medical emergency",
        "injury",
        "accident",
        "intruder",
        "break-in",
        "suspicious person",
        "trespassing",
        "burglar",
        "flood",
        "gas leak",
        "chemical spill",
        "dangerous",
        "hazard",
        "emergency",
        "help",
        "emergency",
        "call police",
        "call ambulance",
        "danger",
      ],
      requireAll: false, // ANY danger keyword triggers immediate alert
      minimumConfidence: 0.7, // Confidence threshold for danger detection
    },
  },

  // Frame Capture Configuration
  frameCapture: {
    captureIntervalMs: 10000, // Capture every 10 seconds
    initialDelayMs: 3000, // Wait 3 seconds before first capture
    maxFiles: 100, // Maximum number of files to keep
    quality: 5, // FFmpeg quality setting (1-31, lower is better)
    maxWidth: 1280, // Maximum width
    maxHeight: 720, // Maximum height
  },

  // Cleanup Configuration
  cleanup: {
    enabled: true,
    intervalMs: 60 * 60 * 1000, // Run cleanup every hour
    maxFiles: 100,
  },

  // Logging Configuration
  logging: {
    level: "info", // debug, info, warn, error
    enableDebug: true,
    showFFmpegOutput: false,
  },
};
