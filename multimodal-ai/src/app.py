from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import logging
import tempfile
from pathlib import Path
from typing import Optional, List
from src.utils.image_utils import get_image_mime_type
from google import genai
from google.genai import types
import base64
from dotenv import load_dotenv
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from mangum import Mangum

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

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# Langfuse observability config
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://us.cloud.langfuse.com")

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

# OpenTelemetry Tracing Setup — exports to Langfuse when keys are configured
provider = TracerProvider()

if LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
    _auth = base64.b64encode(
        f"{LANGFUSE_PUBLIC_KEY}:{LANGFUSE_SECRET_KEY}".encode()
    ).decode()
    _exporter = OTLPSpanExporter(
        endpoint=f"{LANGFUSE_HOST}/api/public/otel/v1/traces",
        headers={
            "Authorization": f"Basic {_auth}",
            "x-langfuse-ingestion-version": "4",
        },
    )
    logger.info(f"Langfuse tracing enabled → {LANGFUSE_HOST}")
else:
    _exporter = ConsoleSpanExporter()
    logger.warning("LANGFUSE keys not set — falling back to console exporter")

processor = BatchSpanProcessor(_exporter)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

# In AWS Lambda, the root filesystem is read-only, so we only create these locally.
# We check if we are in an AWS environment.
IS_AWS = bool(os.environ.get("AWS_EXECUTION_ENV") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

if not IS_AWS:
    os.makedirs("src/static", exist_ok=True)
    os.makedirs("src/uploads", exist_ok=True)

# Mount static files (will work in Lambda because the files are packaged)
if os.path.exists("src/static"):
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
    
    logger.info(f"Classifying image with size: {len(image_bytes)} bytes and MIME type: {mime_type}")
    with tracer.start_as_current_span("gemini_llm_call") as span:
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    types.Part.from_text(text=prompt)
                ]
            )
            category = response.text.strip()
            
            # Token usage logging
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                metadata = response.usage_metadata
                logger.info(f"Token Usage - Prompt: {metadata.prompt_token_count}, Candidates: {metadata.candidates_token_count}, Total: {metadata.total_token_count}")
                span.set_attribute("llm.usage.prompt_tokens", getattr(metadata, "prompt_token_count", 0))
                span.set_attribute("llm.usage.completion_tokens", getattr(metadata, "candidates_token_count", 0))
                span.set_attribute("llm.usage.total_tokens", getattr(metadata, "total_token_count", 0))
            
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
            span.set_attribute("llm.classification_result", category)
            return category
            
        except Exception as e:
            logger.error(f"LLM classification failed: {str(e)}")
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise DocumentClassificationError(f"Classification failed: {str(e)}")

@app.post("/classify")
async def classify_images(files: List[UploadFile] = File(...)):
    """Classify multiple uploaded document images"""
    results = []
    
    for file in files:
        file_path = None
        try:
            # Validate file before processing
            validate_image_file(file)
            logger.info(f"Processing file: {file.filename}")
            
            # Heuristic: Check filename pattern first to save API calls
            if file.filename.lower().startswith("bill_innovh"):
                logger.info(f"Heuristic match for {file.filename}")
                results.append({
                    "filename": file.filename,
                    "category": "Patient Bills",
                    "method": "heuristic"
                })
                continue
            
            # Save to temporary directory
            with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                file_path = tmp_file.name
            
            # Read and classify
            with open(file_path, "rb") as f:
                image_bytes = f.read()
            
            mime_type = file.content_type
            category = classify_with_llm(image_bytes, mime_type)
            
            results.append({
                "filename": file.filename,
                "category": category,
                "method": "llm"
            })
            
        except Exception as e:
            logger.error(f"Error classifying {file.filename}: {str(e)}")
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
        finally:
            # Clean up temporary file
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file: {str(e)}")
                    
    return {"results": results}

# AWS Lambda Handler
handler = Mangum(app)

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
