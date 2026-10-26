# backend/app/schemas/chat.py
from pydantic import BaseModel
from typing import Optional
from backend.app.schemas.search import SearchResponse

class ChatMessageCreate(BaseModel):
    content: str
    top_k: int = 3
    model: Optional[str] = None

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ChatMessageOut(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    sources: list[SearchResponse] = []
    model_used: Optional[str] = None
    created_at: str

class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str

class ChatSessionDetailOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str
    messages: list[ChatMessageOut]
