#!/usr/bin/env node

/**
 * Telegram Notification Service
 * Sends messages and photos to Telegram using Bot API
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

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;

  constructor(botToken?: string, chatId?: string) {
    this.botToken = botToken || BOT_TOKEN || "";
    this.chatId = chatId || CHAT_ID || "";
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
   * Send notification with optional image
   */
  async sendNotification(options: NotificationOptions): Promise<boolean> {
    console.log("📱 Starting Telegram notification...");
    console.log(`🔧 Message: ${options.message.substring(0, 50)}...`);
    console.log(`📷 Image path: ${options.image || "none"}`);

    // Try to send photo with caption if image path is provided
    if (options.image && existsSync(options.image)) {
      console.log(`📷 Sending photo: ${options.image}`);
      const success = await this.sendPhoto(options.image, options.message);

      if (!success) {
        console.log("📝 Falling back to text message...");
        return await this.sendMessage(options.message);
      }

      return true;
    } else {
      if (options.image) {
        console.log(`⚠️ Image file not found: ${options.image}`);
      }
      console.log("📝 Sending text message (no valid image provided)");
      return await this.sendMessage(options.message);
    }
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
    const notifier = new TelegramNotifier();
    await notifier.sendNotification({ image: imagePath, message });
  } catch (error) {
    console.error("Failed to send notification:", error);
    process.exit(1);
  }
}

// Create default instance for easy importing
export const telegramNotifier = new TelegramNotifier();

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
