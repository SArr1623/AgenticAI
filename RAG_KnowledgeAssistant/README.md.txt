Drug & Disease Knowledge Assistant (RAG-Based)
Overview

This project implements a domain-specific Retrieval-Augmented Generation (RAG) system that answers questions solely based on drug- and disease-related documents. It is designed for medical knowledge support, focusing on accurate, source-grounded responses for queries about specific drugs and diseases.

The system demonstrates an end-to-end LLM-powered medical Q&A workflow, including document processing, embedding, vector storage, and context-aware answer generation.

Features

Loads and processes PDF and TXT medical documents.

Applies recursive text chunking to preserve context.

Generates document embeddings using OpenAI’s text-embedding-3-small.

Stores and retrieves vectors using a FAISS vector database.

Implements a RAG pipeline with similarity-based search.

Generates source-cited, context-grounded answers via GPT-4o-mini.

Ensures medical accuracy and disclaimers in responses.


Create a virtual environment and activate it:

python -m venv venv
venv\Scripts\activate     # Windows


Install dependencies:

pip install -r requirements.txt


Set up environment variables:

Create a .env file with your OpenAI API key:

OPENAI_API_KEY=your_api_key_here

Usage

Place your drug/disease PDFs and TXT files in a folder.

Update paths.txt with the folder path containing the documents.

Run the notebook or script:

jupyter notebook RAG_model.ipynb


Use the ask_ersodetug() function (or equivalent) to query the knowledge assistant.

Example
question = "What are the causes of hyperinsulinism?"
answer = ask_ersodetug(question)
print(answer)

Notes

All answers are strictly based on the sample documents sourced form web or any csv/pdf/txt file.

Designed for educational and demonstration purposes; not for clinical use.

Ensure all dependencies are installed and API keys configured before running.

License

MIT License © 2025 Your Name