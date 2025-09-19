#!/usr/bin/env python3
"""
AI Image Classification Service
Classifies images using NVIDIA's Florence-2 model
"""

import os
import sys
import requests
import mimetypes
import zipfile
import json
import tempfile
import argparse
from datetime import datetime
from typing import Optional, Dict, Any

# Global debug flag
DEBUG_MODE = False

def debug_print(message: str):
    """Print debug message only if debug mode is enabled"""
    if DEBUG_MODE:
        print(message)

# Load configuration
try:
    from config import API_KEY, NVAi_URL
except ImportError:
    # Fallback to environment variables
    API_KEY = os.getenv("NVIDIA_API_KEY")
    NVAi_URL = "https://ai.api.nvidia.com/v1/vlm/microsoft/florence-2"

if not API_KEY:
    raise ValueError("API_KEY must be set in config.py or as NVIDIA_API_KEY environment variable")

HEADER_AUTH = f"Bearer {API_KEY}"


class ImageClassifier:
    """Handles image classification using NVIDIA's API"""
    
    def __init__(self, api_key: str = None, api_url: str = None):
        self.api_key = api_key or API_KEY
        self.api_url = api_url or NVAi_URL
        self.header_auth = f"Bearer {self.api_key}"
    
    def upload_asset(self, image_path: str, description: str = "Test Image") -> str:
        """Upload image asset to NVIDIA's service"""
        debug_print(f"DEBUG: Starting asset upload for {image_path}")
        content_type, _ = mimetypes.guess_type(image_path)
        if not content_type or not content_type.startswith('image/'):
            content_type = "image/jpeg"
        debug_print(f"DEBUG: Content type: {content_type}")
        
        try:
            debug_print("DEBUG: Sending authorization request...")
            authorize = requests.post(
                "https://api.nvcf.nvidia.com/v2/nvcf/assets",
                headers={
                    "Authorization": self.header_auth,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                json={"contentType": content_type, "description": description},
                timeout=30,
            )
            
            debug_print(f"DEBUG: Authorization response status: {authorize.status_code}")
            authorize.raise_for_status()
            auth_response = authorize.json()
            debug_print(f"DEBUG: Authorization response keys: {list(auth_response.keys())}")
            upload_url = auth_response["uploadUrl"]
            debug_print(f"DEBUG: Upload URL obtained: {upload_url[:50]}...")

            debug_print("DEBUG: Uploading file...")
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
            debug_print(f"DEBUG: Upload response status: {response.status_code}")
            response.raise_for_status()
            asset_id = str(auth_response["assetId"])
            debug_print(f"DEBUG: Asset uploaded successfully, ID: {asset_id}")
            return asset_id
            
        except requests.RequestException as e:
            debug_print(f"DEBUG: Request exception during upload: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                debug_print(f"DEBUG: Response status: {e.response.status_code}")
                debug_print(f"DEBUG: Response text: {e.response.text}")
            raise Exception(f"Failed to upload asset: {str(e)}")
    
    def classify_image(self, image_path: str, task: str = "<CAPTION>") -> str:
        """Classify an image and return the result"""
        try:
            debug_print(f"DEBUG: Starting classification for {image_path} with task {task}")
            asset_id = self.upload_asset(image_path)
            content = f'{task}<img src="data:image/jpeg;asset_id,{asset_id}" />'
            inputs = {"messages": [{"role": "user", "content": content}]}
            debug_print(f"DEBUG: Classification input prepared")

            headers = {
                "Content-Type": "application/json",
                "NVCF-INPUT-ASSET-REFERENCES": asset_id,
                "NVCF-FUNCTION-ASSET-IDS": asset_id,
                "Authorization": self.header_auth,
                "Accept": "application/json",
            }
            debug_print(f"DEBUG: Sending classification request to {self.api_url}")

            response = requests.post(self.api_url, headers=headers, json=inputs)
            debug_print(f"DEBUG: Classification response status: {response.status_code}")
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '').lower()
            debug_print(f"DEBUG: Response content type: {content_type}")
            
            if 'application/json' in content_type:
                result = response.json()
                debug_print(f"DEBUG: JSON response received")
                return result["choices"][0]["message"]["content"]
            elif 'application/zip' in content_type:
                debug_print(f"DEBUG: ZIP response received, extracting...")
                return self._extract_zip_response(response.content)
            else:
                debug_print(f"DEBUG: Unknown response format: {content_type}")
                return "Classification failed - unknown response format"
                
        except Exception as e:
            debug_print(f"DEBUG: Classification exception: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                debug_print(f"DEBUG: Error response status: {e.response.status_code}")
                debug_print(f"DEBUG: Error response text: {e.response.text}")
            raise Exception(f"Classification failed: {str(e)}")
    
    def _extract_zip_response(self, zip_content: bytes) -> str:
        """Extract classification result from ZIP response"""
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "response.zip")
            with open(zip_path, 'wb') as f:
                f.write(zip_content)
            
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
        
        return "Classification failed - could not extract result from ZIP"


def save_classification_result(image_path: str, classification_result: str, output_dir: str) -> str:
    """Save classification result to JSON file"""
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


def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description="Classify images using NVIDIA AI")
    parser.add_argument("image_path", help="Path to the image file to classify")
    parser.add_argument("output_dir", help="Directory to save classification results")
    parser.add_argument("--task", default="<CAPTION>", help="Classification task (default: <CAPTION>)")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    
    args = parser.parse_args()
    
    # Global debug flag
    global DEBUG_MODE
    DEBUG_MODE = args.debug
    
    try:
        # Debug logging
        debug_print(f"DEBUG: Python script started with args: {args}")
        debug_print(f"DEBUG: Current working directory: {os.getcwd()}")
        debug_print(f"DEBUG: Python version: {sys.version}")
        debug_print(f"DEBUG: Image path: {args.image_path}")
        debug_print(f"DEBUG: Output directory: {args.output_dir}")
        
        # Check API key
        if not API_KEY:
            raise ValueError("API_KEY is not set. Check config.py or environment variables.")
        debug_print(f"DEBUG: API key is present (length: {len(API_KEY)})")
        
        # Validate inputs
        if not os.path.exists(args.image_path):
            raise FileNotFoundError(f"Image file not found: {args.image_path}")
        
        # Check file size
        file_size = os.path.getsize(args.image_path)
        debug_print(f"DEBUG: Image file size: {file_size} bytes")
        if file_size == 0:
            raise ValueError("Image file is empty")
        
        # Test requests module
        debug_print("DEBUG: Testing requests module...")
        import requests
        debug_print(f"DEBUG: Requests module loaded successfully, version: {requests.__version__}")
        
        # Initialize classifier and process image
        debug_print("DEBUG: Initializing classifier...")
        classifier = ImageClassifier()
        debug_print("DEBUG: Starting classification...")
        classification = classifier.classify_image(args.image_path, args.task)
        debug_print(f"DEBUG: Classification completed: {classification[:100]}...")
        
        result_path = save_classification_result(args.image_path, classification, args.output_dir)
        debug_print(f"DEBUG: Result saved to: {result_path}")
        
        # Output result as JSON for Node.js to parse
        result = {
            "success": True,
            "classification": classification,
            "result_file": result_path,
            "image_file": os.path.basename(args.image_path)
        }
        print("CLASSIFICATION_RESULT:" + json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print(f"ERROR: Exception type: {type(e).__name__}")
        import traceback
        print(f"ERROR: Traceback:\n{traceback.format_exc()}")
        
        result = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "image_file": os.path.basename(args.image_path) if args.image_path and os.path.exists(args.image_path) else "unknown"
        }
        print("CLASSIFICATION_RESULT:" + json.dumps(result))
        sys.exit(1)


if __name__ == "__main__":
    main()
