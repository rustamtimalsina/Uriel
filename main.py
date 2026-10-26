import os
import uvicorn

def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1" if os.name == "nt" and "PORT" not in os.environ else "0.0.0.0")
    is_prod = os.environ.get("ENV", "").lower() == "production" or "PORT" in os.environ

    print("==================================================================")
    print(f"🚀 Starting Uriel on http://{host}:{port}")
    if not is_prod:
        print("⏳ Initializing models & neural vector index (takes ~3-4 seconds)...")
    print("==================================================================")
    uvicorn.run(
        "backend.app.main:app",
        host=host,
        port=port,
        reload=not is_prod,
        reload_dirs=["backend"] if not is_prod else None,
    )

if __name__ == "__main__":
    main()
