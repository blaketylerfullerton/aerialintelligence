#!/usr/bin/env node

/**
 * AI Image Classification Service
 * Classifies images using NVIDIA's Florence-2 model
 */

import fs from "fs/promises";
import path from "path";
import { createReadStream, existsSync, statSync } from "fs";
import { lookup } from "mime-types";
import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import AdmZip from "adm-zip";

// Types
interface ClassificationResult {
  success: boolean;
  classification?: string;
  result_file?: string;
  image_file?: string;
  error?: string;
  error_type?: string;
}

interface AssetUploadResponse {
  assetId: string;
  uploadUrl: string;
}

interface ClassificationResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ResultData {
  timestamp: string;
  image_file: string;
  image_path: string;
  classification: string;
  processed_at: string;
}

// Configuration
let API_KEY: string;
let NVAi_URL: string;
let ASSET_UPLOAD_URL: string;

try {
  // Try to load from config file
  const config = require("./config.js");
  API_KEY = config.nvidia.apiKey;
  NVAi_URL = config.nvidia.apiUrl;
  ASSET_UPLOAD_URL = config.nvidia.assetUploadUrl;
} catch (error) {
  console.error(
    "Failed to load config.js:",
    error instanceof Error ? error.message : String(error)
  );
  // Fallback to environment variables
  API_KEY = process.env.NVIDIA_API_KEY || "";
  NVAi_URL = "https://ai.api.nvidia.com/v1/vlm/microsoft/florence-2";
  ASSET_UPLOAD_URL = "https://api.nvcf.nvidia.com/v2/nvcf/assets";
}

if (!API_KEY) {
  throw new Error(
    "API_KEY must be set in config.js or as NVIDIA_API_KEY environment variable"
  );
}

// Global debug flag
let DEBUG_MODE = true; // Enable debug for troubleshooting

function debugPrint(message: string): void {
  if (DEBUG_MODE) {
    console.log(message);
  }
}

export class ImageClassifier {
  private apiKey: string;
  private apiUrl: string;
  private assetUploadUrl: string;
  private headerAuth: string;

  constructor(apiKey?: string, apiUrl?: string, assetUploadUrl?: string) {
    this.apiKey = apiKey || API_KEY;
    this.apiUrl = apiUrl || NVAi_URL;
    this.assetUploadUrl = assetUploadUrl || ASSET_UPLOAD_URL;
    this.headerAuth = `Bearer ${this.apiKey}`;
  }

  /**
   * Upload image asset to NVIDIA's service
   */
  async uploadAsset(
    imagePath: string,
    description = "Test Image"
  ): Promise<string> {
    debugPrint(`DEBUG: Starting asset upload for ${imagePath}`);

    let contentType = lookup(imagePath) || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      contentType = "image/jpeg";
    }
    debugPrint(`DEBUG: Content type: ${contentType}`);

    try {
      debugPrint("DEBUG: Sending authorization request...");
      debugPrint(`DEBUG: Using asset upload URL: ${this.assetUploadUrl}`);
      debugPrint(
        `DEBUG: Request headers: ${JSON.stringify({
          Authorization: "Bearer [REDACTED]",
          "Content-Type": "application/json",
          accept: "application/json",
        })}`
      );
      debugPrint(
        `DEBUG: Request body: ${JSON.stringify({
          contentType,
          description,
        })}`
      );

      const authorizeResponse = await fetch(this.assetUploadUrl, {
        method: "POST",
        headers: {
          Authorization: this.headerAuth,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          contentType,
          description,
        }),
      });

      debugPrint(
        `DEBUG: Authorization response status: ${authorizeResponse.status}`
      );
      debugPrint(
        `DEBUG: Authorization response headers: ${JSON.stringify(
          Object.fromEntries(authorizeResponse.headers.entries())
        )}`
      );

      if (!authorizeResponse.ok) {
        const responseText = await authorizeResponse.text();
        debugPrint(`DEBUG: Authorization error response body: ${responseText}`);
        throw new Error(
          `Authorization failed: ${authorizeResponse.status} ${authorizeResponse.statusText}. Response: ${responseText}`
        );
      }

      const authResponse =
        (await authorizeResponse.json()) as AssetUploadResponse;
      debugPrint(
        `DEBUG: Authorization response keys: ${Object.keys(authResponse)}`
      );

      const uploadUrl = authResponse.uploadUrl;
      debugPrint(
        `DEBUG: Upload URL obtained: ${uploadUrl.substring(0, 50)}...`
      );

      debugPrint("DEBUG: Uploading file...");

      const fileStream = createReadStream(imagePath);
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fileStream,
        headers: {
          "x-amz-meta-nvcf-asset-description": description,
          "content-type": contentType,
        },
      });

      debugPrint(`DEBUG: Upload response status: ${uploadResponse.status}`);

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      const assetId = authResponse.assetId;
      debugPrint(`DEBUG: Asset uploaded successfully, ID: ${assetId}`);
      return assetId;
    } catch (error) {
      debugPrint(`DEBUG: Request exception during upload: ${error}`);
      throw new Error(`Failed to upload asset: ${error}`);
    }
  }

  /**
   * Classify an image and return the result
   */
  async classifyImage(imagePath: string, task = "<CAPTION>"): Promise<string> {
    try {
      debugPrint(
        `DEBUG: Starting classification for ${imagePath} with task ${task}`
      );

      // Try direct base64 approach first
      try {
        return await this.classifyImageDirect(imagePath, task);
      } catch (directError) {
        debugPrint(
          `DEBUG: Direct method failed, trying asset upload: ${directError}`
        );
        // Fall back to asset upload method
        const assetId = await this.uploadAsset(imagePath);
        const content = `${task}<img src="data:image/jpeg;asset_id,${assetId}" />`;
        const inputs = {
          messages: [
            {
              role: "user",
              content,
            },
          ],
        };

        debugPrint(
          "DEBUG: Classification input prepared (asset upload method)"
        );
        return await this.sendClassificationRequest(inputs, assetId);
      }
    } catch (error) {
      debugPrint(`DEBUG: Classification exception: ${error}`);
      throw new Error(`Classification failed: ${error}`);
    }
  }

  /**
   * Classify image using direct base64 encoding
   */
  async classifyImageDirect(
    imagePath: string,
    task = "<CAPTION>"
  ): Promise<string> {
    debugPrint(`DEBUG: Trying direct base64 method for ${imagePath}`);

    // Read and encode image as base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine content type
    let contentType = lookup(imagePath) || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      contentType = "image/jpeg";
    }

    const content = `${task}<img src="data:${contentType};base64,${base64Image}" />`;
    const inputs = {
      messages: [
        {
          role: "user",
          content,
        },
      ],
    };

    debugPrint("DEBUG: Classification input prepared (direct base64 method)");
    return await this.sendClassificationRequest(inputs);
  }

  /**
   * Send classification request to API
   */
  async sendClassificationRequest(
    inputs: any,
    assetId?: string
  ): Promise<string> {
    const headers: any = {
      "Content-Type": "application/json",
      Authorization: this.headerAuth,
      Accept: "application/json",
    };

    // Only add asset headers if we have an assetId (for asset upload method)
    if (assetId) {
      headers["NVCF-INPUT-ASSET-REFERENCES"] = assetId;
      headers["NVCF-FUNCTION-ASSET-IDS"] = assetId;
    }

    debugPrint(`DEBUG: Sending classification request to ${this.apiUrl}`);

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(inputs),
    });

    debugPrint(`DEBUG: Classification response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      debugPrint(`DEBUG: Classification error response: ${errorText}`);
      throw new Error(
        `Classification request failed: ${response.status} ${response.statusText}. Response: ${errorText}`
      );
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() || "";
    debugPrint(`DEBUG: Response content type: ${contentType}`);

    if (contentType.includes("application/json")) {
      const result = (await response.json()) as ClassificationResponse;
      debugPrint("DEBUG: JSON response received");
      return result.choices[0].message.content;
    } else if (contentType.includes("application/zip")) {
      debugPrint("DEBUG: ZIP response received, extracting...");
      const buffer = await response.buffer();
      return this.extractZipResponse(buffer);
    } else {
      debugPrint(`DEBUG: Unknown response format: ${contentType}`);
      return "Classification failed - unknown response format";
    }
  }

  /**
   * Extract classification result from ZIP response
   */
  private extractZipResponse(zipBuffer: Buffer): string {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      const responseEntry = entries.find((entry) =>
        entry.entryName.endsWith(".response")
      );

      if (responseEntry) {
        const jsonContent = JSON.parse(
          responseEntry.getData().toString("utf8")
        );
        let content = jsonContent.choices[0].message.content;

        if (content.startsWith("<CAPTION>")) {
          content = content.substring(9);
        }

        return content;
      }

      return "Classification failed - could not extract result from ZIP";
    } catch (error) {
      return `Classification failed - ZIP extraction error: ${error}`;
    }
  }
}

/**
 * Save classification result to JSON file
 */
export async function saveClassificationResult(
  imagePath: string,
  classificationResult: string,
  outputDir: string
): Promise<string> {
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const imageFilename = path.basename(imagePath);
  const timestamp = new Date().toISOString();

  const resultData: ResultData = {
    timestamp,
    image_file: imageFilename,
    image_path: imagePath,
    classification: classificationResult,
    processed_at: timestamp,
  };

  const baseName = path.parse(imageFilename).name;
  const jsonFilename = `${baseName}_classification.json`;
  const jsonPath = path.join(outputDir, jsonFilename);

  await fs.writeFile(jsonPath, JSON.stringify(resultData, null, 2), "utf8");

  return jsonPath;
}

/**
 * Main function for command-line usage
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: node imageClassifier.js <image_path> <output_dir> [--task <task>] [--debug]"
    );
    process.exit(1);
  }

  const imagePath = args[0];
  const outputDir = args[1];
  let task = "<CAPTION>";

  // Parse optional arguments
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--task" && i + 1 < args.length) {
      task = args[i + 1];
      i++;
    } else if (args[i] === "--debug") {
      DEBUG_MODE = true;
    }
  }

  try {
    // Debug logging
    debugPrint(
      `DEBUG: TypeScript script started with args: ${JSON.stringify(args)}`
    );
    debugPrint(`DEBUG: Current working directory: ${process.cwd()}`);
    debugPrint(`DEBUG: Node version: ${process.version}`);
    debugPrint(`DEBUG: Image path: ${imagePath}`);
    debugPrint(`DEBUG: Output directory: ${outputDir}`);

    // Check API key
    if (!API_KEY) {
      throw new Error(
        "API_KEY is not set. Check config.js or environment variables."
      );
    }
    debugPrint(`DEBUG: API key is present (length: ${API_KEY.length})`);

    // Validate inputs
    if (!existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Check file size
    const stats = statSync(imagePath);
    const fileSize = stats.size;
    debugPrint(`DEBUG: Image file size: ${fileSize} bytes`);

    if (fileSize === 0) {
      throw new Error("Image file is empty");
    }

    // Initialize classifier and process image
    debugPrint("DEBUG: Initializing classifier...");
    const classifier = new ImageClassifier();

    debugPrint("DEBUG: Starting classification...");
    const classification = await classifier.classifyImage(imagePath, task);
    debugPrint(
      `DEBUG: Classification completed: ${classification.substring(0, 100)}...`
    );

    const resultPath = await saveClassificationResult(
      imagePath,
      classification,
      outputDir
    );
    debugPrint(`DEBUG: Result saved to: ${resultPath}`);

    // Output result as JSON for Node.js to parse
    const result: ClassificationResult = {
      success: true,
      classification,
      result_file: resultPath,
      image_file: path.basename(imagePath),
    };

    console.log("CLASSIFICATION_RESULT:" + JSON.stringify(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType =
      error instanceof Error ? error.constructor.name : "Unknown";

    console.error(`ERROR: ${errorMessage}`);
    console.error(`ERROR: Exception type: ${errorType}`);
    console.error(
      `ERROR: Stack trace:\n${
        error instanceof Error ? error.stack : "No stack trace available"
      }`
    );

    const result: ClassificationResult = {
      success: false,
      error: errorMessage,
      error_type: errorType,
      image_file: existsSync(imagePath) ? path.basename(imagePath) : "unknown",
    };

    console.log("CLASSIFICATION_RESULT:" + JSON.stringify(result));
    process.exit(1);
  }
}

// Set debug mode for module usage
export function setDebugMode(enabled: boolean): void {
  DEBUG_MODE = enabled;
}

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
