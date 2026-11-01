from fastapi import APIRouter # Chuyển sang Router
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

router = APIRouter(prefix="/api/v1") # Thêm prefix để thống nhất

MODEL_NAME = "intfloat/e5-small-v2"
model = SentenceTransformer(MODEL_NAME)

class Req(BaseModel):
    text: str

def clean_text(t: str) -> str:
    t = t.replace("\n", " ")
    t = " ".join(t.split())
    return t[:2000]

@router.post("/embed") # Đổi app.post thành router.post
def embed(req: Req):
    text = clean_text(req.text)
    # TỐI ƯU: Sử dụng "query:" cho câu hỏi từ chatbot để retrieval tốt hơn
    vec = model.encode([f"query: {text}"], normalize_embeddings=True)[0]

    return {
        "vector": vec.tolist(),
        "model": MODEL_NAME,
        "dim": len(vec)
    }