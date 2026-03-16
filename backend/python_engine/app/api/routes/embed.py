from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1")

MODEL_NAME = "intfloat/e5-small-v2"
_model = None

class Req(BaseModel):
    text: str

def clean_text(t: str) -> str:
    t = t.replace("\n", " ")
    t = " ".join(t.split())
    return t[:2000]

def get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(MODEL_NAME)
        except Exception as e:
            raise RuntimeError(f"Embedding model load failed: {e}")
    return _model

@router.post("/embed")
def embed(req: Req):
    text = clean_text(req.text)
    try:
        model = get_model()
        vec = model.encode([f"query: {text}"], normalize_embeddings=True)[0]
        return {
            "vector": vec.tolist(),
            "model": MODEL_NAME,
            "dim": len(vec),
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
