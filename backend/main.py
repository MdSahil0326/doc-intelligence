from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import PyPDF2
import io
import os
from sqlalchemy.orm import Session
from fastapi import Depends
from database import engine, Base, Document, Chunk, History, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "*","https://doc-intelligence-khaki.vercel.app/"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store replaced by SQLite ──────────────────
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
# ── RAG Helpers ─────────────────────────────────────────────

def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.endswith(".pdf"):
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return file_bytes.decode("utf-8", errors="ignore")


def chunk_text(text: str, size: int = 1500, overlap: int = 200) -> list[str]:
    chunks, i = [], 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += size - overlap
    return chunks


def retrieve_top_chunks(chunks: list[str], query: str, top_k: int = 4) -> list[str]:
    q_words = set(query.lower().split())
    scored = []
    for chunk in chunks:
        words = chunk.lower().split()
        score = sum(1 for w in words if w in q_words)
        scored.append((score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


# ── Routes ──────────────────────────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = extract_text(content, file.filename)
    if not text.strip():
        raise HTTPException(400, "Could not extract text from file.")
    
    # Create document record
    word_count = len(text.split())
    db_doc = Document(filename=file.filename, words=word_count)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # Chunk and save
    new_chunks = chunk_text(text)
    for i, c in enumerate(new_chunks):
        db_chunk = Chunk(document_id=db_doc.id, content=c, chunk_index=i)
        db.add(db_chunk)
    
    db.commit()

    return {
        "filename": db_doc.filename,
        "chunks": len(new_chunks),
        "words": word_count,
    }


@app.post("/clear")
def clear(db: Session = Depends(get_db)):
    db.query(History).delete()
    db.query(Chunk).delete()
    db.query(Document).delete()
    db.commit()
    return {"status": "cleared"}


class QueryRequest(BaseModel):
    question: str
    mode: str  # "qa" | "summarize" | "extract"


@app.post("/query")
def query(req: QueryRequest, db: Session = Depends(get_db)):
    # Get the latest document
    db_doc = db.query(Document).order_by(Document.id.desc()).first()
    if not db_doc:
        raise HTTPException(400, "No document uploaded.")

    # Get chunks for this document
    chunks_records = db.query(Chunk).filter(Chunk.document_id == db_doc.id).order_by(Chunk.chunk_index).all()
    document_chunks = [c.content for c in chunks_records]

    if req.mode == "qa":
        context_chunks = retrieve_top_chunks(document_chunks, req.question)
        system = "You are a precise document analyst. Answer using ONLY the provided context. Be concise. If the answer isn't in the context, say so."
        user_msg = f"Context:\n{'---'.join(context_chunks)}\n\nQuestion: {req.question}"
    elif req.mode == "summarize":
        context_chunks = document_chunks[:6]
        system = "You are an expert summarizer. Create a clear, structured summary with bullet points for key findings."
        user_msg = f"Summarize this document:\n{'---'.join(context_chunks)}"
    else:  # extract
        context_chunks = document_chunks[:6]
        system = "You are an information extraction specialist. Extract key entities, facts, dates, numbers, and important terms in a clean structured format."
        user_msg = f"Extract key information from:\n{'---'.join(context_chunks)}"

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=800,
        )
        answer = response.choices[0].message.content
        
        # Save history
        history_entry = History(
            document_id=db_doc.id,
            mode=req.mode,
            question=req.question if req.mode == "qa" else "",
            answer=answer
        )
        db.add(history_entry)
        db.commit()
        
        return {"answer": answer}
    except Exception as e:
        print(f"ERROR IN QUERY: {e}")
        raise HTTPException(500, str(e))


@app.get("/status")
def status(db: Session = Depends(get_db)):
    db_doc = db.query(Document).order_by(Document.id.desc()).first()
    if not db_doc:
        return {
            "document": "",
            "chunks": 0,
            "ready": False,
        }
        
    chunk_count = db.query(Chunk).filter(Chunk.document_id == db_doc.id).count()
    
    # Load past history
    history_records = db.query(History).filter(History.document_id == db_doc.id).order_by(History.id).all()
    history = [{"mode": h.mode, "q": h.question, "a": h.answer} for h in history_records]
    
    return {
        "document": db_doc.filename,
        "chunks": chunk_count,
        "ready": chunk_count > 0,
        "words": db_doc.words,
        "history": history
    }
