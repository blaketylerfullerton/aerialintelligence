# 🚨 Safety Monitoring System

Your RTMP streaming system has been restructured into a comprehensive **Safety Monitoring and Threat Detection System** that automatically analyzes video feeds for dangerous situations and sends real-time safety alerts via Telegram.

## 🔄 What Changed

### 1. **Safety-Focused Configuration** (`config/config.js`)

- **Danger Keywords**: Now monitors for threats like weapons, fire, violence, medical emergencies
- **Threat Categories**: Violence, Fire/Smoke, Medical Emergencies, Intrusion, Environmental Hazards
- **Safety Prompting**: Enhanced AI analysis specifically for danger detection

### 2. **Enhanced Telegram Alerts** (`src/telegramNotifier.ts`)

- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL priority alerts
- **Threat Indicators**: Lists specific dangers detected
- **Emergency Formatting**: Clear, urgent messaging with appropriate emojis
- **Evidence Photos**: Automatically attaches captured frame as evidence

### 3. **Intelligent Threat Detection** (`src/server.ts`)

- **Safety Analysis**: AI specifically looks for dangerous situations
- **Threat Assessment**: Automatically determines alert priority level
- **Smart Filtering**: Only alerts on actual threats, reducing false alarms

## 🚨 Alert Severity Levels

| Level        | Emoji | Triggers                              | Response                     |
| ------------ | ----- | ------------------------------------- | ---------------------------- |
| **CRITICAL** | 🚨    | Weapons, Violence, Fire               | Immediate attention required |
| **HIGH**     | ⚠️    | Multiple threats, Medical emergencies | Urgent response needed       |
| **MEDIUM**   | ⚡    | Suspicious activity, Single threats   | Monitor closely              |
| **LOW**      | 🔔    | Minor infractions, General alerts     | Routine check                |

## 🎯 Monitored Threats

### 🔫 Violence & Weapons

- Guns, knives, weapons
- Fighting, assault, violence
- Blood, injuries

### 🔥 Fire & Environmental

- Fire, flames, smoke
- Explosions, gas leaks
- Chemical spills, hazards

### 🏥 Medical Emergencies

- Unconscious persons
- Collapsed individuals
- Accidents, injuries

### 🥷 Security Threats

- Intruders, break-ins
- Suspicious persons
- Trespassing, burglary

### 🆘 Distress Signals

- Calls for help
- Emergency situations
- Dangerous conditions

## 🚀 How to Use

### 1. **Start the Safety Monitoring System**

```bash
cd /Users/blakefullerton/Downloads/Code/trash/rtmp
node src/server.ts
```

### 2. **Stream Video to Monitor**

- **Stream URL**: `rtmp://localhost:1935/live/your-key`
- **View Stream**: `http://localhost:8000/live/your-key.flv`

### 3. **Receive Safety Alerts**

- Alerts sent automatically to your configured Telegram
- Each alert includes severity level, threats detected, and evidence photo
- Timestamps and location information included

### 4. **Test the Alert System**

```bash
node test_safety_alert.js
```

## ⚙️ Configuration Options

### Enable/Disable Features

```javascript
// Safety Analysis
classification: {
  enabled: true,
  safetyFocused: true, // Use safety-specific AI prompts
}

// Alert System
notifications: {
  enabled: true, // Enable Telegram alerts
  triggers: {
    enabled: true, // Enable smart threat filtering
    requireAll: false, // ANY threat triggers alert
  }
}
```

### Customize Threat Keywords

```javascript
keywords: [
  // Add your specific threats to monitor
  "custom_threat",
  "specific_danger",
];
```

## 📱 Alert Message Format

```
🚨 SAFETY ALERT - HIGH PRIORITY 🚨

⏰ Time: 12/15/2024, 3:45:23 PM
📍 Location: Security Camera Feed

🔍 DETECTED SITUATION:
Armed intruder with weapon detected in lobby area

⚠️ THREAT INDICATORS:
• weapon
• intruder
• emergency

📱 This is an automated safety monitoring alert.
🚨 IMMEDIATE ATTENTION REQUIRED 🚨
```

## 🔧 Advanced Features

### Custom Threat Assessment

The system automatically assesses threat levels based on:

- Number of concurrent threats detected
- Severity of individual threats (weapons = critical)
- Context and situation analysis

### Evidence Capture

- Automatically captures and sends photo evidence
- Timestamps all alerts and images
- Maintains audit trail of all incidents

### Smart Filtering

- Reduces false alarms
- Focuses on genuine safety concerns
- Customizable sensitivity levels

## 🛠️ Troubleshooting

### No Alerts Received

1. Check Telegram bot token and chat ID in config
2. Verify `notifications.enabled: true`
3. Ensure keywords match detected threats

### Too Many False Alarms

1. Adjust threat keywords to be more specific
2. Set `requireAll: true` to require multiple indicators
3. Increase confidence threshold

### Missing Threats

1. Add relevant keywords to the detection list
2. Enable debug logging to see what's being detected
3. Review classification results in the logs

## 🔒 Security Notes

- Store Telegram credentials securely
- Regularly review and update threat keywords
- Monitor system logs for performance
- Test alert system regularly to ensure reliability

---

**Your video monitoring system is now a professional safety monitoring solution!** 🚨✨
