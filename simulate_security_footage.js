#!/usr/bin/env node

/**
 * Security Footage Simulator
 * Creates fake security scenarios to test the AI threat detection system
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Create test directories
const testDir = './test_footage';
const captureDir = './data/captured_frames';

if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}
if (!fs.existsSync(captureDir)) {
    fs.mkdirSync(captureDir, { recursive: true });
}

/**
 * Simulated security scenarios with varying threat levels
 */
const securityScenarios = [
    {
        name: "normal_patrol",
        description: "Security guard in uniform walking patrol route with flashlight during night shift",
        threatLevel: "NONE",
        timeOfDay: "night"
    },
    {
        name: "delivery_person",
        description: "Delivery driver in company uniform carrying packages to front entrance during business hours",
        threatLevel: "NONE",
        timeOfDay: "day"
    },
    {
        name: "suspicious_loitering",
        description: "Unknown person in hood standing near building entrance for extended period, checking phone frequently",
        threatLevel: "MEDIUM",
        timeOfDay: "night"
    },
    {
        name: "fence_climbing",
        description: "Person in dark clothing climbing over security fence into restricted area carrying backpack",
        threatLevel: "HIGH",
        timeOfDay: "night"
    },
    {
        name: "window_breaking",
        description: "Individual using metal tool to break building windows, glass scattered, vandalism in progress",
        threatLevel: "CRITICAL",
        timeOfDay: "night"
    },
    {
        name: "armed_intruder",
        description: "Masked person with weapon approaching main entrance aggressively, clear threat to safety",
        threatLevel: "CRITICAL",
        timeOfDay: "night"
    },
    {
        name: "maintenance_worker",
        description: "Worker in safety vest and hard hat performing scheduled maintenance on building exterior",
        threatLevel: "NONE",
        timeOfDay: "day"
    },
    {
        name: "group_casing",
        description: "Three people in hoodies examining door locks and windows, one acting as lookout",
        threatLevel: "HIGH",
        timeOfDay: "night"
    },
    {
        name: "abandoned_package",
        description: "Unattended suspicious package left near building entrance, no owner visible in area",
        threatLevel: "MEDIUM",
        timeOfDay: "day"
    },
    {
        name: "vehicle_surveillance",
        description: "Van parked in unusual location with tinted windows, engine running, positioned to watch building",
        threatLevel: "MEDIUM",
        timeOfDay: "night"
    }
];

/**
 * Simulate frame capture by creating mock classification results
 */
async function simulateFrameCapture(scenario) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `frame-${scenario.name}-${timestamp}.jpg`;
    const outputPath = path.join(captureDir, filename);
    
    console.log(`📸 Simulating: ${scenario.name}`);
    console.log(`   📝 Scenario: ${scenario.description}`);
    console.log(`   🎯 Expected Threat: ${scenario.threatLevel}`);
    
    // Create a fake image file (just a small text file for testing)
    const fakeImageContent = `SIMULATED SECURITY FOOTAGE
Scenario: ${scenario.name}
Description: ${scenario.description}
Expected Threat Level: ${scenario.threatLevel}
Time of Day: ${scenario.timeOfDay}
Timestamp: ${new Date().toISOString()}`;
    
    fs.writeFileSync(outputPath, fakeImageContent);
    
    // Simulate the classification process
    await simulateClassification(outputPath, scenario);
}

/**
 * Simulate AI classification and threat detection
 */
async function simulateClassification(imagePath, scenario) {
    // Mock classification result that would come from AI
    const classificationResult = {
        success: true,
        classification: scenario.description,
        result_file: imagePath.replace('.jpg', '_classification.json'),
        image_file: path.basename(imagePath),
        timestamp: new Date().toISOString()
    };
    
    console.log(`🤖 Simulated AI Classification: ${classificationResult.classification.substring(0, 60)}...`);
    
    // Test threat detection
    try {
        const { ThreatDetector } = require("./src/threatDetector");
        const detector = new ThreatDetector({
            notificationThreshold: 3, // MEDIUM and above
            detailedAnalysis: false   // Disable for faster testing
        });
        
        const analysis = await detector.analyzeThreat(classificationResult);
        
        console.log(`🔍 Threat Analysis:`);
        console.log(`   📊 Detected Level: ${analysis.threat_level} (Expected: ${scenario.threatLevel})`);
        console.log(`   🎯 Score: ${analysis.threat_score}/5`);
        console.log(`   🚨 Would Alert: ${analysis.threat_detected ? 'YES' : 'NO'}`);
        console.log(`   💯 Confidence: ${analysis.confidence}%`);
        
        if (analysis.threat_detected) {
            console.log(`🚨 SECURITY ALERT TRIGGERED!`);
            const summary = detector.generateThreatSummary(analysis);
            console.log(`📱 Alert Message:\n${summary.split('\n').slice(0, 3).join('\n')}`);
        }
        
        // Save classification result
        const classificationDir = path.dirname(classificationResult.result_file);
        if (!fs.existsSync(classificationDir)) {
            fs.mkdirSync(classificationDir, { recursive: true });
        }
        
        const fullResult = {
            ...classificationResult,
            threat_analysis: analysis
        };
        
        fs.writeFileSync(classificationResult.result_file, JSON.stringify(fullResult, null, 2));
        console.log(`💾 Results saved to: ${path.basename(classificationResult.result_file)}`);
        
    } catch (error) {
        console.log(`❌ Threat detection failed: ${error.message}`);
    }
    
    console.log(""); // Empty line for readability
}

/**
 * Run continuous simulation
 */
async function runSimulation() {
    console.log('🎬 STARTING SECURITY FOOTAGE SIMULATION 🎬\n');
    console.log(`📁 Simulated frames will be saved to: ${path.resolve(captureDir)}`);
    console.log(`🤖 AI threat detection will analyze each scenario\n`);
    
    let scenarioIndex = 0;
    
    const simulate = async () => {
        const scenario = securityScenarios[scenarioIndex];
        await simulateFrameCapture(scenario);
        
        scenarioIndex = (scenarioIndex + 1) % securityScenarios.length;
        
        // Schedule next simulation
        setTimeout(simulate, 15000); // Every 15 seconds
    };
    
    // Start simulation
    await simulate();
}

/**
 * Run single test scenario
 */
async function runSingleTest(scenarioName) {
    const scenario = securityScenarios.find(s => s.name === scenarioName);
    if (!scenario) {
        console.log(`❌ Scenario '${scenarioName}' not found.`);
        console.log(`Available scenarios: ${securityScenarios.map(s => s.name).join(', ')}`);
        return;
    }
    
    console.log(`🎬 Testing single scenario: ${scenarioName}\n`);
    await simulateFrameCapture(scenario);
}

/**
 * List all available scenarios
 */
function listScenarios() {
    console.log('📋 AVAILABLE SECURITY SCENARIOS:\n');
    securityScenarios.forEach(scenario => {
        console.log(`🎬 ${scenario.name}`);
        console.log(`   📝 ${scenario.description}`);
        console.log(`   🎯 Expected Threat: ${scenario.threatLevel}`);
        console.log(`   🕐 Time: ${scenario.timeOfDay}`);
        console.log('');
    });
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🎬 Security Footage Simulator\n');
        console.log('Usage:');
        console.log('  node simulate_security_footage.js                    # Run continuous simulation');
        console.log('  node simulate_security_footage.js list               # List all scenarios');
        console.log('  node simulate_security_footage.js test <scenario>    # Test single scenario');
        console.log('');
        console.log('Examples:');
        console.log('  node simulate_security_footage.js test fence_climbing');
        console.log('  node simulate_security_footage.js test armed_intruder');
        return;
    }
    
    const command = args[0];
    
    switch (command) {
        case 'list':
            listScenarios();
            break;
            
        case 'test':
            if (args[1]) {
                await runSingleTest(args[1]);
            } else {
                console.log('❌ Please specify a scenario name');
                console.log('Use: node simulate_security_footage.js list');
            }
            break;
            
        case 'continuous':
        default:
            await runSimulation();
            break;
    }
}

main().catch(console.error);
