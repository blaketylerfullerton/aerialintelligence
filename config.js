/**
 * Configuration file for RTMP Server with AI Classification
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

  // Frame Capture Configuration
  frameCapture: {
    captureIntervalMs: 10000, // Capture every 10 seconds
    initialDelayMs: 3000, // Wait 3 seconds before first capture
    maxFiles: 100, // Maximum number of files to keep
    quality: 2, // FFmpeg quality setting (1-31, lower is better)
  },

  // File Paths
  paths: {
    capturedFrames: "captured_frames",
    classificationResults: "classification_results",
    pythonScript: "image_classifier.py",
  },

  // Classification Configuration
  classification: {
    enabled: true,
    processDelayMs: 1000, // Delay before starting classification
    task: "<CAPTION>", // Default classification task
  },

  // Logging Configuration
  logging: {
    level: "info", // debug, info, warn, error
    showFFmpegOutput: false,
  },

  // Cleanup Configuration
  cleanup: {
    enabled: true,
    intervalMs: 60 * 60 * 1000, // Run cleanup every hour
    maxFiles: 100,
  },
};
