import uvicorn

def main():
    print("==================================================================")
    print("🚀 Starting Uriel AI Engine & API Server on http://127.0.0.1:8000")
    print("⏳ Initializing models & neural vector index (takes ~3-4 seconds)...")
    print("==================================================================")
    uvicorn.run(
        "backend.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
    )

if __name__ == "__main__":
    main()
