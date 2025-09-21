#!/usr/bin/env node

/**
 * Safety Alert Telegram Service
 * Sends urgent safety alerts and danger notifications to Telegram using Bot API
 * Designed for real-time security monitoring and emergency response
 */

import { createReadStream, existsSync } from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

// Types
interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
}

interface SafetyAlertOptions {
  image?: string;
  message: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detectedThreats?: string[];
  timestamp?: string;
  location?: string;
}

interface NotificationOptions {
  image?: string;
  message: string;
}

// Configuration
let BOT_TOKEN = "";
let CHAT_ID = "";
let notificationsEnabled = true;

// Load config
try {
  const config = require("../config/config.js");
  BOT_TOKEN = config.notifications?.botToken || "";
  CHAT_ID = config.notifications?.chatId || "";
  notificationsEnabled = config.notifications?.enabled !== false;
} catch (error) {
  console.warn("Could not load config file, assuming notifications enabled");
}

// Only throw error if notifications are enabled and tokens are missing
if (notificationsEnabled && (!BOT_TOKEN || !CHAT_ID)) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables must be set when notifications are enabled"
  );
}

export class SafetyAlertNotifier {
  private botToken: string;
  private chatId: string;

  constructor(botToken?: string, chatId?: string) {
    this.botToken = botToken || BOT_TOKEN || "";
    this.chatId = chatId || CHAT_ID || "";
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case "CRITICAL":
        return "🚨";
      case "HIGH":
        return "⚠️";
      case "MEDIUM":
        return "⚡";
      case "LOW":
        return "🔔";
      default:
        return "📢";
    }
  }

  /**
   * Format safety alert message with proper urgency indicators
   */
  private formatSafetyAlert(options: SafetyAlertOptions): string {
    const severity = options.severity || "MEDIUM";
    const emoji = this.getSeverityEmoji(severity);
    const timestamp = options.timestamp || new Date().toLocaleString();

    let alert = `${emoji} SAFETY ALERT - ${severity} PRIORITY ${emoji}\n\n`;
    alert += `⏰ Time: ${timestamp}\n`;

    alert += `\n🔍 DETECTED SITUATION:\n${options.message}\n`;

    if (options.detectedThreats && options.detectedThreats.length > 0) {
      alert += `\n⚠️ THREAT INDICATORS:\n`;
      options.detectedThreats.forEach((threat) => {
        alert += `• ${threat}\n`;
      });
    }

    alert += `\n📱 This is an automated safety monitoring alert.`;

    if (severity === "HIGH" || severity === "CRITICAL") {
      alert += `\n🚨 IMMEDIATE ATTENTION REQUIRED 🚨`;
    }

    return alert;
  }

  /**
   * Send photo with caption to Telegram
   */
  async sendPhoto(imagePath: string, caption: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

    try {
      if (!existsSync(imagePath)) {
        console.log(`Image file not found: ${imagePath} ❌`);
        return false;
      }

      const form = new FormData();
      form.append("chat_id", this.chatId);
      form.append("caption", caption);
      form.append("photo", createReadStream(imagePath));

      const response = await fetch(url, {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      });

      const result = (await response.json()) as TelegramResponse;

      if (response.ok && result.ok) {
        console.log("Photo sent successfully ✅");
        return true;
      } else {
        console.log(
          `Failed to send photo ❌: ${result.description || "Unknown error"}`
        );
        return false;
      }
    } catch (error) {
      console.log(`Error sending photo ❌: ${error}`);
      return false;
    }
  }

  /**
   * Send text message to Telegram
   */
  async sendMessage(text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
        }),
      });

      const result = (await response.json()) as TelegramResponse;

      if (response.ok && result.ok) {
        console.log("Message sent successfully ✅");
        return true;
      } else {
        console.log(
          `Failed to send message ❌: ${result.description || "Unknown error"}`
        );
        return false;
      }
    } catch (error) {
      console.log(`Error sending message ❌: ${error}`);
      return false;
    }
  }

  /**
   * Send safety alert with optional image
   */
  async sendSafetyAlert(options: SafetyAlertOptions): Promise<boolean> {
    const severity = options.severity || "MEDIUM";
    const emoji = this.getSeverityEmoji(severity);

    console.log(`${emoji} SENDING SAFETY ALERT - ${severity} PRIORITY`);
    console.log(`🔍 Threat: ${options.message.substring(0, 50)}...`);
    console.log(`📷 Evidence: ${options.image || "none"}`);

    const alertMessage = this.formatSafetyAlert(options);

    // Try to send photo with alert caption if image path is provided
    if (options.image && existsSync(options.image)) {
      console.log(`📷 Sending evidence photo: ${options.image}`);
      const success = await this.sendPhoto(options.image, alertMessage);

      if (!success) {
        console.log("📝 Photo failed, sending text alert...");
        return await this.sendMessage(alertMessage);
      }

      return true;
    } else {
      if (options.image) {
        console.log(`⚠️ Evidence file not found: ${options.image}`);
      }
      console.log("📝 Sending text safety alert (no evidence photo)");
      return await this.sendMessage(alertMessage);
    }
  }

  /**
   * Send notification with optional image (legacy method for compatibility)
   */
  async sendNotification(options: NotificationOptions): Promise<boolean> {
    // Convert to safety alert format
    const safetyOptions: SafetyAlertOptions = {
      image: options.image,
      message: options.message,
      severity: "MEDIUM",
      timestamp: new Date().toLocaleString(),
    };

    return await this.sendSafetyAlert(safetyOptions);
  }
}

/**
 * Main function for command-line usage
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let imagePath: string | undefined;
  let message = "Hello Blake! 🚀 This came from command line arguments.";

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--image" && i + 1 < args.length) {
      imagePath = args[i + 1];
      i++;
    } else if (args[i] === "--message" && i + 1 < args.length) {
      message = args[i + 1];
      i++;
    }
  }

  try {
    const notifier = new SafetyAlertNotifier();
    await notifier.sendSafetyAlert({
      image: imagePath,
      message,
      severity: "MEDIUM",
      timestamp: new Date().toLocaleString(),
    });
  } catch (error) {
    console.error("Failed to send safety alert:", error);
    process.exit(1);
  }
}

// Create default instance for easy importing
export const safetyAlertNotifier = new SafetyAlertNotifier();

// Legacy export for backward compatibility
export const telegramNotifier = safetyAlertNotifier;
export const TelegramNotifier = SafetyAlertNotifier;

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
