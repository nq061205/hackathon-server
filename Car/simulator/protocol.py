"""
Dinh dang goi UDP xe -> server.
JSON gon nhe, du de debug bang tay (vd: netcat / Wireshark) trong luc thi.

{
  "run_id": 12,
  "team_id": 3,
  "sequence_no": 456,
  "car_timestamp": 1755000000123,
  "ai_result": { ... }
}
"""
import json

MAX_PACKET_BYTES = 1400  # an toan duoi MTU thuong gap (1472), tranh phan manh UDP


def encode(run_id: int, team_id: int, sequence_no: int, car_timestamp: int, ai_result: dict) -> bytes:
    payload = {
        "run_id": run_id,
        "team_id": team_id,
        "sequence_no": sequence_no,
        "car_timestamp": car_timestamp,
        "ai_result": ai_result,
    }
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


# ---------------------------------------------------------------------------
#  Gioi han kieu & khoang gia tri (khop dung schema trong init_basic_int.txt)
# ---------------------------------------------------------------------------
MAX_INT4 = 2 ** 31 - 1          # runs.id / teams.id la INT
MAX_INT8 = 2 ** 63 - 1          # logs.sequence_no la BIGINT
# car_timestamp la epoch-ms, doi sang TIMESTAMPTZ bang to_timestamp(x/1000.0).
# Chan trong khoang [1970-01-01, 2100-01-01] de gia tri vo ly khong lot xuong
# tan Postgres roi moi bao loi.
MAX_EPOCH_MS = 4102444800000


def _require_int(obj: dict, key: str, hi: int) -> None:
    """Bat buoc `key` la so nguyen khong am va nam trong khoang cot DB chua duoc.

    VI SAO PHAI KIEM O DAY: JSON cho phep truong nay la bat cu thu gi -
    chuoi, so thuc, null, [] hoac {}. Neu tha nguyen xuong duoi, mot gia tri
    KHONG BAM DUOC (list/dict) se lam `run_id in <set>` nem TypeError, va loi
    do se giet luon luong ghi DB. Mot goi tin ~90 byte du ha ca may chu ma
    khong bo dem nao bao dong. Xem ghi chu (7) trong ingest_server.py.
    """
    v = obj[key]
    # bool la lop con cua int trong Python -> phai loai bo tuong minh,
    # neu khong True se lot qua thanh so 1.
    if isinstance(v, bool) or not isinstance(v, int):
        raise ValueError(f"'{key}' phai la so nguyen, nhan duoc {type(v).__name__}")
    if v < 0 or v > hi:
        raise ValueError(f"'{key}' ngoai khoang cho phep [0, {hi}]: {v}")


def decode(raw: bytes) -> dict:
    """Giai ma va KIEM TRA goi tin. Moi gia tri tra ve deu da dung kieu.

    Goi tin sai bat ky diem nao deu bi nem ValueError/TypeError o day, noi
    duy nhat co bat loi - de khong bao gio con gia tri la nao di sau nua.
    """
    if len(raw) > MAX_PACKET_BYTES:
        raise ValueError(f"goi tin dai {len(raw)} byte, vuot muc cho phep {MAX_PACKET_BYTES}")
    obj = json.loads(raw.decode("utf-8"))
    if not isinstance(obj, dict):
        raise ValueError(f"goi tin phai la doi tuong JSON, nhan duoc {type(obj).__name__}")
    for key in ("run_id", "team_id", "sequence_no", "car_timestamp", "ai_result"):
        if key not in obj:
            raise ValueError(f"thieu truong '{key}' trong goi tin")
    _require_int(obj, "run_id", MAX_INT4)
    _require_int(obj, "team_id", MAX_INT4)
    _require_int(obj, "sequence_no", MAX_INT8)
    _require_int(obj, "car_timestamp", MAX_EPOCH_MS)
    if not isinstance(obj["ai_result"], dict):
        raise ValueError(
            f"'ai_result' phai la doi tuong JSON, nhan duoc {type(obj['ai_result']).__name__}")
    return obj
