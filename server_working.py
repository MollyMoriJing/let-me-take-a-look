from transformers import AutoProcessor, AutoModelForVision2Seq
from flask import Flask, request, jsonify
from flask_cors import CORS 
import torch
from PIL import Image
import base64
import io
import json
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

print("🚀 Loading SmolVLM model for AI Vision Studio - Eyes for the Blind...")
processor = AutoProcessor.from_pretrained("HuggingFaceTB/SmolVLM-Instruct")
model = AutoModelForVision2Seq.from_pretrained(
    "HuggingFaceTB/SmolVLM-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
print("✅ Model loaded successfully! Ready to serve blind users.")

# Model performance tracking
stats = {
    "requests_processed": 0,
    "total_processing_time": 0,
    "average_response_time": 0,
    "errors": 0,
    "start_time": time.time()
}

def update_stats(processing_time, error=False):
    """Update performance statistics"""
    stats["requests_processed"] += 1
    if not error:
        stats["total_processing_time"] += processing_time
        stats["average_response_time"] = stats["total_processing_time"] / stats["requests_processed"]
    else:
        stats["errors"] += 1

def resize_image_for_accessibility(image, max_size=512):
    """
    Resize image for optimal processing while maintaining quality for accessibility
    Larger images provide better text recognition and detail detection
    """
    width, height = image.size
    
    # Calculate scaling to maintain aspect ratio
    if width > height:
        if width > max_size:
            height = int(height * max_size / width)
            width = max_size
    else:
        if height > max_size:
            width = int(width * max_size / height)
            height = max_size
    
    if width != image.size[0] or height != image.size[1]:
        logger.info(f"Resizing image from {image.size} to ({width}, {height}) for better accessibility processing")
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    
    return image

@app.route('/health', methods=['GET'])
def health():
    uptime = time.time() - stats["start_time"]
    return jsonify({
        "status": "healthy", 
        "model": "SmolVLM-Instruct",
        "purpose": "AI Vision for Blind Users",
        "uptime_seconds": round(uptime, 2),
        "requests_processed": stats["requests_processed"],
        "average_response_time": round(stats["average_response_time"], 2),
        "error_rate": round(stats["errors"] / max(stats["requests_processed"], 1) * 100, 2),
        "accessibility_features": [
            "Detailed scene descriptions",
            "Text reading (OCR)",
            "Navigation assistance", 
            "Shopping help",
            "Safety alerts",
            "Social context",
            "Enhanced prompts for blind users"
        ]
    })

@app.route('/v1/models', methods=['GET'])
def models():
    return jsonify({
        "data": [{
            "id": "HuggingFaceTB/SmolVLM-Instruct",
            "object": "model",
            "owned_by": "HuggingFaceTB",
            "purpose": "Vision assistance for blind and visually impaired users",
            "capabilities": [
                "Scene description",
                "Text recognition", 
                "Object identification",
                "Navigation assistance",
                "Safety analysis"
            ]
        }]
    })

@app.route('/v1/chat/completions', methods=['POST', 'OPTIONS'])
def chat_completions():
    # Handle preflight requests
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
    
    start_time = time.time()
    
    try:
        data = request.json
        messages = data.get('messages', [])
        
        # Enhanced token limits for accessibility
        max_tokens = data.get('max_tokens', 300)  # Increased default for detailed descriptions
        max_tokens = min(max_tokens, 500)  # Cap at 500 for performance
        
        # Optimized temperature for consistent, detailed responses
        temperature = data.get('temperature', 0.1)
        
        logger.info(f"🔍 Processing request with {len(messages)} messages (max_tokens: {max_tokens})")
        
        if not messages:
            return jsonify({"error": "No messages provided"}), 400
            
        # Extract the user message
        user_message = messages[-1] if messages else {}
        content = user_message.get('content', [])
        
        # Handle both string and list content
        if isinstance(content, str):
            text_prompt = content
            image_data = None
        else:
            image_data = None
            text_prompt = ""
            
            for item in content:
                if item.get('type') == 'image':
                    image_url = item.get('image_url', {}).get('url', '')
                    if image_url.startswith('data:image'):
                        try:
                            base64_data = image_url.split(',')[1]
                            image_bytes = base64.b64decode(base64_data)
                            image_data = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                            
                            # Enhanced image processing for accessibility
                            image_data = resize_image_for_accessibility(image_data, max_size=512)
                            
                            logger.info(f"✅ Image processed: {image_data.size}")
                        except Exception as e:
                            logger.error(f"❌ Image processing error: {e}")
                            return jsonify({"error": f"Image processing failed: {str(e)}"}), 400
                elif item.get('type') == 'text':
                    text_prompt = item.get('text', '')
        
        # Default to accessibility-focused prompt if none provided
        if not text_prompt:
            text_prompt = "Describe this image in detail for a blind person. Include people, objects, colors, text, lighting, and any safety considerations. Be specific and comprehensive."
            
        logger.info(f"📝 Prompt: {text_prompt[:100]}...")
        
        # Detect prompt type for optimized processing
        prompt_type = "general"
        if "blind person" in text_prompt.lower() or "describe" in text_prompt.lower():
            prompt_type = "accessibility"
        elif "text" in text_prompt.lower() and "read" in text_prompt.lower():
            prompt_type = "text_reading"
        elif "navigate" in text_prompt.lower() or "obstacle" in text_prompt.lower():
            prompt_type = "navigation"
        elif "safety" in text_prompt.lower() or "hazard" in text_prompt.lower():
            prompt_type = "safety"
            
        logger.info(f"🎯 Detected prompt type: {prompt_type}")
            
        # Prepare messages for SmolVLM format
        if image_data:
            # Enhanced message formatting for better results
            messages_formatted = [
                {
                    "role": "user", 
                    "content": [
                        {"type": "image"},
                        {"type": "text", "text": text_prompt}
                    ]
                }
            ]
            
            # Apply chat template and process
            prompt = processor.apply_chat_template(
                messages_formatted, 
                add_generation_prompt=True
            )
            
            preprocessing_start = time.time()
            inputs = processor(
                text=prompt, 
                images=[image_data], 
                return_tensors="pt"
            )
            preprocessing_time = time.time() - preprocessing_start
            logger.info(f"⚡ Input processing: {preprocessing_time:.2f}s")
            
            # Move to device
            inputs = {k: v.to(model.device) for k, v in inputs.items()}
            
            logger.info("🤖 Generating response...")
            generation_start = time.time()
            
            # Enhanced generation parameters for accessibility
            generation_params = {
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "do_sample": temperature > 0,
                "pad_token_id": processor.tokenizer.eos_token_id,
                "eos_token_id": processor.tokenizer.eos_token_id,
            }
            
            # Adjust parameters based on prompt type
            if prompt_type == "text_reading":
                generation_params["temperature"] = 0.05  # Very low for accurate text reading
                generation_params["do_sample"] = False
            elif prompt_type == "safety":
                generation_params["temperature"] = 0.1   # Low for consistent safety info
                generation_params["max_new_tokens"] = min(max_tokens, 400)
            elif prompt_type == "accessibility":
                generation_params["max_new_tokens"] = max_tokens  # Full length for detailed descriptions
            
            # Generate with enhanced parameters
            with torch.no_grad():
                generated_ids = model.generate(
                    **inputs,
                    **generation_params
                )
            
            generation_time = time.time() - generation_start
            logger.info(f"⚡ Generation time: {generation_time:.2f}s")
            
            # Decode only the new tokens
            generated_text = processor.decode(
                generated_ids[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            ).strip()
            
            total_time = time.time() - start_time
            logger.info(f"✅ Generated response in {generation_time:.2f}s (total: {total_time:.2f}s)")
            logger.info(f"📄 Response: {generated_text[:100]}...")
            
            # Update statistics
            update_stats(total_time)
            
            # Enhanced response with accessibility metadata
            response = {
                "id": f"chatcmpl-smolvlm-{int(time.time())}",
                "object": "chat.completion",
                "model": "HuggingFaceTB/SmolVLM-Instruct",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": generated_text
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": len(inputs['input_ids'][0]),
                    "completion_tokens": len(generated_ids[0]) - len(inputs['input_ids'][0]),
                    "total_tokens": len(generated_ids[0])
                },
                "accessibility_metadata": {
                    "prompt_type": prompt_type,
                    "optimized_for_blind_users": True,
                    "processing_time": round(total_time, 2),
                    "response_length": len(generated_text),
                    "image_size": image_data.size if image_data else None
                }
            }
            
            return jsonify(response)
        else:
            return jsonify({"error": "No image provided"}), 400
            
    except Exception as e:
        error_time = time.time() - start_time
        logger.error(f"❌ Error after {error_time:.2f}s: {e}")
        
        # Update error statistics
        update_stats(error_time, error=True)
        
        import traceback
        traceback.print_exc()
        
        # Enhanced error response
        error_response = {
            "error": str(e),
            "error_type": type(e).__name__,
            "processing_time": round(error_time, 2),
            "suggestions": []
        }
        
        # Add helpful suggestions based on error type
        if "out of memory" in str(e).lower():
            error_response["suggestions"] = [
                "Try with a smaller image",
                "Reduce max_tokens parameter",
                "Wait for GPU memory to clear"
            ]
        elif "timeout" in str(e).lower():
            error_response["suggestions"] = [
                "The model is warming up, please try again",
                "Try with a smaller max_tokens value",
                "Check your internet connection"
            ]
        elif "connection" in str(e).lower():
            error_response["suggestions"] = [
                "Check if the AI server is running",
                "Verify the server URL is correct",
                "Check your network connection"
            ]
        
        return jsonify(error_response), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get server performance statistics"""
    uptime = time.time() - stats["start_time"]
    return jsonify({
        **stats,
        "uptime_seconds": round(uptime, 2),
        "uptime_hours": round(uptime / 3600, 2),
        "requests_per_hour": round(stats["requests_processed"] / max(uptime / 3600, 0.01), 2),
        "success_rate": round((stats["requests_processed"] - stats["errors"]) / max(stats["requests_processed"], 1) * 100, 2)
    })

@app.route('/warmup', methods=['POST'])
def warmup():
    """Warm up the model with a test image"""
    try:
        # Create a small test image
        test_image = Image.new('RGB', (100, 100), color='white')
        
        # Test processing
        messages_formatted = [{
            "role": "user", 
            "content": [
                {"type": "image"},
                {"type": "text", "text": "What do you see?"}
            ]
        }]
        
        prompt = processor.apply_chat_template(messages_formatted, add_generation_prompt=True)
        inputs = processor(text=prompt, images=[test_image], return_tensors="pt")
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            generated_ids = model.generate(**inputs, max_new_tokens=10, do_sample=False)
        
        return jsonify({"status": "warmed_up", "message": "Model is ready for requests"})
        
    except Exception as e:
        return jsonify({"error": f"Warmup failed: {str(e)}"}), 500

if __name__ == '__main__':
    print("🌟 SmolVLM server optimized for blind users")
    print("🚀 Server running on http://0.0.0.0:8000")
    print("💡 Health check: curl http://localhost:8000/health")
    print("📊 Statistics: curl http://localhost:8000/stats")
    print("🔥 Warmup model: curl -X POST http://localhost:8000/warmup")
    print("👁️ Ready to serve as digital eyes for the blind!")
    
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)