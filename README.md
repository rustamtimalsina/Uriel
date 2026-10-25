<h1 align="center">
  <b>URIEL PRO</b>
</h1>
<p align="center">
  <b>Enterprise-Grade, Privacy-First Local Neural Search & Retrieval-Augmented Generation (RAG)</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10-3776AB.svg?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Vite-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Ollama_LLM-000000.svg?style=for-the-badge&logo=ollama&logoColor=white" />
  <img src="https://img.shields.io/badge/FastEmbed-MiniLM--L6-8A2BE2.svg?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" />
</p>

---

## ⚡ What is Uriel?

**Uriel** is an on-premise, zero-cloud neural knowledge management platform. It combines sub-millisecond probabilistic keyword retrieval with dense semantic vector embeddings and local on-device generative LLMs — allowing users and teams to search, inspect, and converse with their document vaults with **complete privacy**.

---

## 🚀 Key Features

- 🧠 **Hybrid Neural Search (BM25 + Dense Vectors)**: Merges exact term match precision with dense contextual understanding using **FastEmbed ONNX (`all-MiniLM-L6-v2`)** and **Reciprocal Rank Fusion (RRF)**:
  $$RRF(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
- 🤖 **On-Device Generative RAG**: Integrated directly with local **Ollama (`llama3.2`)** for synthesized answers with clickable source document citations. Zero cloud data egress.
- ⚡ **Real-Time Live File Watcher**: Powered by `watchdog`. Drop any file into your workspace folder and it is parsed, embedded, and indexed automatically in the background within seconds.
- 📁 **Document Vault & Drag-and-Drop Ingestion**: Interactive web dashboard to drag-and-drop `.pdf`, `.docx`, `.txt`, `.md`, and `.csv` files directly from the browser.
- 👁️ **IDE-Grade Document Canvas**: Embedded responsive PDF viewer alongside a dark code/document reader with line numbers, search-in-doc filters, and metadata chips.
- 📊 **IR Analytics & Algorithm Benchmark Simulator**: Interactive dashboard comparing retrieval latency and scoring across Hybrid, BM25, Semantic, and TF-IDF engines.
- ⌨️ **Keyboard-First Workflow**: Instant focus via `Ctrl+K` or `/` and quick keyboard navigation.
- 🐳 **Production Docker Ready**: Complete containerization with `docker-compose.yml`.

---

## 🏁 Quick Start

### 1. One-Click Launch (Windows)
Double-click `run.bat` or run in PowerShell:
```powershell
.\run.ps1
```
*Automatically launches the FastAPI backend on port 8000, Vite frontend on port 5173, and opens your browser.*

### 2. Manual Setup

#### Backend
```bash
# Install uv package manager (if not installed)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Install Python & sync environment
uv sync

# Run backend server
uv run python main.py
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Local LLM (Ollama)
```bash
# Pull lightweight 3.2B model
ollama pull llama3.2
```

---

## 🐳 Docker Deployment

```bash
docker compose up --build
```
Access the application at `http://localhost:5173`.

---

## 🏛️ Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Client (Vite React + Glass UI)    │
                      └──────────────────┬───────────────────┘
                                         │ REST API / WebSocket
                      ┌──────────────────▼───────────────────┐
                      │        FastAPI Application Core       │
                      └───────┬───────────────┬──────────────┘
                              │               │
            ┌─────────────────▼─────┐   ┌─────▼────────────────┐
            │   Parser & Extraction  │   │  Live File Watcher   │
            │ (PDF, DOCX, TXT, CSV)  │   │     (watchdog)       │
            └─────────┬─────────────┘   └──────────────────────┘
                      │
     ┌────────────────┴──────────────────┐
     ▼                                   ▼
┌─────────────────────────┐   ┌──────────────────────────────┐
│  Inverted Index (BM25)  │   │ FastEmbed Dense Embeddings   │
│  (SQLite Lexicon/Post)  │   │ (MiniLM-L6-v2 384-dim Vector)│
└────────────┬────────────┘   └──────────────┬───────────────┘
             │                               │
             └───────────────┬───────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Reciprocal Rank Fusion Ranker│
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │   Local Ollama RAG Engine   │
              │     (llama3.2 Synthesizer)  │
              └─────────────────────────────┘
```

---

## 🧪 Testing

Comprehensive unit, integration, and end-to-end system test suites:
```bash
uv run pytest
```
*Current test suite: **62 passed in ~19s, 0 warnings**.*

---

## 📄 License
MIT License. Created by [Rustam Timalsina](https://github.com/rustamtimalsina).
