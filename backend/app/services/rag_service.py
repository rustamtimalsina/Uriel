# backend/app/services/rag_service.py
import json
import logging
import time
import urllib.request
import urllib.error
from typing import List, Dict, Any, Iterator

from backend.app.services.search_service import SearchService
from backend.app.algorithms.ranking_factory import RankingAlgorithmType

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self, search_service: SearchService, ollama_url: str = "http://localhost:11434", default_model: str = "llama3.2"):
        self.search_service = search_service
        self.ollama_url = ollama_url.rstrip("/")
        self.default_model = default_model

    def ask(self, question: str, top_k: int = 3, model: str | None = None) -> Dict[str, Any]:
        """
        Retrieval-Augmented Generation:
        1. Retrieve top matching document passages using Hybrid search.
        2. Format context with source citations.
        3. Query local LLM (Ollama) or generate structured synthesis with citations.
        """
        # Step 1: Retrieve context
        results, _ = self.search_service.search(
            query=question,
            algorithm=RankingAlgorithmType.HYBRID,
            top_k=top_k,
        )

        sources = [
            {
                "doc_id": r.doc_id,
                "title": r.title,
                "path": r.path,
                "snippet": r.snippet,
                "score": round(r.score, 4),
            }
            for r in results
        ]

        if not sources:
            return {
                "answer": "No relevant documents found in your indexed files to answer this question.",
                "sources": [],
                "model_used": "none",
            }

        # Step 2: Build prompt context
        context_blocks = []
        for i, s in enumerate(sources, 1):
            clean_snippet = s["snippet"].replace("<mark>", "").replace("</mark>", "")
            context_blocks.append(f"Source [{i}] ({s['title']}):\n{clean_snippet}")

        context_str = "\n\n".join(context_blocks)
        prompt = (
            f"You are Uriel AI, an intelligent assistant for local document retrieval.\n"
            f"Answer the user's question based ONLY on the following extracted document passages.\n"
            f"Always cite the source number (e.g. [1]) when referencing facts.\n\n"
            f"Context:\n{context_str}\n\n"
            f"Question: {question}\n\n"
            f"Answer:"
        )

        chosen_model = model or self.default_model

        # Step 3: Attempt local Ollama inference
        llm_response = self._call_ollama(prompt, chosen_model)
        if llm_response:
            return {
                "answer": llm_response,
                "sources": sources,
                "model_used": chosen_model,
            }

        # Fallback if Ollama is not running: Extractive synthesis with citations
        fallback_answer = (
            f"### Key Findings from your documents:\n\n"
            + "\n\n".join(
                f"- **{s['title']}** (Source [{i+1}]): {s['snippet'].replace('<mark>', '**').replace('</mark>', '**')}"
                for i, s in enumerate(sources)
            )
            + "\n\n*(Connect Ollama on `localhost:11434` for full generative synthesis)*"
        )

        return {
            "answer": fallback_answer,
            "sources": sources,
            "model_used": "extractive-fallback",
        }

    def chat(self, conversation_history: list[dict], top_k: int = 3, model: str | None = None) -> Dict[str, Any]:
        """
        Multi-turn RAG chat with conversation memory.
        """
        if not conversation_history:
            return {"answer": "How can I help you with your documents?", "sources": [], "model_used": "none"}

        latest_user_message = conversation_history[-1].get("content", "")

        # Step 1: Retrieve context based on the latest question
        results, _ = self.search_service.search(
            query=latest_user_message,
            algorithm=RankingAlgorithmType.HYBRID,
            top_k=top_k,
        )

        sources = [
            {
                "doc_id": r.doc_id,
                "title": r.title,
                "path": r.path,
                "snippet": r.snippet,
                "score": round(r.score, 4),
            }
            for r in results
        ]

        # Step 2: Build prompt context
        context_blocks = []
        for i, s in enumerate(sources, 1):
            clean_snippet = s["snippet"].replace("<mark>", "").replace("</mark>", "")
            context_blocks.append(f"Source [{i}] ({s['title']}):\n{clean_snippet}")

        context_str = "\n\n".join(context_blocks) if context_blocks else "No relevant documents found."

        # Format conversation turns
        history_lines = []
        for turn in conversation_history[-6:-1]:
            role_label = "User" if turn.get("role") == "user" else "Assistant"
            history_lines.append(f"{role_label}: {turn.get('content', '')}")
        history_str = "\n".join(history_lines)

        prompt = (
            "You are Uriel AI, an intelligent workspace assistant for local document retrieval.\n"
            "Answer the user's question accurately using the provided document passages and conversational context.\n"
            "Always cite source numbers (e.g. [1]) when referencing facts from the context.\n\n"
            f"Context Passages:\n{context_str}\n\n"
        )
        if history_str:
            prompt += f"Recent Conversation:\n{history_str}\n\n"

        prompt += f"User: {latest_user_message}\n\nAssistant Answer:"

        chosen_model = model or self.default_model
        llm_response = self._call_ollama(prompt, chosen_model)
        if llm_response:
            return {
                "answer": llm_response,
                "sources": sources,
                "model_used": chosen_model,
            }

        # Fallback if Ollama is not running
        fallback = self.ask(latest_user_message, top_k=top_k, model=model)
        return fallback

    def _call_ollama(self, prompt: str, model: str) -> str | None:
        try:
            req_data = json.dumps({
                "model": model,
                "prompt": prompt,
                "stream": False,
            }).encode("utf-8")

            req = urllib.request.Request(
                f"{self.ollama_url}/api/generate",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=45) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    return data.get("response", "").strip()
        except Exception as e:
            logger.debug("Ollama not reachable or error: %s", e)
            return None

    def _stream_ollama(self, prompt: str, model: str) -> Iterator[str]:
        """
        Yields raw text tokens from Ollama streaming API.
        """
        try:
            req_data = json.dumps({
                "model": model,
                "prompt": prompt,
                "stream": True,
            }).encode("utf-8")

            req = urllib.request.Request(
                f"{self.ollama_url}/api/generate",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=90) as response:
                for line in response:
                    if not line:
                        continue
                    try:
                        payload = json.loads(line.decode("utf-8"))
                        token = payload.get("response", "")
                        if token:
                            yield token
                        if payload.get("done", False):
                            break
                    except Exception:
                        continue
        except Exception as e:
            logger.debug("Ollama streaming error: %s", e)
            return

    def stream_chat(
        self,
        conversation_history: list[dict],
        top_k: int = 3,
        model: str | None = None,
    ) -> Iterator[dict]:
        """
        Generator yielding streaming events:
        - {"type": "sources", "sources": [...], "model": chosen_model}
        - {"type": "token", "token": "..."}
        - {"type": "done", "full_content": "...", "sources": [...], "model": chosen_model}
        """
        if not conversation_history:
            yield {"type": "done", "full_content": "How can I help you with your documents?", "sources": [], "model": "none"}
            return

        latest_user_message = conversation_history[-1].get("content", "")

        # 1. Retrieve context
        results, _ = self.search_service.search(
            query=latest_user_message,
            algorithm=RankingAlgorithmType.HYBRID,
            top_k=top_k,
        )

        sources = [
            {
                "doc_id": r.doc_id,
                "title": r.title,
                "path": r.path,
                "snippet": r.snippet,
                "score": round(r.score, 4),
            }
            for r in results
        ]

        chosen_model = model or self.default_model

        # Emit sources early so frontend renders citation pills immediately
        yield {"type": "sources", "sources": sources, "model": chosen_model}

        context_blocks = []
        for i, s in enumerate(sources, 1):
            clean_snippet = s["snippet"].replace("<mark>", "").replace("</mark>", "")
            context_blocks.append(f"Source [{i}] ({s['title']}):\n{clean_snippet}")

        context_str = "\n\n".join(context_blocks) if context_blocks else "No relevant documents found."

        history_lines = []
        for turn in conversation_history[-6:-1]:
            role_label = "User" if turn.get("role") == "user" else "Assistant"
            history_lines.append(f"{role_label}: {turn.get('content', '')}")
        history_str = "\n".join(history_lines)

        prompt = (
            "You are Uriel AI, an intelligent workspace assistant for local document retrieval.\n"
            "Answer the user's question accurately using the provided document passages and conversational context.\n"
            "Always cite source numbers (e.g. [1]) when referencing facts from the context.\n\n"
            f"Context Passages:\n{context_str}\n\n"
        )
        if history_str:
            prompt += f"Recent Conversation:\n{history_str}\n\n"

        prompt += f"User: {latest_user_message}\n\nAssistant Answer:"

        # Stream from Ollama
        accumulated_chunks = []
        streamed_any = False
        for token in self._stream_ollama(prompt, chosen_model):
            streamed_any = True
            accumulated_chunks.append(token)
            yield {"type": "token", "token": token}

        if streamed_any:
            full_text = "".join(accumulated_chunks).strip()
            yield {
                "type": "done",
                "full_content": full_text,
                "sources": sources,
                "model": chosen_model,
            }
            return

        # Fallback if Ollama is offline or produced no tokens
        fallback = self.ask(latest_user_message, top_k=top_k, model=model)
        fallback_text = fallback.get("answer", "")
        # Stream fallback in natural word-sized chunks
        for word in fallback_text.split(" "):
            yield {"type": "token", "token": word + " "}
            time.sleep(0.015)

        yield {
            "type": "done",
            "full_content": fallback_text,
            "sources": sources,
            "model": fallback.get("model_used", "extractive-fallback"),
        }

    def summarize_document(self, title: str, text: str, model: str | None = None) -> Dict[str, Any]:
        """
        Generates a concise 3-bullet executive briefing of the document.
        """
        chosen_model = model or self.default_model
        words = text.split()[:1400]
        sample_text = " ".join(words)

        prompt = (
            f"You are an expert executive document analyst.\n"
            f"Analyze this document titled '{title}'.\n\n"
            f"Document Content:\n{sample_text}\n\n"
            f"Provide an executive briefing in exactly this format:\n"
            f"### Executive Overview\n(2 sentences summarizing the core purpose and findings)\n\n"
            f"### Key Takeaways\n- Point 1\n- Point 2\n- Point 3\n"
        )

        llm_response = self._call_ollama(prompt, chosen_model)
        if llm_response:
            return {
                "summary": llm_response,
                "model_used": chosen_model,
            }

        # Extractive fallback
        sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 35]
        top_points = sentences[:3] if len(sentences) >= 3 else [text[:200]]
        fallback = (
            f"### Executive Overview\nKey excerpts extracted from {title}.\n\n"
            f"### Key Takeaways\n" + "\n".join(f"- {p.strip()}." for p in top_points)
        )
        return {
            "summary": fallback,
            "model_used": "extractive-fallback",
        }
