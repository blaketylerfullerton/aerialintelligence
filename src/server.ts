const NodeMediaServer = require("node-media-server");
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  ImageClassifier,
  saveClassificationResult,
  setDebugMode,
} from "./imageClassifier";
import { SafetyAlertNotifier } from "./telegramNotifier";

const config = require("../config/config");

// Initialize server
const nms = new NodeMediaServer(config.server);

// Setup directories
const captureDir = path.join(__dirname, config.paths.capturedFrames);
const classificationDir = path.join(
  __dirname,
  config.paths.classificationResults
);

// Create directories if they don't exist
[captureDir, classificationDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// State management
let activeStreams = new Map<string, NodeJS.Timeout>();
let frameCount = 0;

// Initialize services
const imageClassifier = new ImageClassifier();
const safetyAlertNotifier = new SafetyAlertNotifier();

// Set debug mode based on config
setDebugMode(config.logging.level === "debug");

/**
 * Classification Service
 */
class ClassificationService {
  static async classifyImage(imagePath: string): Promise<void> {
    if (!config.classification.enabled) {
      console.log("🤖 Classification disabled in config");
      return;
    }

    console.log(`🤖 Starting classification for: ${path.basename(imagePath)}`);

    try {
      // Use safety-focused prompting if enabled
      const task = config.classification.safetyFocused
        ? SafetyDetectionFilter.generateSafetyPrompt()
        : config.classification.task;

      console.log(
        `🔍 Using ${
          config.classification.safetyFocused ? "safety-focused" : "standard"
        } analysis`
      );

      const classification = await imageClassifier.classifyImage(
        imagePath,
        task
      );

      const resultPath = await saveClassificationResult(
        imagePath,
        classification,
        classificationDir
      );

      const result = {
        success: true,
        classification,
        result_file: resultPath,
        image_file: path.basename(imagePath),
      };

      console.log(`✅ Classification complete for ${result.image_file}:`);
      console.log(`   📝 Result: ${result.classification}`);
      console.log(`   💾 Saved to: ${path.basename(result.result_file)}`);

      SummaryLogger.saveResult(result);

      // Send safety alert if threats detected
      await SafetyAlertService.sendSafetyAlert(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        `❌ Classification failed for ${path.basename(
          imagePath
        )}: ${errorMessage}`
      );

      const result = {
        success: false,
        error: errorMessage,
        image_file: path.basename(imagePath),
      };

      SummaryLogger.saveResult(result);
    }
  }
}

/**
 * Safety Detection and Alert Filter Service
 */
class SafetyDetectionFilter {
  static shouldTriggerAlert(classificationText: string): boolean {
    if (!config.notifications?.triggers?.enabled) {
      return true; // Send alert for all classifications if triggers disabled
    }

    const dangerKeywords = config.notifications.triggers.keywords || [];
    if (dangerKeywords.length === 0) {
      return true; // No danger keywords configured, send all alerts
    }

    const text = classificationText.toLowerCase();
    const requireAll = config.notifications.triggers.requireAll || false;

    if (requireAll) {
      // ALL danger indicators must be present
      return dangerKeywords.every((keyword: string) =>
        text.includes(keyword.toLowerCase())
      );
    } else {
      // ANY danger indicator triggers immediate alert
      return dangerKeywords.some((keyword: string) =>
        text.includes(keyword.toLowerCase())
      );
    }
  }

  static getDetectedThreats(classificationText: string): string[] {
    const dangerKeywords = config.notifications.triggers.keywords || [];
    const text = classificationText.toLowerCase();
    return dangerKeywords.filter((keyword: string) =>
      text.includes(keyword.toLowerCase())
    );
  }

  static assessThreatLevel(
    detectedThreats: string[]
  ): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (detectedThreats.length === 0) return "LOW";

    // Define critical threat keywords
    const criticalThreats = [
      "gun",
      "weapon",
      "fire",
      "explosion",
      "blood",
      "emergency",
    ];
    const hasCriticalThreat = detectedThreats.some((threat) =>
      criticalThreats.some((critical) =>
        threat.toLowerCase().includes(critical)
      )
    );

    if (hasCriticalThreat) return "CRITICAL";
    if (detectedThreats.length >= 3) return "HIGH";
    if (detectedThreats.length >= 2) return "MEDIUM";
    return "LOW";
  }

  static generateSafetyPrompt(): string {
    return "<DETAILED_CAPTION>Describe what you see with focus on safety hazards, weapons, fire, medical emergencies, suspicious activity, or dangerous situations";
  }
}

/**
 * Safety Alert Service
 */
class SafetyAlertService {
  static async sendSafetyAlert(result: any): Promise<void> {
    if (!config.notifications?.enabled) {
      console.log("🚨 Safety alerts disabled in config");
      return;
    }

    // Check if classification indicates a safety threat
    if (!SafetyDetectionFilter.shouldTriggerAlert(result.classification)) {
      console.log(
        `🔍 No safety threats detected - normal situation, no alert needed`
      );
      if (config.logging.level === "debug") {
        console.log(`   📝 Classification: ${result.classification}`);
        console.log(`   ✅ Status: Safe - monitoring continues`);
      }
      return;
    }

    const detectedThreats = SafetyDetectionFilter.getDetectedThreats(
      result.classification
    );
    const threatLevel =
      SafetyDetectionFilter.assessThreatLevel(detectedThreats);

    console.log(`🚨 SAFETY THREAT DETECTED - Level: ${threatLevel}`);
    console.log(`⚠️ Threat indicators: ${detectedThreats.join(", ")}`);

    // Get the full image path from the captured frames directory
    const imagePath = path.join(captureDir, path.basename(result.image_file));

    try {
      const success = await safetyAlertNotifier.sendSafetyAlert({
        image: imagePath,
        message: result.classification,
        severity: threatLevel,
        detectedThreats: detectedThreats,
        timestamp: new Date().toLocaleString(),
        location: "Security Camera Feed", // You can customize this
      });

      if (success) {
        console.log(
          `✅ SAFETY ALERT sent successfully - ${threatLevel} priority`
        );
      } else {
        console.log(`❌ SAFETY ALERT failed to send`);
      }
    } catch (error) {
      console.log(`❌ Failed to send safety alert: ${error}`);
    }
  }
}

/**
 * Summary Logging Service
 */
class SummaryLogger {
  static saveResult(result: any): void {
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
      console.log(`⚠️  Failed to save summary log: ${error}`);
    }
  }
}

/**
 * Frame Capture Service
 */
class FrameCaptureService {
  static captureFrameFromStream(streamPath: string): void {
    frameCount++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `frame-${frameCount}-${timestamp}.jpg`;
    const outputPath = path.join(captureDir, filename);

    console.log(`📸 Capturing frame ${frameCount} from ${streamPath}...`);

    const ffmpegArgs = [
      "-i",
      `rtmp://localhost:1935${streamPath}`,
      "-vframes",
      "1",
      "-f",
      "image2",
      "-q:v",
      config.frameCapture.quality.toString(),
    ];

    // Add resolution limits if configured
    if (config.frameCapture.maxWidth && config.frameCapture.maxHeight) {
      ffmpegArgs.push(
        "-vf",
        `scale='min(${config.frameCapture.maxWidth},iw)':'min(${config.frameCapture.maxHeight},ih)'`
      );
    }

    ffmpegArgs.push("-y", outputPath); // Overwrite output file

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

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

  static _handleCaptureResult(
    code: number | null,
    outputPath: string,
    filename: string
  ): void {
    if (code === 0) {
      console.log(`📸 Frame captured: ${filename}`);

      fs.stat(outputPath, async (err, stats) => {
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

  static _handleFFmpegOutput(data: any): void {
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
  static startFrameCapture(streamPath: string): void {
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

  static stopFrameCapture(streamPath: string): void {
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
  static cleanupOldFiles(): void {
    if (!config.cleanup.enabled) return;

    console.log("🧹 Running file cleanup...");
    this._cleanupFrames();
    this._cleanupClassificationResults();
  }

  static _cleanupFrames(): void {
    fs.readdir(captureDir, (err, files) => {
      if (err) return;

      const frameFiles = files
        .filter((f) => f.startsWith("frame-"))
        .map((f) => ({
          name: f,
          path: path.join(captureDir, f),
          time: fs.statSync(path.join(captureDir, f)).mtime,
        }))
        .sort((a, b) => a.time.getTime() - b.time.getTime());

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
            console.log(`⚠️  Failed to delete ${file.name}: ${error}`);
          }
        });
      }
    });
  }

  static _cleanupClassificationResults(): void {
    fs.readdir(classificationDir, (err, files) => {
      if (err) return;

      const jsonFiles = files
        .filter((f) => f.endsWith("_classification.json"))
        .map((f) => ({
          name: f,
          path: path.join(classificationDir, f),
          time: fs.statSync(path.join(classificationDir, f)).mtime,
        }))
        .sort((a, b) => a.time.getTime() - b.time.getTime());

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
            console.log(`⚠️  Failed to delete ${file.name}: ${error}`);
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
  static setupEventListeners(): void {
    nms.on("preConnect", (id: string, args: any) => {
      if (config.logging.level === "debug") {
        console.log(`[preConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("postConnect", (id: string, args: any) => {
      if (config.logging.level === "debug") {
        console.log(`[postConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("doneConnect", (id: string, args: any) => {
      if (config.logging.level === "debug") {
        console.log(`[doneConnect] id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("prePublish", (id: string, StreamPath: string, args: any) => {
      console.log(`[prePublish] Stream: ${StreamPath}`);
      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("postPublish", (id: string, StreamPath: string, args: any) => {
      console.log(`[postPublish] Stream started: ${StreamPath}`);
      StreamManagementService.startFrameCapture(StreamPath);

      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("donePublish", (id: string, StreamPath: string, args: any) => {
      console.log(`[donePublish] Stream ended: ${StreamPath}`);
      StreamManagementService.stopFrameCapture(StreamPath);

      if (config.logging.level === "debug") {
        console.log(`  Details: id=${id} args=${JSON.stringify(args)}`);
      }
    });

    nms.on("prePlay", (id: string, StreamPath: string, args: any) => {
      if (config.logging.level === "debug") {
        console.log(
          `[prePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(
            args
          )}`
        );
      }
    });

    nms.on("postPlay", (id: string, StreamPath: string, args: any) => {
      if (config.logging.level === "debug") {
        console.log(
          `[postPlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(
            args
          )}`
        );
      }
    });

    nms.on("donePlay", (id: string, StreamPath: string, args: any) => {
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
function startServer(): void {
  // Setup event listeners
  EventHandlers.setupEventListeners();

  // Start the RTMP server
  nms.run();

  // Display startup information
  console.log(
    "🚀 SAFETY MONITORING SYSTEM - RTMP Server with AI Threat Detection started!"
  );
  console.log(`📡 RTMP Port: ${config.server.rtmp.port}`);
  console.log(`🌐 HTTP Port: ${config.server.http.port}`);
  console.log(
    `📸 Frame Capture: ${
      config.frameCapture.captureIntervalMs / 1000
    }s intervals`
  );
  console.log(
    `🔍 AI Safety Analysis: ${
      config.classification.enabled ? "ACTIVE" : "DISABLED"
    }`
  );
  console.log(
    `🚨 Safety Alerts: ${
      config.notifications?.enabled ? "ENABLED" : "DISABLED"
    }`
  );
  if (
    config.notifications?.enabled &&
    config.notifications?.triggers?.enabled
  ) {
    const dangerKeywords = config.notifications.triggers.keywords || [];
    console.log(
      `⚠️ Threat Detection Keywords: ${
        dangerKeywords.length > 0
          ? dangerKeywords.slice(0, 5).join(", ") +
            (dangerKeywords.length > 5 ? "..." : "")
          : "None configured"
      }`
    );
    console.log(
      `🎯 Alert Trigger Mode: ${
        config.notifications.triggers.requireAll
          ? "ALL indicators required"
          : "ANY threat triggers alert"
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
    "🔍 AI SAFETY MONITORING: Continuously analyzing video feed for threats!"
  );
  console.log(
    "📊 Analysis results saved to JSON files in classification_results directory"
  );
  console.log(
    "📈 Safety log: classification_results/classification_summary.jsonl"
  );
  if (config.notifications?.enabled) {
    if (
      config.notifications?.triggers?.enabled &&
      config.notifications.triggers.keywords?.length > 0
    ) {
      console.log(
        "🚨 SAFETY ALERTS will be sent to Telegram when dangerous situations are detected!"
      );
    } else {
      console.log(
        "🚨 SAFETY ALERTS will be sent to Telegram for all detected situations!"
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
