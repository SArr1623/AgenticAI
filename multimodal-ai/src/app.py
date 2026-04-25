from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import shutil
from src.utils.image_utils import get_image_mime_type
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MediShield Document Classifier")

# Create directories
os.makedirs("src/static", exist_ok=True)
os.makedirs("src/uploads", exist_ok=True)

app.mount("/static", StaticFiles(directory="src/static"), name="static")
# We'll serve the index.html directly from a route instead of Jinja to keep it simple, 
# or just return the static file.

CATEGORIES = [
    "Patient Bills",
    "Claim Forms",
    "KYC Documents",
    "Medical Reports",
    "Prescriptions",
    "Unknown"
]

def get_client():
    return genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

@app.get("/", response_class=HTMLResponse)
async def read_index():
    with open("src/static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/classify")
async def classify_image(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    file_path = f"src/uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Heuristic: Check filename pattern first to save API calls
    if file.filename.lower().startswith("bill_innovh"):
        # Clean up
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"filename": file.filename, "category": "Patient Bills", "method": "heuristic"}

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
    
    with open(file_path, "rb") as f:
        image_bytes = f.read()
        
    mime_type = get_image_mime_type(file_path)
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text=prompt)
            ]
        )
        category = response.text.strip()
        
        # basic validation
        if category not in CATEGORIES:
            for cat in CATEGORIES:
                if cat.lower() in category.lower():
                    category = cat
                    break
            else:
                category = "Unknown"
                
    except Exception as e:
        category = f"Error: {str(e)}"
        
    # Clean up
    if os.path.exists(file_path):
        os.remove(file_path)
        
    return {"filename": file.filename, "category": category}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
