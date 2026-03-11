import { useState, useRef, useEffect } from "react";

const API = "https://doc-intelligence-backend-91qv.onrender.com";

export default function App() {
  const [docInfo, setDocInfo] = useState(null);
  const [mode, setMode] = useState("qa");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  const chatRef = useRef();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API}/status`);
        const data = await res.json();
        if (data.ready) {
          setDocInfo({
            filename: data.document,
            chunks: data.chunks,
            words: data.words || 0
          });
          if (data.history) setHistory(data.history);
        }
      } catch (e) {
        console.error("Could not fetch status:", e);
      }
    };
    fetchStatus();
  }, []);

  const uploadFile = async (file) => {
    console.log("Starting upload for file:", file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      console.log("Sending fetch request to", `${API}/upload`);
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      console.log("Response status:", res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Upload failed with response:", errorText);
        throw new Error(`Upload failed: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      console.log("Upload success, data:", data);
      setDocInfo(data);
      setHistory([]);
    } catch (e) {
      console.error("Caught error during upload:", e);
      alert(`Error uploading file:\n${e.message}\n\nPlease make sure the backend is running and the file is valid.`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleRun = async () => {
    if (!docInfo || loading) return;
    if (mode === "qa" && !question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question || "", mode }),
      });
      const data = await res.json();
      setHistory((h) => [...h, { mode, q: question, a: data.answer }]);
      setQuestion("");
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
    } catch {
      setHistory((h) => [...h, { mode, q: question, a: "Error reaching backend. Is it running?" }]);
    }
    setLoading(false);
  };

  const clearDoc = async () => {
    await fetch(`${API}/clear`, { method: "POST" });
    setDocInfo(null);
    setHistory([]);
  };

  return (
    <div style={css.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={css.header}>
        <div style={css.logo}>DI</div>
        <span style={css.title}>DOCUMENT INTELLIGENCE</span>
        <span style={css.pill}>LOCAL · FREE · RAG</span>
      </div>

      <div style={css.body}>
        {/* Sidebar */}
        <div style={css.sidebar}>

          {/* Upload */}
          <div style={css.section}>
            <div style={css.label}>DOCUMENT</div>
            <div
              style={{ ...css.dropzone, borderColor: dragging ? "#e8ff47" : "#2a2a2a", background: dragging ? "#1a1f00" : "transparent" }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
            >
              <div style={{ fontSize: 24 }}>⬆</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>Drop file or click</div>
              <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>.txt · .pdf · .md</div>
              <input ref={fileRef} type="file" accept=".txt,.pdf,.md,.csv" hidden
                onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])} />
            </div>

            {docInfo && (
              <div style={css.docBadge}>
                <div style={{ color: "#e8ff47", marginBottom: 4 }}>📄 {docInfo.filename}</div>
                <div style={{ color: "#666", fontSize: 10 }}>{docInfo.chunks} chunks · ~{docInfo.words.toLocaleString()} words</div>
                <button style={css.clearBtn} onClick={clearDoc}>✕ Clear</button>
              </div>
            )}
          </div>

          {/* Mode */}
          <div style={css.section}>
            <div style={css.label}>MODE</div>
            {["qa", "summarize", "extract"].map((m) => (
              <button key={m} style={{ ...css.modeBtn, ...(mode === m ? css.modeBtnActive : {}) }}
                onClick={() => setMode(m)}>
                {m === "qa" ? "💬 Q&A" : m === "summarize" ? "📝 Summarize" : "🔍 Extract"}
              </button>
            ))}
          </div>

          {/* RAG info */}
          <div style={css.ragBox}>
            <div style={{ color: "#e8ff47", fontSize: 10, marginBottom: 8, letterSpacing: "0.1em" }}>HOW RAG WORKS</div>
            <div style={{ color: "#555", fontSize: 10, lineHeight: 1.8 }}>
              1. Doc → chunked & saved to DB<br />
              2. Your question → scored vs chunks<br />
              3. Top chunks → sent to GPT<br />
              4. Answer returned to you<br />
              <span style={{ color: "#333" }}>Saved securely in local SQLite ✓</span>
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={css.main}>
          <div ref={chatRef} style={css.chat}>
            {!docInfo ? (
              <div style={css.empty}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
                <div style={{ color: "#555", fontSize: 13, lineHeight: 1.8 }}>
                  Upload a document to begin.<br />
                  Everything stays in memory —<br />
                  gone when you close the app.
                </div>
              </div>
            ) : history.length === 0 ? (
              <div style={css.empty}>
                <div style={{ color: "#333", fontSize: 13 }}>
                  Document ready. Ask a question or run Summarize / Extract.
                </div>
              </div>
            ) : (
              history.map((item, i) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  {item.q && <div style={css.bubbleQ}>{item.q}</div>}
                  <div style={css.bubbleA}>{item.a}</div>
                </div>
              ))
            )}
            {loading && (
              <div style={{ color: "#444", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>
                Retrieving chunks · Querying GPT...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={css.inputRow}>
            {mode === "qa" ? (
              <input
                style={css.input}
                placeholder={docInfo ? "Ask a question about your document..." : "Upload a document first..."}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
                disabled={!docInfo}
              />
            ) : (
              <div style={{ ...css.input, color: "#444", fontSize: 12, display: "flex", alignItems: "center" }}>
                {mode === "summarize" ? "Will summarize the document →" : "Will extract key entities & facts →"}
              </div>
            )}
            <button
              style={{ ...css.runBtn, opacity: (!docInfo || loading) ? 0.4 : 1 }}
              onClick={handleRun}
              disabled={!docInfo || loading}
            >
              {loading ? "..." : mode === "qa" ? "ASK →" : mode === "summarize" ? "SUMMARIZE →" : "EXTRACT →"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>
    </div>
  );
}

const css = {
  app: { minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column" },
  header: { borderBottom: "1px solid #1a1a1a", padding: "16px 28px", display: "flex", alignItems: "center", gap: 14 },
  logo: { width: 28, height: 28, background: "#e8ff47", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 900, fontSize: 13 },
  title: { fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" },
  pill: { marginLeft: "auto", fontSize: 10, color: "#333", background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: "4px 12px", letterSpacing: "0.08em" },
  body: { display: "flex", flex: 1, height: "calc(100vh - 57px)" },
  sidebar: { width: 240, borderRight: "1px solid #1a1a1a", padding: 18, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 9, color: "#333", letterSpacing: "0.12em" },
  dropzone: { border: "1.5px dashed #2a2a2a", borderRadius: 8, padding: "20px 12px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" },
  docBadge: { background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "10px 12px", fontSize: 11 },
  clearBtn: { marginTop: 8, background: "transparent", border: "1px solid #2a2a2a", color: "#555", borderRadius: 4, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" },
  modeBtn: { background: "transparent", border: "1px solid #1e1e1e", color: "#555", borderRadius: 6, padding: "8px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" },
  modeBtnActive: { border: "1px solid #e8ff47", color: "#e8ff47", background: "#0d1200" },
  ragBox: { marginTop: "auto", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 6, padding: "12px 14px" },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  chat: { flex: 1, overflowY: "auto", padding: "28px 32px" },
  empty: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" },
  bubbleQ: { background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#e8ff47", marginBottom: 10, alignSelf: "flex-end", maxWidth: "80%", marginLeft: "auto" },
  bubbleA: { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "14px 16px", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#ccc" },
  inputRow: { borderTop: "1px solid #1a1a1a", padding: "14px 24px", display: "flex", gap: 10 },
  input: { flex: 1, background: "#111", border: "1px solid #1e1e1e", borderRadius: 7, padding: "10px 14px", color: "#f0f0f0", fontSize: 12, fontFamily: "inherit", outline: "none" },
  runBtn: { background: "#e8ff47", color: "#000", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", whiteSpace: "nowrap", transition: "opacity 0.15s" },
};
