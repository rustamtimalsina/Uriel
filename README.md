<h3 align="center">
	<img src="./resources/images/Github_Placeholder.png" width="200" alt="Logo"/><br/>
	<b>Uriel</b>: Local Contextual Document Retrieval System
</h3> 
<p align="center">
	<a href="https://hub.docker.com/r/itsuren/uriel/tags">
		<img alt="Releases" src="https://img.shields.io/docker/v/itsuren/uriel?style=for-the-badge&logo=docker&color=0db7ed&logoColor=white"/></a>
	<a href="https://github.com/itsuren/uriel/issues">
		<img alt="Issues" src="https://img.shields.io/github/issues/itsuren/uriel?style=for-the-badge&logo=gitbook&color=B5E8E0&logoColor=D9E0EE&labelColor=302D41"></a>
</p>
<p align="center">
	<a href="https://www.python.org/downloads/release/python-31020/"><img src="https://img.shields.io/badge/python-3.10-blue.svg" /> </a>
	<a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-backend-009688.svg" /> </a>
	<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" /> </a>
</p> 
&nbsp;
      
<p align="center"> <b>Uriel</b>: Local Contextual Document Retrieval System is a sytem based on the concepts of Information Retrieval, making use of <b>TF-IDF</b> and <b>BM25</b> algorithms to enhance local document search through the incorporation of the content and context besides the conventional file names.  </p>

## 📖 Table of Contents
- [🧩 Prerequisites](#-prerequisites)
- [📦 Installation](#-installation)
	- [Backend](#backend)
	- [Fronted](#frontend)
- [▶️ Running the App](#️-running-the-app)
- [🌐 API Reference](#-api-reference)
- [🏛️ Project Architecture](#️-project-architecture)

---

&nbsp;
## 🧩 Prerequisites

This project uses [`uv`](https://docs.astral.sh/uv/) for Python environment and dependency management.

**Linux / macOS**
 
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
 
**Windows**
 
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```
 
> [!NOTE]
> The Python version must support `sqlite3`. This project pins Python 3.10 via [`.python-version`](.python-version).
 
---

&nbsp;
## 📦 Installation
All commands below assume your worknig directory is the **project root** unless noted otherwise.

### Backend
Install the pinned Python version (`uv` reads it from `.python-version` file):

```bash
uv python install
```

Create a virtual environment:
```bash
uv venv
```

Install project dependencies:
```bash
uv sync
```

### Frontend
In a Separate terminal":
```bash
cd frontend
npm install
```

---

&nbsp;
## ▶️ Running the App
### Backend
From the project root:
```bash
uvicorn backend.app.main:app
```

### Frontend
In a separate terminal:
```bash
cd frontend
npm run dev
```

---

&nbsp;
## 🌐 API Reference
FastAPI ships with an interactive API explorer
1. Start the backend (see above) and check the terminal for the port it's running on (defaults to `8000`).
2. Open the app in your browser:

```
	http://locahost:8000
```

3. Append `\docs` to reach the interactive Swagger UI:

```
	http://localhost:8000/docs
```

The endpoints are grouped into four routers: `search`, `index`, `config`, and `documents`. Full request/response schemas are available live in `/docs`

---

&nbsp;
## 🏛️ Project Architecture 
> [!WARNING]
> This project is still under development and a significant functional parts are as of yet not implemented.

Project Architecture is based on Modern Information Retrieval Systems Architecture.

<figure style="display:flex; flex-direction: column; align-items: center;">
    <img src="./resources/images/Retrieval_Process.svg" width="500px">
    <figcaption> figure 1: System Architecture adapated from Modern Information Retrieval</figcaption>
</figure>

&nbsp;
### 🤔 Project Come To Be

- **Academic Project**: Learning by implementing the features of python libraries.

&nbsp;

### ❤️ Contributors

Thanks for making this project possible:

| <img alt="Issues" src="https://avatars.githubusercontent.com/u/42739895?v=4" width="25" height="25"> | <a href="https://github.com/ITSUREN">Saugat Tamang</a> |
|----------------|----------------|
| <img alt="Issues" src="https://avatars.githubusercontent.com/u/169548880?v=4" width="25" height="25"> | <a href="https://github.com/rustamtimalsina">Rustam Timalsina</a> |
| <img alt="Issues" src="https://avatars.githubusercontent.com/u/123376105?v=4" width="25" height="25"> | <a href="https://github.com/Sparsha2004">Sparsha Poudel</a> |

&nbsp;

### 📜 License

Uriel is released under the [MIT license](./LICENSE.txt), which grants the following permissions:

- Commercial use
- Distribution
- Modification
- Private use


