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

// Frame capture setup
const captureDir = path.join(__dirname, "captured_frames");
if (!fs.existsSync(captureDir)) {
  fs.mkdirSync(captureDir);
}

let activeStreams = new Map();
let frameCount = 0;

// Function to capture frame from stream
function captureFrameFromStream(streamPath) {
  frameCount++;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `frame-${frameCount}-${timestamp}.jpg`;
  const outputPath = path.join(captureDir, filename);

  // Use ffmpeg to capture a frame from the RTMP stream
  const ffmpeg = spawn("ffmpeg", [
    "-i",
    `rtmp://localhost:1935${streamPath}`,
    "-vframes",
    "1",
    "-f",
    "image2",
    "-y", // Overwrite output file
    outputPath,
  ]);

  ffmpeg.on("close", (code) => {
    if (code === 0) {
      console.log(`📸 Frame captured: ${filename}`);
    } else {
      console.log(`❌ Frame capture failed for ${streamPath}`);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    // Suppress ffmpeg verbose output, only show errors
    const error = data.toString();
    if (error.includes("Error") || error.includes("failed")) {
      console.log(`FFmpeg error: ${error}`);
    }
  });
}

// Start auto frame capture for a stream
function startFrameCapture(streamPath) {
  if (activeStreams.has(streamPath)) {
    return; // Already capturing
  }

  console.log(`🎥 Starting frame capture for ${streamPath}`);

  // Capture first frame after a delay to ensure stream is stable
  setTimeout(() => {
    captureFrameFromStream(streamPath);
  }, 2000);

  // Then capture every 5 seconds
  const interval = setInterval(() => {
    captureFrameFromStream(streamPath);
  }, 5000);

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

  // Start frame capture for this stream
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

console.log("🚀 RTMP Server started!");
console.log("📡 RTMP URL: rtmp://localhost:1935/live");
console.log("🌐 HTTP Server: http://localhost:8000");
console.log("📸 Frame Capture: Enabled (saves every 5 seconds)");
console.log(`📁 Capture Directory: ${captureDir}`);
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
console.log("📸 Frame capture will start automatically when drone connects!");
console.log("Press Ctrl+C to stop the server");
