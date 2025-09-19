import os
import requests
import argparse

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

def send_telegram_photo(token: str, chat_id: str, image_path: str, caption: str):
    """Send photo with caption to Telegram"""
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    
    try:
        with open(image_path, 'rb') as photo:
            files = {'photo': photo}
            data = {'chat_id': chat_id, 'caption': caption}
            response = requests.post(url, files=files, data=data)
            
        if response.status_code == 200:
            print("Photo sent successfully ✅")
        else:
            print(f"Failed to send photo ❌: {response.text}")
            return False
        return True
    except FileNotFoundError:
        print(f"Image file not found: {image_path} ❌")
        return False
    except Exception as e:
        print(f"Error sending photo ❌: {str(e)}")
        return False

def send_telegram_message(token: str, chat_id: str, text: str):
    """Send text message to Telegram"""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    response = requests.post(url, data=payload)
    if response.status_code == 200:
        print("Message sent successfully ✅")
        return True
    else:
        print(f"Failed to send message ❌: {response.text}")
        return False

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Send Telegram notification with optional image")
    parser.add_argument("--image", help="Path to image file to send")
    parser.add_argument("--message", default="Hello Blake! 🚀 This came from command line arguments.", help="Message to send")
    
    args = parser.parse_args()
    
    print(f"📱 Starting Telegram notification...")
    print(f"🔧 Message: {args.message[:50]}...")
    print(f"📷 Image path: {args.image}")
    
    # Try to send photo with caption if image path is provided
    if args.image and os.path.exists(args.image):
        print(f"📷 Sending photo: {args.image}")
        success = send_telegram_photo(BOT_TOKEN, CHAT_ID, args.image, args.message)
        if not success:
            print("📝 Falling back to text message...")
            send_telegram_message(BOT_TOKEN, CHAT_ID, args.message)
    else:
        if args.image:
            print(f"⚠️ Image file not found: {args.image}")
        print("📝 Sending text message (no valid image provided)")
        send_telegram_message(BOT_TOKEN, CHAT_ID, args.message)
