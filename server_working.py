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
import threading
from functools import lru_cache
import gc
import psutil
from collections import defaultdict
import atexit

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

request_counts = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 60
MAX_REQUESTS_PER_HOUR = 100   

def rate_limit_check(client_ip):
    """Check if client has exceeded rate limit"""
    now = time.time()
    
    request_counts[client_ip] = [
        req_time for req_time in request_counts[client_ip] 
        if now - req_time < 3600
    ]
    
    recent_requests = [req_time for req_time in request_counts[client_ip] if now - req_time < 60]
    if len(recent_requests) >= MAX_REQUESTS_PER_MINUTE:
        return False, "minute"
    
    if len(request_counts[client_ip]) >= MAX_REQUESTS_PER_HOUR:
        return False, "hour"
    
    request_counts[client_ip].append(now)
    return True, None

def load_model_safely():
    """Load model with balanced optimizations"""
    try:
        print("🚀 Loading SmolVLM model with balanced optimizations...")
        
        memory = psutil.virtual_memory()
        available_gb = memory.available / (1024 * 1024 * 1024)
        print(f"💾 Available memory: {available_gb:.1f}GB")
        
        if available_gb < 3:
            print("⚠️ Warning: Low memory. Using lightweight settings.")
        
        processor = AutoProcessor.from_pretrained(
            "HuggingFaceTB/SmolVLM-Instruct", 
            local_files_only=True
        )
        
        # Balanced settings - not too aggressive
        model = AutoModelForVision2Seq.from_pretrained(
            "HuggingFaceTB/SmolVLM-Instruct",
            torch_dtype=torch.bfloat16,
            device_map="auto",
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            local_files_only=True,
            use_cache=True
        )
        
        model.eval()
        
        # Optional compilation - don't force it
        if hasattr(torch, 'compile') and torch.cuda.is_available():
            try:
                print("🔥 Attempting model compilation...")
                model = torch.compile(model, mode="default")  # Less aggressive
                print("✅ Model compiled successfully!")
            except Exception as e:
                print(f"⚠️ Model compilation failed (still functional): {e}")
        
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            print(f"🎮 GPU memory allocated: {torch.cuda.memory_allocated() / 1024**3:.1f}GB")
            
        print("✅ Model loaded successfully!")
        return processor, model
        
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        raise

# Initialize model
try:
    processor, model = load_model_safely()
    MODEL_AVAILABLE = True
except Exception as e:
    print(f"💥 Critical error: Could not load model: {e}")
    processor, model = None, None
    MODEL_AVAILABLE = False

stats = {
    "requests_processed": 0,
    "total_processing_time": 0,
    "average_response_time": 0,
    "errors": 0,
    "start_time": time.time(),
    "rate_limit_hits": 0,
    "memory_warnings": 0,
    "normal_requests": 0,
    "quick_requests": 0,
    "timeouts": 0
}

def update_stats(processing_time, error=False, quick_mode=False):
    """Update performance statistics"""
    stats["requests_processed"] += 1
    
    if quick_mode:
        stats["quick_requests"] += 1
    else:
        stats["normal_requests"] += 1
    
    if not error:
        stats["total_processing_time"] += processing_time
        stats["average_response_time"] = stats["total_processing_time"] / max(stats["requests_processed"] - stats["errors"], 1)
    else:
        stats["errors"] += 1

def resize_image_for_processing(image, quick_mode=False):
    """Resize image with mode-appropriate settings"""
    try:
        if not isinstance(image, Image.Image):
            raise ValueError("Invalid image object")
            
        width, height = image.size
        
        # FIXED: More reasonable sizing
        if quick_mode:
            max_size = 216  # Smaller for quick mode
        else:
            max_size = 382  # Normal size for better quality
        
        # Calculate scaling
        if width > height:
            if width > max_size:
                height = int(height * max_size / width)
                width = max_size
        else:
            if height > max_size:
                width = int(width * max_size / height)
                height = max_size
        
        # Only resize if necessary
        if width != image.size[0] or height != image.size[1]:
            image = image.resize((width, height), Image.Resampling.LANCZOS)
            logger.info(f"📐 Resized to ({width}, {height}) for {'quick' if quick_mode else 'normal'} processing")
        
        return image
        
    except Exception as e:
        logger.error(f"Image resize error: {e}")
        raise ValueError(f"Failed to process image: {str(e)}")

def validate_image_data(image_url):
    """Validate and process image data"""
    try:
        if not image_url.startswith('data:image'):
            raise ValueError("Invalid image format - must be data URL")
        
        if ',' not in image_url:
            raise ValueError("Invalid data URL format")
            
        header, base64_data = image_url.split(',', 1)
        
        supported_types = ['jpeg', 'jpg', 'png', 'webp']
        if not any(img_type in header.lower() for img_type in supported_types):
            raise ValueError(f"Unsupported image type. Supported: {', '.join(supported_types)}")
        
        try:
            image_bytes = base64.b64decode(base64_data)
        except Exception:
            raise ValueError("Invalid base64 encoding")
        
        # Reasonable size limit
        max_size = 10 * 1024 * 1024  # 10MB
        if len(image_bytes) > max_size:
            raise ValueError(f"Image too large. Max: {max_size//1024//1024}MB")
        
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        except Exception:
            raise ValueError("Corrupted or invalid image file")
        
        return image
        
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        raise

@app.route('/health', methods=['GET'])
def health():
    uptime = time.time() - stats["start_time"]
    
    memory = psutil.virtual_memory()
    memory_usage = {
        "used_gb": round(memory.used / (1024**3), 2),
        "available_gb": round(memory.available / (1024**3), 2),
        "percent": memory.percent
    }
    
    gpu_memory = {}
    if torch.cuda.is_available():
        gpu_memory = {
            "allocated_gb": round(torch.cuda.memory_allocated() / (1024**3), 2),
            "reserved_gb": round(torch.cuda.memory_reserved() / (1024**3), 2)
        }
    
    return jsonify({
        "status": "healthy" if MODEL_AVAILABLE else "degraded",
        "model": "SmolVLM-Instruct" if MODEL_AVAILABLE else "unavailable",
        "purpose": "AI Vision for Blind Users",
        "uptime_seconds": round(uptime, 2),
        "requests_processed": stats["requests_processed"],
        "normal_requests": stats["normal_requests"],
        "quick_requests": stats["quick_requests"],
        "average_response_time": round(stats["average_response_time"], 2),
        "error_rate": round(stats["errors"] / max(stats["requests_processed"], 1) * 100, 2),
        "memory_usage": memory_usage,
        "gpu_memory": gpu_memory,
        "model_available": MODEL_AVAILABLE
    })

class GenerationTimeoutError(Exception):
    pass

def generation_with_timeout(model, inputs, generation_params, timeout_seconds):
    """Generate with timeout"""
    result = [None]
    exception = [None]
    
    def generate():
        try:
            with torch.no_grad():
                result[0] = model.generate(**inputs, **generation_params)
        except Exception as e:
            exception[0] = e
    
    generation_thread = threading.Thread(target=generate)
    generation_thread.daemon = True
    generation_thread.start()
    
    generation_thread.join(timeout=timeout_seconds)
    
    if generation_thread.is_alive():
        raise GenerationTimeoutError(f"Generation timeout after {timeout_seconds} seconds")
    
    if exception[0]:
        raise exception[0]
    
    if result[0] is None:
        raise RuntimeError("Generation failed without exception")
    
    return result[0]

@app.route('/v1/chat/completions', methods=['POST', 'OPTIONS'])
def chat_completions():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'})
    
    if not MODEL_AVAILABLE:
        return jsonify({
            "error": "AI model not available",
            "suggestions": ["Wait for model to load", "Restart server"]
        }), 503
    
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', 
                                    request.environ.get('HTTP_X_REAL_IP', 
                                                        request.remote_addr))
    
    rate_ok, limit_type = rate_limit_check(client_ip)
    if not rate_ok:
        stats["rate_limit_hits"] += 1
        retry_after = 60 if limit_type == "minute" else 3600
        return jsonify({
            "error": f"Rate limit exceeded. Please wait {retry_after} seconds.",
            "retry_after": retry_after
        }), 429
    
    start_time = time.time()
    
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        messages = data.get('messages', [])
        if not messages:
            return jsonify({"error": "No messages provided"}), 400

        quick_mode = data.get('quick_mode', False)
        priority = data.get('priority', 'normal')
        
        max_tokens = data.get('max_tokens', 30)  # Default 300
        if quick_mode:
            max_tokens = min(max_tokens, 10)  # Quick mode limit
        else:
            max_tokens = min(max_tokens, 30)  # Normal mode limit
        
        temperature = data.get('temperature', 0.1)
        temperature = max(0.0, min(temperature, 1.0))
        
        top_p = data.get('top_p', 0.9)
        repetition_penalty = data.get('repetition_penalty', 1.1)
        
        logger.info(f"🚀 Processing {'QUICK' if quick_mode else 'NORMAL'} request (max_tokens: {max_tokens})")
        
        # Extract message content
        user_message = messages[-1] if messages else {}
        content = user_message.get('content', [])
        
        image_data = None
        text_prompt = ""
        
        if isinstance(content, str):
            text_prompt = content
        else:
            for item in content:
                if item.get('type') == 'image':
                    image_url = item.get('image_url', {}).get('url', '')
                    if image_url:
                        try:
                            image_data = validate_image_data(image_url)
                            image_data = resize_image_for_processing(image_data, quick_mode)
                            logger.info(f"📐 Image processed: {image_data.size}")
                        except Exception as e:
                            return jsonify({
                                "error": f"Image processing failed: {str(e)}"
                            }), 400
                elif item.get('type') == 'text':
                    text_prompt = item.get('text', '')
        
        if not image_data:
            return jsonify({"error": "No valid image provided"}), 400
        
        # FIXED: Don't override user prompts
        if not text_prompt:
            if quick_mode:
                text_prompt = "Briefly describe what you see in one sentence."
            else:
                text_prompt = "Describe what you see in this image in detail. Include information about people, objects, colors, text, and the overall scene."
        
        logger.info(f"📝 {'QUICK' if quick_mode else 'NORMAL'} prompt: {text_prompt[:50]}...")
        
        # Check memory
        memory = psutil.virtual_memory()
        if memory.percent > 85:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        # Prepare messages
        messages_formatted = [{
            "role": "user", 
            "content": [
                {"type": "image"},
                {"type": "text", "text": text_prompt}
            ]
        }]
        
        try:
            prompt = processor.apply_chat_template(messages_formatted, add_generation_prompt=True)
        except Exception as e:
            return jsonify({"error": "Failed to process prompt template"}), 500
        
        preprocessing_start = time.time()
        try:
            inputs = processor(text=prompt, images=[image_data], return_tensors="pt")
        except Exception as e:
            return jsonify({"error": "Failed to process inputs"}), 500
            
        preprocessing_time = time.time() - preprocessing_start
        logger.info(f"⚡ Input processing: {preprocessing_time:.2f}s")
        
        try:
            inputs = {k: v.to(model.device) for k, v in inputs.items()}
        except Exception as e:
            return jsonify({"error": "GPU memory error"}), 500
        
        logger.info(f"🤖 Generating {'QUICK' if quick_mode else 'NORMAL'} response...")
        generation_start = time.time()
        
        # FIXED: Proper timeout based on mode
        timeout = 45 if quick_mode else 90  # More reasonable timeouts
        
        generation_params = {
            "max_new_tokens": max_tokens,
            "do_sample": temperature > 0,
            "pad_token_id": processor.tokenizer.eos_token_id,
            "eos_token_id": processor.tokenizer.eos_token_id,
            "use_cache": True,
        }
        
        if temperature > 0:
            generation_params.update({
                "temperature": temperature,
                "top_p": top_p,
                "repetition_penalty": repetition_penalty
            })
        
        try:
            generated_ids = generation_with_timeout(model, inputs, generation_params, timeout)
        except GenerationTimeoutError:
            stats["timeouts"] += 1
            return jsonify({
                "error": f"Request timeout ({timeout}s). Try using quick mode for faster results.",
                "quick_mode_available": not quick_mode
            }), 408
        except Exception as e:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
            return jsonify({
                "error": f"Generation failed: {str(e)}",
                "suggestions": ["Try quick mode", "Use smaller image", "Wait and retry"]
            }), 500
        
        generation_time = time.time() - generation_start
        logger.info(f"⚡ Generation: {generation_time:.2f}s")
        
        try:
            generated_text = processor.decode(
                generated_ids[0][inputs['input_ids'].shape[1]:], 
                skip_special_tokens=True
            ).strip()
        except Exception as e:
            return jsonify({"error": "Failed to decode response"}), 500
        
        # Clean up memory
        del inputs, generated_ids
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        total_time = time.time() - start_time
        logger.info(f"✅ {'QUICK' if quick_mode else 'NORMAL'} response in {total_time:.2f}s")
        
        # Update statistics
        update_stats(total_time, quick_mode=quick_mode)
        
        response = {
            "id": f"chatcmpl-smolvlm-{int(time.time())}",
            "object": "chat.completion",
            "model": "SmolVLM-Instruct",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": generated_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 50,
                "completion_tokens": len(generated_text.split()),
                "total_tokens": 50 + len(generated_text.split())
            },
            "processing_metadata": {
                "quick_mode": quick_mode,
                "processing_time": round(total_time, 2),
                "generation_time": round(generation_time, 2),
                "preprocessing_time": round(preprocessing_time, 2),
                "response_length": len(generated_text),
                "image_size": image_data.size if image_data else None,
                "timeout_used": timeout
            }
        }
        
        return jsonify(response)
            
    except Exception as e:
        error_time = time.time() - start_time
        logger.error(f"❌ Error after {error_time:.2f}s: {e}")
        
        try:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except:
            pass
        
        update_stats(error_time, error=True)
        
        error_response = {
            "error": str(e),
            "processing_time": round(error_time, 2),
            "suggestions": [
                "Try using a smaller image",
                "Reduce max_tokens parameter", 
                "Wait a moment and retry"
            ]
        }
        
        return jsonify(error_response), 500

if __name__ == '__main__':
    print("🚀 SmolVLM server for AI Vision")
    print("🌐 Endpoints:")
    print("  - Regular: POST /v1/chat/completions")
    print("  - Health:  GET /health")
    print()
    
    try:
        app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n🛑 Server shutdown")
    except Exception as e:
        print(f"💥 Server error: {e}")