from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

MODEL_NAME = "intfloat/e5-small-v2"   # dim=384, rất hợp cho retrieval
model = SentenceTransformer(MODEL_NAME)

class Req(BaseModel):
    text: str

def clean_text(t: str) -> str:
    t = t.replace("\n", " ")
    t = " ".join(t.split())
    return t[:2000]  # giới hạn độ dài chunk

@app.post("/embed")
def embed(req: Req):
    text = clean_text(req.text)
    # e5 khuyến nghị prefix
    vec = model.encode([f"passage: {text}"], normalize_embeddings=True)[0]

    return {
        "vector": vec.tolist(),
        "model": MODEL_NAME,
        "dim": len(vec)
    }

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}