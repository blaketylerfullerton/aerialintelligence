const NodeMediaServer = require("node-media-server");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const config = require("../config/config");

// Initialize server
const nms = new NodeMediaServer(config.server);

// Setup directories
const captureDir = path.join(__dirname, config.paths.capturedFrames);
const classificationDir = path.join(
  __dirname,
  config.paths.classificationResults
);
const pythonScriptPath = path.join(__dirname, config.paths.pythonScript);

// Create directories if they don't exist
[captureDir, classificationDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// State management
let activeStreams = new Map();
let frameCount = 0;

/**
 * Classification Service
 */
class ClassificationService {
  static classifyImage(imagePath) {
    if (!config.classification.enabled) {
      console.log("🤖 Classification disabled in config");
      return;
    }

    console.log(`🤖 Starting classification for: ${path.basename(imagePath)}`);

    // Build arguments array
    const pythonArgs = [
      pythonScriptPath,
      imagePath,
      classificationDir,
      "--task",
      config.classification.task,
    ];

    // Add debug flag if debug logging is enabled
    if (config.logging.level === "debug") {
      pythonArgs.push("--debug");
    }

    const python = spawn("python", pythonArgs);

    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      this._parseClassificationOutput(text);
    });

    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0 && errorOutput) {
        console.log(`❌ Classification process failed with code ${code}`);
        if (config.logging.level === "debug") {
          console.log(`Error output: ${errorOutput}`);
        }
      }
    });

    python.on("error", (error) => {
      console.log(
        `❌ Failed to start classification process: ${error.message}`
      );
    });
  }

  static _parseClassificationOutput(text) {
    const lines = text.split("\n");
    lines.forEach((line) => {
      if (line.startsWith("CLASSIFICATION_RESULT:")) {
        try {
          const resultJson = line.substring("CLASSIFICATION_RESULT:".length);
          const result = JSON.parse(resultJson);

          if (result.success) {
            console.log(`✅ Classification complete for ${result.image_file}:`);
            console.log(`   📝 Result: ${result.classification}`);
            console.log(`   💾 Saved to: ${path.basename(result.result_file)}`);
            SummaryLogger.saveResult(result);

            // Send SMS notification with classification result
            NotificationService.sendClassificationNotification(result);
          } else {
            console.log(
              `❌ Classification failed for ${result.image_file}: ${result.error}`
            );
          }
        } catch (e) {
          console.log(`Error parsing classification result: ${e.message}`);
        }
      } else if (
        line.trim() &&
        !line.includes("Response status code") &&
        config.logging.level === "debug"
      ) {
        console.log(`   🐍 ${line.trim()}`);
      }
    });
  }
}

/**
 * AI-Powered Threat Detection Service
 */
const { ThreatDetector } = require("./threatDetector");

class IntelligentSecurityFilter {
  static threatDetector = new ThreatDetector({
    notificationThreshold: 3, // MEDIUM and above
    detailedAnalysis: true,
    timeBasedAnalysis: true
  });

  static async shouldTriggerNotification(classificationResult) {
    try {
      // Use AI-powered threat detection instead of keyword matching
      const threatAnalysis = await this.threatDetector.analyzeThreat(classificationResult);
      
      // Log threat analysis for debugging
      if (config.logging?.level === "debug") {
        console.log(`🤖 Threat Analysis Results:`);
        console.log(`   📊 Threat Level: ${threatAnalysis.threat_level}`);
        console.log(`   🎯 Score: ${threatAnalysis.threat_score}/5`);
        console.log(`   💯 Confidence: ${threatAnalysis.confidence}%`);
        console.log(`   🚨 Should Notify: ${threatAnalysis.threat_detected}`);
        if (threatAnalysis.threat_reasons.length > 0) {
          console.log(`   📝 Reasons:`);
          threatAnalysis.threat_reasons.forEach(reason => {
            console.log(`      • ${reason}`);
          });
        }
      }

      // Store threat analysis for notification service
      classificationResult._threatAnalysis = threatAnalysis;
      
      return this.threatDetector.shouldTriggerNotification(threatAnalysis);
    } catch (error) {
      console.log(`❌ Threat analysis failed: ${error.message}`);
      // Fallback to basic notification on analysis failure
      return config.notifications?.enabled || false;
    }
  }

  static getThreatAnalysis(classificationResult) {
    return classificationResult._threatAnalysis || null;
  }

  static generateThreatSummary(classificationResult) {
    const analysis = this.getThreatAnalysis(classificationResult);
    if (analysis) {
      return this.threatDetector.generateThreatSummary(analysis);
    }
    return `📝 Classification: ${classificationResult.classification}`;
  }
}

/**
 * Notification Service
 */
class NotificationService {
  static async sendClassificationNotification(result) {
    if (!config.notifications?.enabled) {
      console.log("📱 Notifications disabled in config");
      return;
    }

    // Use AI-powered threat detection instead of keyword matching
    const shouldNotify = await IntelligentSecurityFilter.shouldTriggerNotification(result);
    
    if (!shouldNotify) {
      console.log(`📱 No security threats detected - skipping notification`);
      if (config.logging.level === "debug") {
        const analysis = IntelligentSecurityFilter.getThreatAnalysis(result);
        if (analysis) {
          console.log(`   📊 Threat Level: ${analysis.threat_level}`);
          console.log(`   🎯 Score: ${analysis.threat_score}/5`);
          console.log(`   💯 Confidence: ${analysis.confidence}%`);
        }
      }
      return;
    }

    // Generate intelligent threat summary
    const threatSummary = IntelligentSecurityFilter.generateThreatSummary(result);
    const analysis = IntelligentSecurityFilter.getThreatAnalysis(result);
    
    console.log(`🚨 SECURITY ALERT - Sending notification`);
    console.log(`   📊 Threat Level: ${analysis?.threat_level || 'UNKNOWN'}`);
    console.log(`   🎯 Score: ${analysis?.threat_score || 0}/5`);

    // Create enhanced notification message
    const caption = `🚨 SECURITY ALERT\n\n${threatSummary}`;

    // Get the full image path from the captured frames directory
    const imagePath = path.join(captureDir, path.basename(result.image_file));

    const smsScriptPath = path.join(__dirname, "sms.py");

    // Run the SMS Python script with the enhanced message and image path as arguments
    const python = spawn("python", [
      smsScriptPath,
      "--image",
      imagePath,
      "--message",
      caption,
    ]);

    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    python.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Security alert sent successfully`);
        if (config.logging.level === "debug" && output) {
          console.log(`SMS output: ${output.trim()}`);
        }
      } else {
        console.log(`❌ Security alert failed with code ${code}`);
        if (errorOutput) {
          console.log(`SMS error: ${errorOutput.trim()}`);
        }
      }
    });

    python.on("error", (error) => {
      console.log(`❌ Failed to start SMS process: ${error.message}`);
    });
  }
}

/**
 * Summary Logging Service
 */
class SummaryLogger {
  static saveResult(result) {
    const summaryLogPath = path.join(
      classificationDir,
      "classification_summary.jsonl"
    );
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...result,
    };

    try {
      fs.appendFileSync(summaryLogPath, JSON.stringify(logEntry) + "\n");
    } catch (error) {
      console.log(`⚠️  Failed to save summary log: ${error.message}`);
    }
  }
}

/**
 * Frame Capture Service
 */
class FrameCaptureService {
  static captureFrameFromStream(streamPath) {
    frameCount++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `frame-${frameCount}-${timestamp}.jpg`;
    const outputPath = path.join(captureDir, filename);

    console.log(`📸 Capturing frame ${frameCount} from ${streamPath}...`);

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      `rtmp://localhost:1935${streamPath}`,
      "-vframes",
      "1",
      "-f",
      "image2",
      "-q:v",
      config.frameCapture.quality.toString(),
      "-y", // Overwrite output file
      outputPath,
    ]);

    ffmpeg.on("close", (code) => {
      this._handleCaptureResult(code, outputPath, filename);
    });

    ffmpeg.stderr.on("data", (data) => {
      this._handleFFmpegOutput(data);
    });

    ffmpeg.on("error", (error) => {
      console.log(`❌ FFmpeg process failed: ${error.message}`);
    });
  }

  static _handleCaptureResult(code, outputPath, filename) {
    if (code === 0) {
      console.log(`📸 Frame captured: ${filename}`);

      fs.stat(outputPath, (err, stats) => {
        if (!err && stats.size > 0) {
          console.log(`🔍 Starting classification for captured frame...`);
          setTimeout(
            () => ClassificationService.classifyImage(outputPath),
            config.classification.processDelayMs
          );
        } else {
          console.log(
            `⚠️  Captured frame is empty or doesn't exist: ${filename}`
          );
        }
      });
    } else {
      console.log(`❌ Frame capture failed (code: ${code})`);
    }
  }

  static _handleFFmpegOutput(data) {
    if (!config.logging.showFFmpegOutput) return;

    const error = data.toString();
    if (
      error.includes("Error") ||
      error.includes("failed") ||
      error.includes("No such file")
    ) {
      console.log(`FFmpeg error: ${error.trim()}`);
    }
  }
}

/**
 * Stream Management Service
 */
class StreamManagementService {
  static startFrameCapture(streamPath) {
    if (activeStreams.has(streamPath)) {
      return; // Already capturing
    }

    console.log(
      `🎥 Starting frame capture and classification for ${streamPath}`
    );

    // Capture first frame after a delay to ensure stream is stable
    setTimeout(() => {
      FrameCaptureService.captureFrameFromStream(streamPath);
    }, config.frameCapture.initialDelayMs);

    // Then capture at regular intervals
    const interval = setInterval(() => {
      FrameCaptureService.captureFrameFromStream(streamPath);
    }, config.frameCapture.captureIntervalMs);

    activeStreams.set(streamPath, interval);
  }

  static stopFrameCapture(streamPath) {
    const interval = activeStreams.get(streamPath);
    if (interval) {
      clearInterval(interval);
      activeStreams.delete(streamPath);
      console.log(`⏹️  Stopped frame capture for ${streamPath}`);
    }
  }
}

/**
 * File Cleanup Service
 */
class FileCleanupService {
  static cleanupOldFiles() {
    if (!config.cleanup.enabled) return;

    console.log("🧹 Running file cleanup...");
    this._cleanupFrames();
    this._cleanupClassificationResults();
  }

  static _cleanupFrames() {
    fs.readdir(captureDir, (err, files) => {
      if (err) return;

      const frameFiles = files
        .filter((f) => f.startsWith("frame-"))
        .map((f) => ({
          name: f,
          path: path.join(captureDir, f),
          time: fs.statSync(path.join(captureDir, f)).mtime,
        }))
        .sort((a, b) => a.time - b.time);

      if (frameFiles.length > config.cleanup.maxFiles) {
        const filesToDelete = frameFiles.slice(
          0,
          frameFiles.length - config.cleanup.maxFiles
        );
        filesToDelete.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️  Deleted old frame: ${file.name}`);
          } catch (error) {
            console.log(`⚠️  Failed to delete ${file.name}: ${error.message}`);
          }
        });
      }
    });
  }

  static _cleanupClassificationResults() {
    fs.readdir(classificationDir, (err, files) => {
      if (err) return;

      const jsonFiles = files
        .filter((f) => f.endsWith("_classification.json"))
        .map((f) => ({
          name: f,
          path: path.join(classificationDir, f),
          time: fs.statSync(path.join(classificationDir, f)).mtime,
        }))
        .sort((a, b) => a.time - b.time);

      if (jsonFiles.length > config.cleanup.maxFiles) {
        const filesToDelete = jsonFiles.slice(
          0,
          jsonFiles.length - config.cleanup.maxFiles
        );
        filesToDelete.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️  Deleted old classification: ${file.name}`);
          } catch (error) {
            console.log(`⚠️  Failed to delete ${file.name}: ${error.message}`);
          }
        });
      }
    });
  }
}

// Initialize cleanup schedule
if (config.cleanup.enabled) {
  setInterval(() => {
    FileCleanupService.cleanupOldFiles();
  }, config.cleanup.intervalMs);
}

/**
 * Event Handlers
 */
class EventHandlers {
  static setupEventListeners() {
    nms.on("preConnect", (id, args) => {
      if (config.logging.level === "debug") {
        console.log(`[preConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("postConnect", (id, args) => {
      if (config.logging.level === "debug") {
        console.log(`[postConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("doneConnect", (id, args) => {
      if (config.logging.level === "debug") {
        console.log(`[doneConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("prePublish", (id, StreamPath, args) => {
      console.log(`[prePublish] Stream: ${StreamPath}`);
      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("postPublish", (id, StreamPath, args) => {
      console.log(`[postPublish] Stream started: ${StreamPath}`);
      StreamManagementService.startFrameCapture(StreamPath);

      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("donePublish", (id, StreamPath, args) => {
      console.log(`[donePublish] Stream ended: ${StreamPath}`);
      StreamManagementService.stopFrameCapture(StreamPath);

      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("prePlay", (id, StreamPath, args) => {
      if (config.logging.level === "debug") {
        console.log(
          `[prePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(
            args
          )}`
        );
      }
    });

    nms.on("postPlay", (id, StreamPath, args) => {
      if (config.logging.level === "debug") {
        console.log(
          `[postPlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(
            args
          )}`
        );
      }
    });

    nms.on("donePlay", (id, StreamPath, args) => {
      if (config.logging.level === "debug") {
        console.log(
          `[donePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(
            args
          )}`
        );
      }
    });
  }
}

/**
 * Server Initialization
 */
function startServer() {
  // Setup event listeners
  EventHandlers.setupEventListeners();

  // Start the RTMP server
  nms.run();

  // Display startup information
  console.log("🚀 RTMP Server with AI Classification started!");
  console.log(`📡 RTMP Port: ${config.server.rtmp.port}`);
  console.log(`🌐 HTTP Port: ${config.server.http.port}`);
  console.log(
    `📸 Frame Capture: ${
      config.frameCapture.captureIntervalMs / 1000
    }s intervals`
  );
  console.log(
    `🤖 AI Classification: ${
      config.classification.enabled ? "Enabled" : "Disabled"
    }`
  );
  console.log(
    `📱 Security Alerts: ${
      config.notifications?.enabled ? "Enabled" : "Disabled"
    }`
  );
  console.log(
    `🤖 AI Threat Detection: ${
      config.threatDetection?.enabled !== false ? "Enabled" : "Disabled"
    }`
  );
  if (config.threatDetection?.enabled !== false) {
    const threshold = config.threatDetection?.notificationThreshold || 3;
    const levels = ["NONE", "NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    console.log(
      `🎯 Alert Threshold: ${levels[threshold]} and above (Score: ${threshold}/5)`
    );
    console.log(
      `🧠 Detailed Analysis: ${
        config.threatDetection?.detailedAnalysis !== false ? "Enabled" : "Disabled"
      }`
    );
  }
  console.log(`📁 Frame Directory: ${captureDir}`);
  console.log(`📁 Classification Directory: ${classificationDir}`);
  console.log("");
  console.log("Connection Info:");
  console.log(`  Stream URL: rtmp://localhost:${config.server.rtmp.port}/live`);
  console.log(`  Stream Key: <your-key> (e.g., 'drone')`);
  console.log("");
  console.log("Viewing Options:");
  console.log(`  RTMP: rtmp://localhost:${config.server.rtmp.port}/live/<key>`);
  console.log(
    `  HTTP-FLV: http://localhost:${config.server.http.port}/live/<key>.flv`
  );
  console.log("  Web Viewer: Open site.html in your browser");
  console.log("");
  console.log(
    "🤖 AI Classification will automatically process captured frames!"
  );
  console.log(
    "📊 Results saved to JSON files in classification_results directory"
  );
  console.log(
    "📈 Summary log: classification_results/classification_summary.jsonl"
  );
  if (config.notifications?.enabled) {
    console.log(
      "🚨 Security alerts will be sent to Telegram when threats are detected!"
    );
    console.log(
      "🤖 AI will analyze each frame for suspicious activities, break-ins, weapons, etc."
    );
    if (config.threatDetection?.enabled !== false) {
      const threshold = config.threatDetection?.notificationThreshold || 3;
      const levels = ["NONE", "NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
      console.log(
        `🎯 Only ${levels[threshold]} and above threats will trigger alerts`
      );
    }
  }
  console.log("Press Ctrl+C to stop the server");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");

  // Stop all active frame captures
  for (const [streamPath] of activeStreams) {
    StreamManagementService.stopFrameCapture(streamPath);
  }

  console.log("👋 Server stopped gracefully");
  process.exit(0);
});

// Start the server
startServer();

