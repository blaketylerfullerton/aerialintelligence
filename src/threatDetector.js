/**
 * AI-Powered Threat Detection Service
 * Uses advanced AI analysis to detect suspicious activities instead of keyword matching
 */

const { spawn } = require("child_process");
const path = require("path");

/**
 * Intelligent Threat Detection Service
 * Analyzes image classifications to determine if they represent security threats
 */
class ThreatDetector {
  constructor(config = {}) {
    this.config = {
      // Threat severity levels
      severityLevels: {
        CRITICAL: 5, // Immediate danger (weapons, violence, break-ins)
        HIGH: 4,     // Suspicious activity (unauthorized persons, climbing)
        MEDIUM: 3,   // Potential concern (loitering, unusual objects)
        LOW: 2,      // Minor anomaly (unexpected movement)
        NONE: 1      // Normal activity
      },
      
      // Minimum threat level to trigger notifications
      notificationThreshold: config.notificationThreshold || 3, // MEDIUM and above
      
      // Enable detailed threat analysis
      detailedAnalysis: config.detailedAnalysis !== false,
      
      // Context awareness
      timeBasedAnalysis: config.timeBasedAnalysis !== false,
      
      ...config
    };
    
    this.threatPatterns = this._initializeThreatPatterns();
  }

  /**
   * Initialize threat detection patterns
   */
  _initializeThreatPatterns() {
    return {
      // CRITICAL threats - immediate response needed
      critical: [
        // Violence and weapons
        /\b(gun|weapon|knife|pistol|rifle|firearm|armed|shooting|violence|fight|attack|assault)\b/i,
        /\b(breaking|smashing|destroying|vandal|damage|theft|steal|rob|burglar)\b/i,
        /\b(fire|smoke|explosion|emergency|danger|alarm)\b/i,
        
        // Break-ins and intrusion
        /\b(breaking.{0,10}(in|into|through)|forced.{0,10}entry|intruder|trespass)\b/i,
        /\b(climbing.{0,10}(fence|wall|window)|jumping.{0,10}(fence|barrier))\b/i,
      ],
      
      // HIGH threats - suspicious activity
      high: [
        // Unauthorized access
        /\b(unauthorized|suspicious.{0,10}person|unknown.{0,10}individual|stranger)\b/i,
        /\b(lurking|hiding|concealed|sneaking|prowling)\b/i,
        /\b(mask|hood|face.{0,10}covered|disguise)\b/i,
        
        // Suspicious behavior
        /\b(loitering|lingering|watching|observing|surveillance|casing)\b/i,
        /\b(unusual.{0,10}activity|strange.{0,10}behavior|odd.{0,10}movement)\b/i,
        /\b(multiple.{0,10}people|group.{0,10}gathering|crowd)\b/i,
      ],
      
      // MEDIUM threats - potential concerns
      medium: [
        // Unusual objects or situations
        /\b(abandoned.{0,10}(bag|package|object)|unattended.{0,10}item)\b/i,
        /\b(vehicle.{0,10}parked|car.{0,10}stopped|truck.{0,10}waiting)\b/i,
        /\b(at.{0,10}night|after.{0,10}hours|late.{0,10}evening|dark)\b/i,
        
        // Movement patterns
        /\b(running|moving.{0,10}quickly|hurried|rushed)\b/i,
        /\b(back.{0,10}and.{0,10}forth|pacing|circling)\b/i,
      ],
      
      // Positive indicators (reduce threat level)
      normal: [
        /\b(employee|worker|staff|security|guard|maintenance)\b/i,
        /\b(uniform|badge|identification|authorized)\b/i,
        /\b(delivery|service|repair|cleaning)\b/i,
        /\b(family|children|pet|dog|cat)\b/i,
        /\b(normal.{0,10}activity|routine|expected)\b/i,
      ]
    };
  }

  /**
   * Analyze a classification result for potential threats
   */
  async analyzeThreat(classificationResult) {
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        classification: classificationResult.classification,
        image_file: classificationResult.image_file,
        threat_detected: false,
        threat_level: 'NONE',
        threat_score: 1,
        threat_reasons: [],
        confidence: 0,
        recommended_action: 'none'
      };

      // Perform pattern-based analysis
      const patternAnalysis = this._analyzePatterns(classificationResult.classification);
      
      // Perform contextual analysis if enabled
      let contextAnalysis = { score: 0, factors: [] };
      if (this.config.detailedAnalysis) {
        contextAnalysis = await this._analyzeContext(classificationResult);
      }
      
      // Combine analyses
      const finalScore = Math.max(patternAnalysis.score, contextAnalysis.score);
      const allReasons = [...patternAnalysis.reasons, ...contextAnalysis.factors];
      
      // Determine threat level
      const threatLevel = this._calculateThreatLevel(finalScore);
      
      // Update analysis
      analysis.threat_score = finalScore;
      analysis.threat_level = threatLevel;
      analysis.threat_detected = finalScore >= this.config.notificationThreshold;
      analysis.threat_reasons = allReasons;
      analysis.confidence = this._calculateConfidence(patternAnalysis, contextAnalysis);
      analysis.recommended_action = this._getRecommendedAction(threatLevel, finalScore);
      
      return analysis;
    } catch (error) {
      console.error(`❌ Threat analysis failed: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        classification: classificationResult.classification,
        image_file: classificationResult.image_file,
        threat_detected: false,
        threat_level: 'ERROR',
        threat_score: 0,
        threat_reasons: [`Analysis error: ${error.message}`],
        confidence: 0,
        recommended_action: 'manual_review'
      };
    }
  }

  /**
   * Analyze classification text for threat patterns
   */
  _analyzePatterns(classificationText) {
    const text = classificationText.toLowerCase();
    let maxScore = 1;
    const reasons = [];
    
    // Check critical threats
    for (const pattern of this.threatPatterns.critical) {
      if (pattern.test(text)) {
        maxScore = Math.max(maxScore, 5);
        reasons.push(`Critical threat pattern detected: ${pattern.source.substring(0, 50)}...`);
      }
    }
    
    // Check high threats
    for (const pattern of this.threatPatterns.high) {
      if (pattern.test(text)) {
        maxScore = Math.max(maxScore, 4);
        reasons.push(`High threat pattern detected: suspicious activity`);
      }
    }
    
    // Check medium threats
    for (const pattern of this.threatPatterns.medium) {
      if (pattern.test(text)) {
        maxScore = Math.max(maxScore, 3);
        reasons.push(`Medium threat pattern detected: unusual activity`);
      }
    }
    
    // Check for normal indicators (reduce score)
    let normalIndicators = 0;
    for (const pattern of this.threatPatterns.normal) {
      if (pattern.test(text)) {
        normalIndicators++;
      }
    }
    
    // Reduce threat score if normal indicators are present
    if (normalIndicators > 0) {
      maxScore = Math.max(1, maxScore - normalIndicators);
      reasons.push(`Normal activity indicators found (${normalIndicators})`);
    }
    
    return { score: maxScore, reasons };
  }

  /**
   * Perform contextual analysis using AI
   */
  async _analyzeContext(classificationResult) {
    if (!this.config.detailedAnalysis) {
      return { score: 0, factors: [] };
    }
    
    try {
      // Use AI to perform deeper security analysis
      const securityPrompt = this._buildSecurityPrompt(classificationResult.classification);
      const analysis = await this._performAISecurityAnalysis(
        classificationResult.image_file, 
        securityPrompt
      );
      
      return this._parseAISecurityAnalysis(analysis);
    } catch (error) {
      console.log(`⚠️ Contextual analysis failed: ${error.message}`);
      return { score: 0, factors: [`Contextual analysis unavailable: ${error.message}`] };
    }
  }

  /**
   * Build security-focused prompt for AI analysis
   */
  _buildSecurityPrompt(classification) {
    return `<SECURITY_ANALYSIS>Analyze this scene for security threats and suspicious activities. 
    
    Original description: "${classification}"
    
    Please evaluate:
    1. Are there any people in unauthorized areas?
    2. Is anyone exhibiting suspicious behavior (hiding, breaking in, carrying weapons)?
    3. Are there signs of vandalism, theft, or property damage?
    4. Is this activity normal for this type of location?
    5. What is the overall threat level (NONE/LOW/MEDIUM/HIGH/CRITICAL)?
    
    Respond with: THREAT_LEVEL: [level] | CONFIDENCE: [0-100] | REASON: [brief explanation]`;
  }

  /**
   * Perform AI-powered security analysis
   */
  async _performAISecurityAnalysis(imagePath, prompt) {
    return new Promise((resolve, reject) => {
      // Use the existing image classifier with a security-focused prompt
      const classifierPath = path.join(__dirname, "imageClassifier.ts");
      const captureDir = path.dirname(imagePath);
      const tempDir = path.join(captureDir, "temp_security_analysis");
      
      const python = spawn("ts-node", [
        classifierPath,
        imagePath,
        tempDir,
        "--task",
        prompt
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
          resolve(output);
        } else {
          reject(new Error(`Security analysis failed: ${errorOutput}`));
        }
      });

      python.on("error", (error) => {
        reject(new Error(`Failed to start security analysis: ${error.message}`));
      });
    });
  }

  /**
   * Parse AI security analysis response
   */
  _parseAISecurityAnalysis(analysisOutput) {
    const factors = [];
    let score = 0;
    
    try {
      // Look for our structured response
      const threatMatch = analysisOutput.match(/THREAT_LEVEL:\s*(\w+)/i);
      const confidenceMatch = analysisOutput.match(/CONFIDENCE:\s*(\d+)/i);
      const reasonMatch = analysisOutput.match(/REASON:\s*([^\n]+)/i);
      
      if (threatMatch) {
        const threatLevel = threatMatch[1].toUpperCase();
        score = this.config.severityLevels[threatLevel] || 1;
        factors.push(`AI threat assessment: ${threatLevel}`);
      }
      
      if (confidenceMatch) {
        const confidence = parseInt(confidenceMatch[1]);
        factors.push(`AI confidence: ${confidence}%`);
      }
      
      if (reasonMatch) {
        factors.push(`AI reasoning: ${reasonMatch[1]}`);
      }
      
      // If no structured response, fall back to general analysis
      if (!threatMatch && analysisOutput.length > 0) {
        // Look for security-related keywords in the response
        const securityKeywords = [
          'suspicious', 'threat', 'danger', 'weapon', 'break', 'intrude', 
          'unauthorized', 'steal', 'vandal', 'alarm'
        ];
        
        const foundKeywords = securityKeywords.filter(keyword => 
          analysisOutput.toLowerCase().includes(keyword)
        );
        
        if (foundKeywords.length > 0) {
          score = Math.min(foundKeywords.length + 1, 5);
          factors.push(`AI detected security keywords: ${foundKeywords.join(', ')}`);
        }
      }
      
    } catch (error) {
      factors.push(`AI analysis parsing error: ${error.message}`);
    }
    
    return { score, factors };
  }

  /**
   * Calculate threat level from score
   */
  _calculateThreatLevel(score) {
    if (score >= 5) return 'CRITICAL';
    if (score >= 4) return 'HIGH';
    if (score >= 3) return 'MEDIUM';
    if (score >= 2) return 'LOW';
    return 'NONE';
  }

  /**
   * Calculate confidence based on multiple analysis methods
   */
  _calculateConfidence(patternAnalysis, contextAnalysis) {
    let confidence = 0;
    
    // Base confidence from pattern matching
    if (patternAnalysis.reasons.length > 0) {
      confidence += 40;
    }
    
    // Additional confidence from AI analysis
    if (contextAnalysis.factors.length > 0) {
      confidence += 40;
    }
    
    // Bonus confidence if both methods agree
    if (patternAnalysis.score > 1 && contextAnalysis.score > 1) {
      confidence += 20;
    }
    
    return Math.min(confidence, 100);
  }

  /**
   * Get recommended action based on threat level
   */
  _getRecommendedAction(threatLevel, score) {
    switch (threatLevel) {
      case 'CRITICAL':
        return 'immediate_response';
      case 'HIGH':
        return 'investigate_immediately';
      case 'MEDIUM':
        return 'monitor_closely';
      case 'LOW':
        return 'log_for_review';
      default:
        return 'none';
    }
  }

  /**
   * Check if threat should trigger notification
   */
  shouldTriggerNotification(threatAnalysis) {
    return threatAnalysis.threat_detected && 
           threatAnalysis.threat_score >= this.config.notificationThreshold;
  }

  /**
   * Generate human-readable threat summary
   */
  generateThreatSummary(threatAnalysis) {
    if (!threatAnalysis.threat_detected) {
      return "No security threats detected - normal activity";
    }

    const emoji = {
      'CRITICAL': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '⚡',
      'LOW': '👁️',
      'NONE': '✅'
    };

    const summary = [
      `${emoji[threatAnalysis.threat_level]} THREAT LEVEL: ${threatAnalysis.threat_level}`,
      `🎯 Confidence: ${threatAnalysis.confidence}%`,
      `📊 Score: ${threatAnalysis.threat_score}/5`,
      `🎬 Source: ${threatAnalysis.image_file}`,
      `⏰ Time: ${new Date(threatAnalysis.timestamp).toLocaleString()}`
    ];

    if (threatAnalysis.threat_reasons.length > 0) {
      summary.push(`📝 Reasons:`);
      threatAnalysis.threat_reasons.forEach(reason => {
        summary.push(`   • ${reason}`);
      });
    }

    if (threatAnalysis.recommended_action !== 'none') {
      const actions = {
        'immediate_response': '🚨 IMMEDIATE RESPONSE REQUIRED',
        'investigate_immediately': '🔍 Investigate immediately',
        'monitor_closely': '👀 Monitor situation closely',
        'log_for_review': '📋 Log for later review',
        'manual_review': '👤 Manual review needed'
      };
      summary.push(`🎯 Action: ${actions[threatAnalysis.recommended_action]}`);
    }

    return summary.join('\n');
  }
}

module.exports = { ThreatDetector };
