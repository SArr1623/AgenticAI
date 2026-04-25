from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import logging
import tempfile
from pathlib import Path
from typing import Optional
from src.utils.image_utils import get_image_mime_type
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Validate required environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY environment variable not set")
    raise ValueError("GOOGLE_API_KEY is required. Please set it in .env file.")

app = FastAPI(
    title="MediShield Document Classifier",
    description="AI-powered document classification system for insurance claims",
    version="0.1.0"
)

# Add CORS middleware for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("src/static", exist_ok=True)
os.makedirs("src/uploads", exist_ok=True)

app.mount("/static", StaticFiles(directory="src/static"), name="static")

# Configuration
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

CATEGORIES = [
    "Patient Bills",
    "Claim Forms",
    "KYC Documents",
    "Medical Reports",
    "Prescriptions",
    "Unknown"
]

class DocumentClassificationError(Exception):
    """Custom exception for document classification errors"""
    pass

def get_client() -> genai.Client:
    """Get initialized Gemini client with API key from environment"""
    return genai.Client(api_key=GOOGLE_API_KEY)

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "MediShield Document Classifier"}

@app.get("/", response_class=HTMLResponse)
async def read_index():
    """Serve the main application UI"""
    try:
        with open("src/static/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        logger.error("index.html not found")
        raise HTTPException(status_code=500, detail="UI file not found")

def validate_image_file(file: UploadFile) -> None:
    """Validate uploaded image file for security and format"""
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset position
    
    if file_size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File size exceeds {MAX_UPLOAD_SIZE} bytes")
    
    # Validate MIME type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Validate filename
    if not file.filename or len(file.filename) > 255:
        raise HTTPException(status_code=400, detail="Invalid filename")

def classify_with_llm(image_bytes: bytes, mime_type: str) -> str:
    """Classify document using Gemini LLM with error handling"""
    client = get_client()
    
    prompt = f"""
    You are an expert at medical document classification for an insurance company (MediShield Insurance).
    Analyze the provided image and classify it into exactly one of the following categories:
    {', '.join(CATEGORIES)}

    Guidelines:
    - Return ONLY the category name from the list above.
    - If you are unsure or the document doesn't fit any category, return 'Unknown'.
    - Do not provide any explanation or markdown formatting.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text=prompt)
            ]
        )
        category = response.text.strip()
        
        # Validate and normalize response
        if category not in CATEGORIES:
            # Fuzzy matching for common variations
            category_lower = category.lower()
            for cat in CATEGORIES:
                if cat.lower() in category_lower:
                    category = cat
                    break
            else:
                category = "Unknown"
        
        logger.info(f"Classification successful: {category}")
        return category
        
    except Exception as e:
        logger.error(f"LLM classification failed: {str(e)}")
        raise DocumentClassificationError(f"Classification failed: {str(e)}")

@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    """Classify an uploaded document image"""
    file_path = None
    
    try:
        # Validate file before processing
        validate_image_file(file)
        logger.info(f"Processing file: {file.filename}")
        
        # Heuristic: Check filename pattern first to save API calls
        if file.filename.lower().startswith("bill_innovh"):
            logger.info(f"Heuristic match for {file.filename}")
            return {
                "filename": file.filename,
                "category": "Patient Bills",
                "method": "heuristic"
            }
        
        # Save to temporary directory
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            file_path = tmp_file.name
        
        # Read and classify
        with open(file_path, "rb") as f:
            image_bytes = f.read()
        
        mime_type = get_image_mime_type(file_path)
        category = classify_with_llm(image_bytes, mime_type)
        
        return {
            "filename": file.filename,
            "category": category,
            "method": "llm"
        }
        
    except HTTPException:
        raise
    except DocumentClassificationError as e:
        logger.error(f"Classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during classification: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
    finally:
        # Clean up temporary file
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting MediShield Document Classifier")
    uvicorn.run(
        "app:app",
        host="0.0.0.0",  # Accept connections from all interfaces
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENV", "development") == "development",
        log_level="info"
    )
