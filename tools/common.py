import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))


def client():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en tools/.env (copia .env.example).")
    return create_client(url, key)
