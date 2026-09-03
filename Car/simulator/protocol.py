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


def decode(raw: bytes) -> dict:
    obj = json.loads(raw.decode("utf-8"))
    for key in ("run_id", "team_id", "sequence_no", "car_timestamp", "ai_result"):
        if key not in obj:
            raise ValueError(f"thieu truong '{key}' trong goi tin")
    return obj
