import os
import csv
import time
import logging
import argparse
from pathlib import Path
from typing import Tuple, List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
import easyocr

from utils import load_image_bytes, get_image_mime_type

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class DocumentClassifier:
    """
    A multi-stage classification pipeline for medical and insurance documents.
    Uses filename heuristics, OCR keyword matching, and LLM fallback.
    """
    
    CATEGORIES = [
        "Patient Bills",
        "Claim Forms",
        "KYC Documents",
        "Medical Reports",
        "Prescriptions",
        "Unknown"
    ]
    
    MODEL_ID = "gemini-2.0-flash-lite"
    
    def __init__(self):
        """Initialize the classifier, loading environment variables and models."""
        load_dotenv()
        self.client = self._initialize_gemini()
        
        logger.info("Initializing EasyOCR reader (this may take a moment)...")
        # Initialize OCR once to avoid overhead per image
        self.ocr_reader = easyocr.Reader(['en'], gpu=False)
        logger.info("EasyOCR initialized successfully.")

    def _initialize_gemini(self) -> genai.Client:
        """Initialize and return the Gemini client."""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GOOGLE_API_KEY not found in environment variables.")
            raise ValueError("GOOGLE_API_KEY is required for the LLM fallback stage.")
        return genai.Client(api_key=api_key)

    def _classify_with_llm(self, image_path: str) -> str:
        """
        Fallback classification using Gemini LLM.
        Includes exponential backoff for rate limit handling.
        """
        prompt = f"""
        You are an expert at medical document classification for an insurance company (MediShield Insurance).
        Analyze the provided image and classify it into exactly one of the following categories:
        {', '.join(self.CATEGORIES)}

        Guidelines:
        - Return ONLY the category name from the list above.
        - If you are unsure or the document doesn't fit any category, return 'Unknown'.
        - Do not provide any explanation or markdown formatting.
        """
        
        image_bytes = load_image_bytes(image_path)
        mime_type = get_image_mime_type(image_path)
        
        max_retries = 3
        base_delay = 5
        
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.MODEL_ID,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        types.Part.from_text(text=prompt)
                    ]
                )
                category = response.text.strip()
                
                # Basic validation
                for cat in self.CATEGORIES:
                    if cat.lower() in category.lower():
                        return cat
                return "Unknown"
                
            except Exception as e:
                if "429" in str(e) or "quota" in str(e).lower():
                    if attempt < max_retries - 1:
                        sleep_time = base_delay * (2 ** attempt)
                        logger.warning(f"Rate limit hit. Sleeping for {sleep_time}s before retry...")
                        time.sleep(sleep_time)
                        continue
                logger.error(f"LLM classification failed for {image_path}: {e}")
                raise e
                
        return "Unknown"

    def classify_document(self, image_path: str, image_name: str) -> Tuple[str, str]:
        """
        Executes the 3-Stage Classification Pipeline.
        Returns: (Category, Matched Keyword/Method)
        """
        # Stage 1: File name heuristic
        lower_name = image_name.lower()
        if "bill" in lower_name:
            return "Patient Bills", "bill"
        
        # Stage 2: OCR based classification
        try:
            text_list = self.ocr_reader.readtext(image_path, detail=0)
            full_text = " ".join(text_list).lower()
            
            if "aadhaar" in full_text:
                return "KYC Documents", "aadhaar"
            if "date of birth" in full_text:
                return "KYC Documents", "date of birth"
            if "medications" in full_text:
                return "Prescriptions", "medications"
            if "clinic" in full_text:
                return "Prescriptions", "clinic"
                
        except Exception as e:
            logger.error(f"OCR processing failed for {image_name}: {e}")

        # Stage 3: LLM Classification Fallback
        # Sleep to avoid rate limits since we are hitting LLM
        time.sleep(4.2)
        category = self._classify_with_llm(image_path)
        return category, "LLM"

def process_dataset(dataset_dir: str, output_file: str):
    """
    Process an entire directory of images and write results to a CSV.
    """
    dataset_path = Path(dataset_dir)
    
    if not dataset_path.exists() or not dataset_path.is_dir():
        logger.error(f"Dataset directory '{dataset_dir}' not found or is not a directory.")
        return

    # Gather valid images
    valid_extensions = {".png", ".jpg", ".jpeg"}
    images = [f for f in dataset_path.iterdir() if f.suffix.lower() in valid_extensions]
    
    if not images:
        logger.warning(f"No valid images found in {dataset_dir}.")
        return

    logger.info(f"Starting classification for {len(images)} images. Results will be saved to {output_file}")
    
    classifier = DocumentClassifier()
    success_count = 0
    
    with open(output_file, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Filename", "Category", "Matched Keyword"])
        f.flush()
        
        for i, img_path in enumerate(images):
            image_name = img_path.name
            logger.info(f"[{i+1}/{len(images)}] Processing {image_name}...")
            
            try:
                category, matched_keyword = classifier.classify_document(str(img_path), image_name)
                writer.writerow([image_name, category, matched_keyword])
                success_count += 1
                logger.info(f"Successfully classified {image_name} -> {category} (Matched: {matched_keyword})")
            except Exception as e:
                writer.writerow([image_name, "ERROR", str(e)])
                logger.error(f"Failed to classify {image_name}: {e}")
                
            f.flush()

    logger.info("--- Processing Summary ---")
    logger.info(f"Total Images Processed: {len(images)}")
    logger.info(f"Successful Classifications: {success_count}")
    logger.info(f"Results saved to: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MediShield Document Classification Pipeline")
    parser.add_argument(
        "--dataset", 
        type=str, 
        default="dataset", 
        help="Path to the directory containing images to classify."
    )
    parser.add_argument(
        "--output", 
        type=str, 
        default="classification_results.csv", 
        help="Path to the output CSV file."
    )
    
    args = parser.parse_args()
    process_dataset(args.dataset, args.output)
