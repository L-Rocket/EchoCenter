import asyncio
import websockets
import json
import os
import psutil
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from backend/.env
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, "..", ".env")
load_dotenv(dotenv_path=env_path)

# --- Configuration ---
ECHOCENTER_WS_URL = "ws://localhost:8080/api/ws"
# The API Key for LLM reasoning (using the same as Butler)
LLM_API_KEY = os.getenv("BUTLER_API_TOKEN") 
LLM_BASE_URL = os.getenv("BUTLER_BASE_URL")
LLM_MODEL = os.getenv("BUTLER_MODEL", "gpt-3.5-turbo")

if not LLM_API_KEY:
    print("Error: BUTLER_API_TOKEN not found in environment or .env file.")
    exit(1)

# This is where we store our files
STORAGE_DIR = os.path.join(script_dir, "hive_storage")
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)

client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)

SYSTEM_PROMPT = """You are 'Storage-Custodian', the expert manager of the EchoCenter Hive Storage.
Your persona: Efficient, slightly obsessive-compulsive about organization, and highly professional.
Your scope: You ONLY know about files, disk space, and I/O. You do not know about weather or code.
Context: You are currently monitoring the directory: {path}.
When asked about storage status, use the REAL data provided in the prompt.
Be concise and use storage-related terminology.
"""

def get_storage_stats():
    files = []
    total_size = 0
    for f in os.listdir(STORAGE_DIR):
        fp = os.path.join(STORAGE_DIR, f)
        if os.path.isfile(fp):
            size = os.path.getsize(fp)
            mtime = os.path.getmtime(fp)
            files.append({
                "name": f,
                "size_kb": round(size / 1024, 2),
                "modified": datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            })
            total_size += size
    
    disk = psutil.disk_usage(STORAGE_DIR)
    return {
        "files": files,
        "total_files": len(files),
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "disk_percent": disk.percent
    }

async def agent_loop(token):
    uri = f"{ECHOCENTER_WS_URL}?token={token}"
    async with websockets.connect(uri) as ws:
        print(f"[Storage-Custodian] Connected to EchoCenter as functional Agent.")
        
        # 1. Send initial online log
        stats = get_storage_stats()
        await ws.send(json.dumps({
            "type": "SYSTEM_LOG",
            "payload": {
                "level": "SUCCESS",
                "content": f"Storage-Custodian initialized. Monitoring {STORAGE_DIR}. {stats['total_files']} files detected."
            }
        }))

        # 2. Main loop
        async for message in ws:
            data = json.loads(message)
            if data.get("type") == "CHAT":
                sender_id = data.get("sender_id")
                sender_role = data.get("sender_role", "USER")
                payload = data.get("payload")
                print(f"[Storage-Custodian] Received instruction from {sender_role}: {payload}")

                # Gather REAL data
                current_stats = get_storage_stats()
                
                # Ask LLM for a response based on persona and real data
                prompt = f"""Current Real Data: {json.dumps(current_stats)}

User Instruction: {payload}"""
                
                stream_id = data.get("stream_id", f"stream_{datetime.now().timestamp()}")
                
                try:
                    response = client.chat.completions.create(
                        model=LLM_MODEL,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT.format(path=STORAGE_DIR)},
                            {"role": "user", "content": prompt}
                        ],
                        stream=True
                    )
                    
                    full_reply = ""
                    for chunk in response:
                        if chunk.choices[0].delta.content:
                            content = chunk.choices[0].delta.content
                            full_reply += content
                            
                            # Only stream if sender is a human USER
                            if sender_role == "USER":
                                await ws.send(json.dumps({
                                    "type": "CHAT_STREAM",
                                    "target_id": sender_id,
                                    "payload": content,
                                    "stream_id": stream_id,
                                    "sender_id": 7,
                                    "sender_name": "Storage-Custodian",
                                    "sender_role": "AGENT"
                                }))
                    
                    if sender_role == "BUTLER":
                        # Direct full reply to Butler for better efficiency
                        await ws.send(json.dumps({
                            "type": "CHAT",
                            "target_id": sender_id,
                            "payload": full_reply,
                            "sender_id": 7,
                            "sender_name": "Storage-Custodian",
                            "sender_role": "AGENT"
                        }))
                    else:
                        # End of stream for human users
                        await ws.send(json.dumps({
                            "type": "CHAT_STREAM_END",
                            "target_id": sender_id,
                            "stream_id": stream_id,
                            "sender_id": 7,
                            "sender_name": "Storage-Custodian",
                            "sender_role": "AGENT"
                        }))

                except Exception as e:
                    error_msg = f"Error accessing my logic core: {str(e)}"
                    await ws.send(json.dumps({
                        "type": "CHAT",
                        "target_id": sender_id,
                        "payload": error_msg
                    }))
                
                # Also log the action to the dashboard
                await ws.send(json.dumps({
                    "type": "SYSTEM_LOG",
                    "payload": {
                        "level": "INFO",
                        "content": f"Storage report delivered to sender {sender_id}."
                    }
                }))

if __name__ == "__main__":
    token_from_env = os.getenv("STORAGE_CUSTODIAN_TOKEN") or os.getenv("AGENT_API_TOKEN")
    if token_from_env:
        print("[Storage-Custodian] Using token from environment variable.")
        asyncio.run(agent_loop(token_from_env))
        exit(0)

    # We need to get the token for Storage-Custodian from the DB
    import sqlite3
    
    # Try to get DB path from environment, default to standard location
    env_db_path = os.getenv("DB_PATH", "./data/echo_center.db")
    
    if os.path.isabs(env_db_path):
        db_path = env_db_path
    else:
        # If relative, it's relative to backend/ (root of the backend)
        # Script is in backend/mock_agents/, so we need to go up one level
        db_path = os.path.abspath(os.path.join(script_dir, "..", env_db_path))

    if not os.path.exists(db_path):
        # Final fallback check in case of unexpected structure
        alt_db_path = os.path.join(script_dir, "..", "data", "echo_center.db")
        if os.path.exists(alt_db_path):
            db_path = alt_db_path

    if not os.path.exists(db_path):
        print(f"Error: Could not find database at {db_path}. Run seed_mock_data.sh first.")
        exit(1)

    # Ensure the parent directory exists (though it should if the file was found)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    print(f"[Storage-Custodian] Using database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT api_token FROM users WHERE username='Storage-Custodian'")
    row = cursor.fetchone()
    conn.close()

    if not row or not row[0]:
        print("Error: Could not find Storage-Custodian in database. Run seed_mock_data.sh first.")
    else:
        asyncio.run(agent_loop(row[0]))
