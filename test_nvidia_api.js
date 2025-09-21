#!/usr/bin/env node

/**
 * NVIDIA API Connection Test
 * Tests your API key and connection to NVIDIA's Florence-2 service
 */

const fetch = require("node-fetch");
const fs = require("fs");
const config = require("./config/config.js");

async function testNvidiaAPI() {
  console.log("🧪 TESTING NVIDIA API CONNECTION 🧪\n");

  // Check config
  console.log("📋 Configuration Check:");
  console.log(
    `  API Key: ${config.nvidia.apiKey ? "✅ Present" : "❌ Missing"}`
  );
  console.log(`  API URL: ${config.nvidia.apiUrl}`);
  console.log(`  Key Length: ${config.nvidia.apiKey.length} characters\n`);

  if (!config.nvidia.apiKey) {
    console.log("❌ No API key found in config.js");
    return;
  }

  // Test 1: Simple text request (no image)
  console.log("🔍 Test 1: Simple API connectivity test (no image)...");
  try {
    const simpleRequest = {
      messages: [
        {
          role: "user",
          content:
            "<CAPTION>Test connection - please respond with 'API connection successful'",
        },
      ],
    };

    const response = await fetch(config.nvidia.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.nvidia.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(simpleRequest),
    });

    console.log(`  Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`  Response: ✅ ${result.choices[0].message.content}\n`);
    } else {
      const errorText = await response.text();
      console.log(`  Error: ❌ ${errorText}\n`);
    }
  } catch (error) {
    console.log(`  Connection Error: ❌ ${error.message}\n`);
  }

  // Test 2: Check captured frames directory
  console.log("📁 Test 2: Checking for captured frames...");
  const captureDir = "./data/captured_frames";
  try {
    if (fs.existsSync(captureDir)) {
      const files = fs.readdirSync(captureDir);
      const imageFiles = files.filter(
        (f) => f.endsWith(".jpg") || f.endsWith(".png")
      );
      console.log(`  Found ${imageFiles.length} image files in ${captureDir}`);

      if (imageFiles.length > 0) {
        const testImage = imageFiles[0];
        const imagePath = `${captureDir}/${testImage}`;
        const stats = fs.statSync(imagePath);
        console.log(
          `  Test image: ${testImage} (${Math.round(stats.size / 1024)}KB)`
        );

        // Test 3: Try classifying a real captured frame
        if (stats.size < 5 * 1024 * 1024) {
          // Less than 5MB
          console.log(
            "\n🖼️  Test 3: Testing image classification with captured frame..."
          );
          await testImageClassification(imagePath);
        } else {
          console.log(
            `  ⚠️  Image too large (${Math.round(
              stats.size / 1024 / 1024
            )}MB), skipping classification test`
          );
        }
      } else {
        console.log(
          "  ⚠️  No captured frames found. Start the server and stream to generate test images."
        );
      }
    } else {
      console.log(`  ⚠️  Capture directory not found: ${captureDir}`);
    }
  } catch (error) {
    console.log(`  Error reading directory: ❌ ${error.message}`);
  }

  console.log("\n🏁 API testing complete!");
}

async function testImageClassification(imagePath) {
  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const fileSizeKB = Math.round(imageBuffer.length / 1024);

    console.log(`  Image size: ${fileSizeKB}KB`);

    if (fileSizeKB > 1024) {
      // Larger than 1MB
      console.log("  ⚠️  Image quite large, this might cause issues...");
    }

    // Use simple string format that works with NVIDIA Florence-2 API
    const content = `<DETAILED_CAPTION><img src="data:image/jpeg;base64,${base64Image}" />`;
    const inputs = {
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
    };

    const payloadSizeKB = Math.round(JSON.stringify(inputs).length / 1024);
    console.log(`  Total payload size: ${payloadSizeKB}KB`);

    const response = await fetch(config.nvidia.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.nvidia.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(inputs),
    });

    console.log(
      `  Classification Status: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const result = await response.json();
      const classification = result.choices[0].message.content;
      console.log(`  Result: ✅ ${classification.substring(0, 100)}...`);
    } else {
      const errorText = await response.text();
      console.log(
        `  Classification Error: ❌ ${response.status} - ${errorText}`
      );

      // Specific advice based on error
      if (response.status === 413) {
        console.log("  💡 Solution: Reduce frame capture quality in config.js");
      } else if (response.status === 501) {
        console.log(
          "  💡 Solution: Your API plan may not support image analysis"
        );
      }
    }
  } catch (error) {
    console.log(`  Classification Exception: ❌ ${error.message}`);
  }
}

// Run the test
testNvidiaAPI().catch(console.error);
