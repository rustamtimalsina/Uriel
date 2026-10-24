# backend/app/services/rag_service.py
import json
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any

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
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    return data.get("response", "").strip()
        except Exception as e:
            logger.debug("Ollama not reachable or error: %s", e)
            return None
