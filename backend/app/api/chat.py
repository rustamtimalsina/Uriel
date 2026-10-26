# backend/app/api/chat.py
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from backend.app.schemas.chat import (
    ChatMessageCreate, ChatMessageOut, ChatSessionCreate, ChatSessionOut, ChatSessionDetailOut
)
from backend.app.schemas.search import SearchResponse
from backend.app.services.rag_service import RAGService
from backend.app.storage.sqlite_repository import SQLiteChatRepository
from backend.app.api.deps import get_rag_service, get_chat_repository

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/sessions", response_model=list[ChatSessionOut])
def list_sessions(repo: SQLiteChatRepository = Depends(get_chat_repository)):
    return repo.list_sessions()

@router.post("/sessions", response_model=ChatSessionDetailOut)
def create_session(data: ChatSessionCreate = None, repo: SQLiteChatRepository = Depends(get_chat_repository)):
    title = data.title if data and data.title else "New Conversation"
    session = repo.create_session(title)
    return session

@router.get("/sessions/{session_id}", response_model=ChatSessionDetailOut)
def get_session(session_id: int, repo: SQLiteChatRepository = Depends(get_chat_repository)):
    session = repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session with ID {session_id} not found.")
    return session

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, repo: SQLiteChatRepository = Depends(get_chat_repository)):
    repo.delete_session(session_id)
    return {"message": "Session deleted successfully."}

@router.post("/sessions/{session_id}/message", response_model=ChatMessageOut)
def send_message(
    session_id: int,
    data: ChatMessageCreate,
    repo: SQLiteChatRepository = Depends(get_chat_repository),
    rag: RAGService = Depends(get_rag_service),
):
    session = repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session with ID {session_id} not found.")

    # 1. Save user message
    repo.add_message(session_id, role="user", content=data.content)

    # 2. Update session title if this is the first user message
    if len(session.get("messages", [])) == 0 or session.get("title") == "New Conversation":
        auto_title = data.content[:35] + ("..." if len(data.content) > 35 else "")
        repo.update_session_title(session_id, auto_title)

    # 3. Pull refreshed history including user message
    updated_session = repo.get_session(session_id)
    history = updated_session.get("messages", [])

    # 4. Invoke multi-turn RAG reasoning
    rag_result = rag.chat(history, top_k=data.top_k, model=data.model)

    # 5. Save assistant reply
    assistant_msg = repo.add_message(
        session_id=session_id,
        role="assistant",
        content=rag_result["answer"],
        sources=rag_result.get("sources", []),
        model=rag_result.get("model_used"),
    )

    return ChatMessageOut(
        id=assistant_msg["id"],
        session_id=session_id,
        role="assistant",
        content=assistant_msg["content"],
        sources=[SearchResponse(**s) for s in assistant_msg.get("sources", [])],
        model_used=assistant_msg.get("model_used"),
        created_at=assistant_msg["created_at"],
    )


@router.post("/sessions/{session_id}/message/stream")
def stream_message(
    session_id: int,
    data: ChatMessageCreate,
    repo: SQLiteChatRepository = Depends(get_chat_repository),
    rag: RAGService = Depends(get_rag_service),
):
    session = repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session with ID {session_id} not found.")

    # 1. Save user message
    repo.add_message(session_id, role="user", content=data.content)

    # 2. Update session title if this is the first user message
    if len(session.get("messages", [])) == 0 or session.get("title") == "New Conversation":
        auto_title = data.content[:35] + ("..." if len(data.content) > 35 else "")
        repo.update_session_title(session_id, auto_title)

    # 3. Pull refreshed history
    updated_session = repo.get_session(session_id)
    history = updated_session.get("messages", [])

    def event_generator():
        saved_sources = []
        model_name = data.model
        for event in rag.stream_chat(history, top_k=data.top_k, model=data.model):
            event_type = event.get("type")
            if event_type == "sources":
                saved_sources = event.get("sources", [])
                model_name = event.get("model")
            elif event_type == "done":
                full_content = event.get("full_content", "")
                saved_sources = event.get("sources", saved_sources)
                model_name = event.get("model", model_name)
                saved_msg = repo.add_message(
                    session_id=session_id,
                    role="assistant",
                    content=full_content,
                    sources=saved_sources,
                    model=model_name,
                )
                event["id"] = saved_msg["id"]
            
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
