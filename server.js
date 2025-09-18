const NodeMediaServer = require("node-media-server");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: "*",
  },
};

const nms = new NodeMediaServer(config);

// Setup directories
const captureDir = path.join(__dirname, "captured_frames");
const classificationDir = path.join(__dirname, "classification_results");
const pythonScriptPath = path.join(__dirname, "image_classifier.py"); // Adjust path as needed

// Create directories if they don't exist
[captureDir, classificationDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

let activeStreams = new Map();
let frameCount = 0;

// Function to run image classification
function classifyImage(imagePath) {
  console.log(`🤖 Starting classification for: ${path.basename(imagePath)}`);

  // Run Python classification script
  const python = spawn("python", [
    "-c",
    `
import sys
import os
sys.path.append('${__dirname.replace(/\\/g, "/")}')

# Import our classification functions
import os
import sys
import requests
import mimetypes
import zipfile
import json
import tempfile
from datetime import datetime

API_KEY = "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"
NVAi_URL = "https://ai.api.nvidia.com/v1/vlm/microsoft/florence-2"
HEADER_AUTH = f"Bearer {API_KEY}"

def upload_asset(image_path, description="Test Image"):
    content_type, _ = mimetypes.guess_type(image_path)
    if not content_type or not content_type.startswith('image/'):
        content_type = "image/jpeg"
    
    authorize = requests.post(
        "https://api.nvcf.nvidia.com/v2/nvcf/assets",
        headers={
            "Authorization": HEADER_AUTH,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        json={"contentType": content_type, "description": description},
        timeout=30,
    )
    
    authorize.raise_for_status()
    upload_url = authorize.json()["uploadUrl"]

    with open(image_path, "rb") as f:
        response = requests.put(
            upload_url,
            data=f,
            headers={
                "x-amz-meta-nvcf-asset-description": description,
                "content-type": content_type,
            },
            timeout=300,
        )
    response.raise_for_status()
    return str(authorize.json()["assetId"])

def caption_image(image_path, task="<CAPTION>"):
    try:
        asset_id = upload_asset(image_path)
        content = f'{task}<img src="data:image/jpeg;asset_id,{asset_id}" />'
        inputs = {"messages": [{"role": "user", "content": content}]}

        headers = {
            "Content-Type": "application/json",
            "NVCF-INPUT-ASSET-REFERENCES": asset_id,
            "NVCF-FUNCTION-ASSET-IDS": asset_id,
            "Authorization": HEADER_AUTH,
            "Accept": "application/json",
        }

        response = requests.post(NVAi_URL, headers=headers, json=inputs)
        response.raise_for_status()
        
        content_type = response.headers.get('content-type', '').lower()
        
        if 'application/json' in content_type:
            result = response.json()
            return result["choices"][0]["message"]["content"]
        elif 'application/zip' in content_type:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, "response.zip")
                with open(zip_path, 'wb') as f:
                    f.write(response.content)
                
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                    files = zip_ref.namelist()
                    
                    response_file = None
                    for file in files:
                        if file.endswith('.response'):
                            response_file = file
                            break
                    
                    if response_file:
                        response_path = os.path.join(temp_dir, response_file)
                        with open(response_path, 'r', encoding='utf-8') as f:
                            json_content = json.load(f)
                            content = json_content["choices"][0]["message"]["content"]
                            if content.startswith('<CAPTION>'):
                                content = content[9:]
                            return content
        return "Classification failed - unknown response format"
    except Exception as e:
        return f"Error: {str(e)}"

def save_classification_result(image_path, classification_result, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    image_filename = os.path.basename(image_path)
    timestamp = datetime.now().isoformat()
    
    result_data = {
        "timestamp": timestamp,
        "image_file": image_filename,
        "image_path": image_path,
        "classification": classification_result,
        "processed_at": timestamp
    }
    
    base_name = os.path.splitext(image_filename)[0]
    json_filename = f"{base_name}_classification.json"
    json_path = os.path.join(output_dir, json_filename)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    
    return json_path

# Process the image
image_path = "${imagePath.replace(/\\/g, "/")}"
output_dir = "${classificationDir.replace(/\\/g, "/")}"

try:
    classification = caption_image(image_path)
    result_path = save_classification_result(image_path, classification, output_dir)
    
    result = {
        "success": True,
        "classification": classification,
        "result_file": result_path,
        "image_file": os.path.basename(image_path)
    }
    print("CLASSIFICATION_RESULT:" + json.dumps(result))
    
except Exception as e:
    result = {
        "success": False,
        "error": str(e),
        "image_file": os.path.basename(image_path)
    }
    print("CLASSIFICATION_RESULT:" + json.dumps(result))
    `,
  ]);

  let output = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    const text = data.toString();
    output += text;

    // Look for our JSON result
    const lines = text.split("\n");
    lines.forEach((line) => {
      if (line.startsWith("CLASSIFICATION_RESULT:")) {
        try {
          const resultJson = line.substring("CLASSIFICATION_RESULT:".length);
          const result = JSON.parse(resultJson);

          if (result.success) {
            console.log(`✅ Classification complete for ${result.image_file}:`);
            console.log(`   📝 Result: ${result.classification}`);
            console.log(`   💾 Saved to: ${path.basename(result.result_file)}`);

            // Optional: Save a summary log
            saveSummaryLog(result);
          } else {
            console.log(
              `❌ Classification failed for ${result.image_file}: ${result.error}`
            );
          }
        } catch (e) {
          console.log(`Error parsing classification result: ${e.message}`);
        }
      } else if (line.trim() && !line.includes("Response status code")) {
        console.log(`   🐍 ${line.trim()}`);
      }
    });
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", (code) => {
    if (code !== 0 && errorOutput) {
      console.log(`❌ Classification process failed with code ${code}`);
      console.log(`Error output: ${errorOutput}`);
    }
  });

  python.on("error", (error) => {
    console.log(`❌ Failed to start classification process: ${error.message}`);
  });
}

// Function to save summary log
function saveSummaryLog(result) {
  const summaryLogPath = path.join(
    classificationDir,
    "classification_summary.jsonl"
  );
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...result,
  };

  fs.appendFileSync(summaryLogPath, JSON.stringify(logEntry) + "\n");
}

// Function to capture frame from stream
function captureFrameFromStream(streamPath) {
  frameCount++;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `frame-${frameCount}-${timestamp}.jpg`;
  const outputPath = path.join(captureDir, filename);

  console.log(`📸 Capturing frame ${frameCount} from ${streamPath}...`);

  // Use ffmpeg to capture a frame from the RTMP stream
  const ffmpeg = spawn("ffmpeg", [
    "-i",
    `rtmp://localhost:1935${streamPath}`,
    "-vframes",
    "1",
    "-f",
    "image2",
    "-q:v",
    "2", // High quality
    "-y", // Overwrite output file
    outputPath,
  ]);

  ffmpeg.on("close", (code) => {
    if (code === 0) {
      console.log(`📸 Frame captured: ${filename}`);

      // Check if file exists and has content before classifying
      fs.stat(outputPath, (err, stats) => {
        if (!err && stats.size > 0) {
          console.log(`🔍 Starting classification for captured frame...`);
          // Start classification process
          setTimeout(() => classifyImage(outputPath), 1000); // Small delay to ensure file is fully written
        } else {
          console.log(
            `⚠️  Captured frame is empty or doesn't exist: ${filename}`
          );
        }
      });
    } else {
      console.log(`❌ Frame capture failed for ${streamPath} (code: ${code})`);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    // Suppress most ffmpeg verbose output, only show errors
    const error = data.toString();
    if (
      error.includes("Error") ||
      error.includes("failed") ||
      error.includes("No such file")
    ) {
      console.log(`FFmpeg error: ${error.trim()}`);
    }
  });
}

// Start auto frame capture for a stream
function startFrameCapture(streamPath) {
  if (activeStreams.has(streamPath)) {
    return; // Already capturing
  }

  console.log(`🎥 Starting frame capture and classification for ${streamPath}`);

  // Capture first frame after a delay to ensure stream is stable
  setTimeout(() => {
    captureFrameFromStream(streamPath);
  }, 3000);

  // Then capture every 10 seconds (increased from 5 to give classification time)
  const interval = setInterval(() => {
    captureFrameFromStream(streamPath);
  }, 10000);

  activeStreams.set(streamPath, interval);
}

// Stop frame capture for a stream
function stopFrameCapture(streamPath) {
  const interval = activeStreams.get(streamPath);
  if (interval) {
    clearInterval(interval);
    activeStreams.delete(streamPath);
    console.log(`⏹️  Stopped frame capture for ${streamPath}`);
  }
}

// Cleanup old files (optional - keeps last 100 frames and classifications)
function cleanupOldFiles() {
  const maxFiles = 100;

  // Cleanup frames
  fs.readdir(captureDir, (err, files) => {
    if (!err && files.length > maxFiles) {
      const frameFiles = files
        .filter((f) => f.startsWith("frame-"))
        .map((f) => ({
          name: f,
          path: path.join(captureDir, f),
          time: fs.statSync(path.join(captureDir, f)).mtime,
        }))
        .sort((a, b) => a.time - b.time);

      const filesToDelete = frameFiles.slice(0, frameFiles.length - maxFiles);
      filesToDelete.forEach((file) => {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Deleted old frame: ${file.name}`);
      });
    }
  });

  // Cleanup classification results
  fs.readdir(classificationDir, (err, files) => {
    if (!err && files.length > maxFiles) {
      const jsonFiles = files
        .filter((f) => f.endsWith("_classification.json"))
        .map((f) => ({
          name: f,
          path: path.join(classificationDir, f),
          time: fs.statSync(path.join(classificationDir, f)).mtime,
        }))
        .sort((a, b) => a.time - b.time);

      const filesToDelete = jsonFiles.slice(0, jsonFiles.length - maxFiles);
      filesToDelete.forEach((file) => {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Deleted old classification: ${file.name}`);
      });
    }
  });
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

// Event handlers
nms.on("preConnect", (id, args) => {
  console.log(
    "[NodeEvent on preConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("postConnect", (id, args) => {
  console.log(
    "[NodeEvent on postConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("doneConnect", (id, args) => {
  console.log(
    "[NodeEvent on doneConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("prePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on prePublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("postPublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );

  // Start frame capture and classification for this stream
  startFrameCapture(StreamPath);
});

nms.on("donePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );

  // Stop frame capture for this stream
  stopFrameCapture(StreamPath);
});

nms.on("prePlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on prePlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("postPlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

nms.on("donePlay", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePlay]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );
});

// Start the server
nms.run();

console.log("🚀 RTMP Server with AI Classification started!");
console.log("📡 RTMP URL: rtmp://localhost:1935/live");
console.log("🌐 HTTP Server: http://localhost:8000");
console.log("📸 Frame Capture: Enabled (captures every 10 seconds)");
console.log("🤖 AI Classification: Enabled (processes each captured frame)");
console.log(`📁 Frame Directory: ${captureDir}`);
console.log(`📁 Classification Directory: ${classificationDir}`);
console.log("");
console.log("To stream to this server:");
console.log("  Stream URL: rtmp://localhost:1935/live");
console.log("  Stream Key: drone (or any key you want)");
console.log("");
console.log("To view the stream:");
console.log("  RTMP: rtmp://localhost:1935/live/drone");
console.log("  HTTP-FLV: http://localhost:8000/live/drone.flv");
console.log("  Web Viewer: Open site.html in your browser");
console.log("");
console.log(
  "🤖 AI Classification will automatically process each captured frame!"
);
console.log(
  "📊 Results saved to JSON files in classification_results directory"
);
console.log(
  "📈 Summary log: classification_results/classification_summary.jsonl"
);
console.log("Press Ctrl+C to stop the server");
