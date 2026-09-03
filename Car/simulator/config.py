"""
Cau hinh dung chung: ket noi Postgres + dia chi UDP.
Doc gia tri tu bien moi truong neu co, khong thi dung mac dinh khop voi
init_basic_int.txt (doi mat khau that truoc ngay thi dau thuc).
"""
import os

DB_HOST = os.environ.get("HACKATHON_DB_HOST", "localhost")
DB_PORT = int(os.environ.get("HACKATHON_DB_PORT", "5432"))
DB_NAME = os.environ.get("HACKATHON_DB_NAME", "Hackathon")

ADMIN_USER = os.environ.get("HACKATHON_ADMIN_USER", "app_admin")
ADMIN_PASSWORD = os.environ.get("HACKATHON_ADMIN_PASSWORD", "doi_mat_khau_1")

INGEST_USER = os.environ.get("HACKATHON_INGEST_USER", "svc_ingest")
INGEST_PASSWORD = os.environ.get("HACKATHON_INGEST_PASSWORD", "doi_mat_khau_2")

UDP_HOST = os.environ.get("HACKATHON_UDP_HOST", "127.0.0.1")
UDP_PORT = int(os.environ.get("HACKATHON_UDP_PORT", "9999"))


def admin_dsn():
    return dict(host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
                user=ADMIN_USER, password=ADMIN_PASSWORD)


def ingest_dsn():
    return dict(host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
                user=INGEST_USER, password=INGEST_PASSWORD)
