#!/usr/bin/env node

/**
 * Safety Alert System Test Script
 * Demonstrates the new safety monitoring capabilities
 */

const { SafetyAlertNotifier } = require("./src/telegramNotifier");

async function testSafetyAlerts() {
  console.log("🚨 TESTING SAFETY ALERT SYSTEM 🚨\n");

  const notifier = new SafetyAlertNotifier();

  // Test different severity levels
  const testScenarios = [
    {
      name: "🔔 LOW Priority Test",
      options: {
        message: "Person walking in restricted area during off hours",
        severity: "LOW",
        detectedThreats: ["trespassing"],
        location: "Building Entrance Camera",
        timestamp: new Date().toLocaleString(),
      },
    },
    {
      name: "⚡ MEDIUM Priority Test",
      options: {
        message:
          "Suspicious person with bag near building entrance, attempting to access locked door",
        severity: "MEDIUM",
        detectedThreats: ["suspicious person", "break-in"],
        location: "Main Entrance Security Camera",
        timestamp: new Date().toLocaleString(),
      },
    },
    {
      name: "⚠️ HIGH Priority Test",
      options: {
        message:
          "Smoke detected in server room, possible fire hazard, person appears unconscious on floor",
        severity: "HIGH",
        detectedThreats: ["fire", "smoke", "unconscious", "emergency"],
        location: "Server Room Camera",
        timestamp: new Date().toLocaleString(),
      },
    },
    {
      name: "🚨 CRITICAL Priority Test",
      options: {
        message:
          "Armed intruder with weapon in lobby, threatening security guard, immediate police response required",
        severity: "CRITICAL",
        detectedThreats: ["gun", "weapon", "intruder", "violence", "emergency"],
        location: "Main Lobby Camera",
        timestamp: new Date().toLocaleString(),
      },
    },
  ];

  for (const scenario of testScenarios) {
    console.log(`Testing: ${scenario.name}`);
    console.log(`Threats: ${scenario.options.detectedThreats.join(", ")}`);

    try {
      const success = await notifier.sendSafetyAlert(scenario.options);
      console.log(`Result: ${success ? "✅ SUCCESS" : "❌ FAILED"}\n`);

      // Wait 2 seconds between tests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`Result: ❌ ERROR - ${error.message}\n`);
    }
  }

  console.log("🏁 Safety alert testing complete!");
}

// Run the test
testSafetyAlerts().catch(console.error);
