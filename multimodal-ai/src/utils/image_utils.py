from PIL import Image
import io
import os

def load_image_bytes(image_path):
    """
    Reads an image file and returns its bytes.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found at {image_path}")
        
    with open(image_path, "rb") as f:
        return f.read()

def get_image_mime_type(image_path):
    """
    Determines the MIME type based on file extension.
    """
    ext = os.path.splitext(image_path)[1].lower()
    if ext in [".png"]:
        return "image/png"
    elif ext in [".jpg", ".jpeg"]:
        return "image/jpeg"
    else:
        return "image/png" # Default
