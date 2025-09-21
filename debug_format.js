#!/usr/bin/env node

/**
 * Quick API Format Debug Script
 * Tests minimal requests to find what works
 */

const fetch = require("node-fetch");
const config = require("./config/config.js");

async function testMinimalRequests() {
  console.log("🐛 DEBUGGING API FORMAT 🐛\n");

  const tests = [
    {
      name: "Test 1: Simple text only",
      payload: {
        messages: [
          {
            role: "user",
            content: "<CAPTION>Hello",
          },
        ],
      },
    },
    {
      name: "Test 2: DETAILED_CAPTION text only",
      payload: {
        messages: [
          {
            role: "user",
            content: "<DETAILED_CAPTION>Describe this scene",
          },
        ],
      },
    },
    {
      name: "Test 3: Simple image (tiny 1x1 pixel)",
      payload: {
        messages: [
          {
            role: "user",
            content:
              '<CAPTION><img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A8A8A8A8A8A8A8A8A8A==" />',
          },
        ],
      },
    },
  ];

  for (const test of tests) {
    console.log(`\n🧪 ${test.name}`);
    console.log(`Payload size: ${JSON.stringify(test.payload).length} bytes`);

    try {
      const response = await fetch(config.nvidia.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.nvidia.apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify(test.payload),
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const result = await response.json();
        console.log(
          `✅ SUCCESS: ${result.choices[0].message.content.substring(0, 50)}...`
        );
      } else {
        const errorText = await response.text();
        console.log(`❌ ERROR: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ EXCEPTION: ${error.message}`);
    }

    // Wait 1 second between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n🏁 Format debugging complete!");
}

testMinimalRequests().catch(console.error);
