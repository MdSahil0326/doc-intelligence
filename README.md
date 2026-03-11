# Document Intelligence System
RAG-powered document Q&A using FastAPI + React + OpenAI GPT-3.5

## Setup

### 1. Get your FREE OpenAI API key
- Go to https://platform.openai.com/signup
- Sign up → you get $5 free credits (enough for hundreds of queries)
- Go to https://platform.openai.com/api-keys → Create new key
- Copy the key (starts with sk-...)

### 2. Backend (Python / FastAPI)

```bash
cd backend

# Set your API key (Mac/Linux)
export OPENAI_API_KEY=sk-your-key-here

# Set your API key (Windows CMD)
set OPENAI_API_KEY=sk-your-key-here

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn main:app --reload
```
Backend runs at http://localhost:8000

### 3. Frontend (React / Vite)

Open a NEW terminal:

```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:5173

### 4. Open the app
Go to http://localhost:5173 in your browser.

## How to use
1. Upload a .txt, .pdf, or .md file
2. Choose a mode: Q&A, Summarize, or Extract
3. Ask questions or click run
4. Close the app → document is gone (nothing saved to disk)

## Supported file types
- .txt  (plain text)
- .pdf  (PDF documents)
- .md   (markdown files)
- .csv  (CSV data files)
