#!/usr/bin/env node

/**
 * Intelligent Threat Detection Test Script
 * Tests the new AI-powered security system with various scenarios
 */

const { ThreatDetector } = require("./src/threatDetector");

async function testThreatDetection() {
  console.log("🧪 TESTING AI THREAT DETECTION SYSTEM 🧪\n");

  const detector = new ThreatDetector({
    notificationThreshold: 3, // MEDIUM and above
    detailedAnalysis: false,  // Disable for faster testing
    timeBasedAnalysis: false
  });

  // Test scenarios with different threat levels
  const testScenarios = [
    {
      name: "Normal Activity",
      classification: "A person in uniform walking through a well-lit parking lot during daytime, carrying maintenance tools and wearing an employee badge.",
      expectedLevel: "NONE"
    },
    {
      name: "Suspicious Loitering",
      classification: "A person in dark clothing standing near a building entrance at night, looking around frequently and checking their phone.",
      expectedLevel: "MEDIUM"
    },
    {
      name: "Potential Break-in",
      classification: "A masked individual climbing over a fence in a restricted area, carrying a backpack and moving stealthily in the shadows.",
      expectedLevel: "HIGH"
    },
    {
      name: "Critical Threat - Weapon",
      classification: "A person with a gun approaching the building, wearing dark clothing and moving aggressively toward the main entrance.",
      expectedLevel: "CRITICAL"
    },
    {
      name: "Property Damage",
      classification: "Someone breaking windows of a parked car with a metal object, glass scattered on the ground, vandalism in progress.",
      expectedLevel: "CRITICAL"
    },
    {
      name: "Authorized Delivery",
      classification: "A delivery person in company uniform at the front door during business hours, carrying packages and showing identification.",
      expectedLevel: "NONE"
    },
    {
      name: "Unusual Vehicle",
      classification: "A van parked in an unusual location with no visible driver, engine running, positioned near the building exit.",
      expectedLevel: "MEDIUM"
    },
    {
      name: "Multiple Suspicious Persons",
      classification: "Three people in hoodies lurking near the building at 2 AM, one watching for security while others examine door locks.",
      expectedLevel: "HIGH"
    }
  ];

  console.log("🎯 Running threat detection tests...\n");

  for (const scenario of testScenarios) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`📝 Scenario: ${scenario.classification.substring(0, 80)}...`);
    
    // Create mock classification result
    const mockResult = {
      classification: scenario.classification,
      image_file: `test_${scenario.name.toLowerCase().replace(/\s+/g, '_')}.jpg`,
      timestamp: new Date().toISOString()
    };

    try {
      const analysis = await detector.analyzeThreat(mockResult);
      
      // Display results
      console.log(`📊 Result:`);
      console.log(`   🚨 Threat Level: ${analysis.threat_level} (Expected: ${scenario.expectedLevel})`);
      console.log(`   🎯 Score: ${analysis.threat_score}/5`);
      console.log(`   💯 Confidence: ${analysis.confidence}%`);
      console.log(`   🚨 Would Notify: ${analysis.threat_detected ? 'YES' : 'NO'}`);
      console.log(`   🎬 Action: ${analysis.recommended_action}`);
      
      if (analysis.threat_reasons.length > 0) {
        console.log(`   📝 Reasons:`);
        analysis.threat_reasons.slice(0, 3).forEach(reason => {
          console.log(`      • ${reason}`);
        });
      }
      
      // Check if result matches expectation
      const isCorrect = analysis.threat_level === scenario.expectedLevel;
      console.log(`   ${isCorrect ? '✅' : '⚠️'} Assessment: ${isCorrect ? 'CORRECT' : 'DIFFERENT THAN EXPECTED'}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log(""); // Empty line for readability
  }

  console.log("🏁 Threat detection testing complete!");
  console.log("\n📊 SUMMARY:");
  console.log("• NONE/LOW: Normal activity, no alerts");
  console.log("• MEDIUM: Potential concern, monitor situation");  
  console.log("• HIGH: Suspicious activity, investigate immediately");
  console.log("• CRITICAL: Immediate danger, emergency response");
  console.log("\n💡 TIP: Adjust notificationThreshold in config to control sensitivity");
  console.log("   - Threshold 2: Alert on LOW and above (more sensitive)");
  console.log("   - Threshold 3: Alert on MEDIUM and above (balanced)");
  console.log("   - Threshold 4: Alert on HIGH and above (less sensitive)");
}

// Additional function to test with real image (if available)
async function testWithRealImage(imagePath) {
  if (!imagePath) {
    console.log("\n💡 To test with a real image, run:");
    console.log("   node test_threat_detection.js path/to/your/image.jpg");
    return;
  }

  const fs = require("fs");
  const path = require("path");

  if (!fs.existsSync(imagePath)) {
    console.log(`❌ Image not found: ${imagePath}`);
    return;
  }

  console.log(`\n🖼️ Testing with real image: ${path.basename(imagePath)}`);
  
  try {
    // First, get AI classification of the image
    const { ImageClassifier } = require("./src/imageClassifier");
    const classifier = new ImageClassifier();
    
    console.log("🤖 Getting AI classification...");
    const classification = await classifier.classifyImage(imagePath, "<DETAILED_CAPTION>");
    
    console.log(`📝 AI Classification: ${classification.substring(0, 150)}...`);
    
    // Then analyze for threats
    const detector = new ThreatDetector();
    const mockResult = {
      classification: classification,
      image_file: path.basename(imagePath),
      timestamp: new Date().toISOString()
    };
    
    console.log("🔍 Analyzing for security threats...");
    const analysis = await detector.analyzeThreat(mockResult);
    
    console.log("\n📊 THREAT ANALYSIS RESULTS:");
    console.log(detector.generateThreatSummary(analysis));
    
  } catch (error) {
    console.log(`❌ Real image test failed: ${error.message}`);
  }
}

// Run tests
async function main() {
  await testThreatDetection();
  
  // Test with real image if provided
  const imagePath = process.argv[2];
  await testWithRealImage(imagePath);
}

main().catch(console.error);
