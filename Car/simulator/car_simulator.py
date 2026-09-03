"""
Gia lap MOT chiec xe: gui goi UDP theo dung nhip 10ms cho server ingest.

Dung lich trinh tuyet doi (deadline += interval) thay vi sleep(interval)
lien tuc, de khong bi troi (drift) do thoi gian xu ly moi vong lap cong don.
Vong lap sleep gan het roi "spin" (busy-wait) vai mili giay cuoi de vuot
qua do phan giai Sleep() tho cua Windows (~15.6ms mac dinh).

Co the chay doc lap (mot xe that) hoac import run_car() de chay nhieu xe
cung luc tu test_10_cars.py.
"""
import argparse
import math
import random
import socket
import statistics
import sys
import time

import protocol

# =====================================================================
# VI TRI (x, y) LA DU LIEU DEMO, KHONG PHAI CAM BIEN THAT.
# Xe AI that (lane_offset_cm / steering_deg / speed_kmh / obstacle /
# confidence) KHONG co GPS/encoder nen khong biet vi tri that tren san.
# Khoi nay chi mo phong mot "san dua" hinh oval bo tron de co gi do de
# XEM THU tren ban do khi demo cho giam khao — dung khi chay
# car_simulator.py / test_10_cars.py, KHONG dung cho du lieu thi dau
# that (luc do ai_result se khong co x/y, ban do se trong — dung thiet ke).
# =====================================================================
_TRACK_WX = 30.0                                   # nua chieu dai doan thang (don vi tuy y)
_TRACK_R = 18.0                                    # ban kinh khuc cua
_TRACK_LAP_LEN = 4 * _TRACK_WX + 2 * math.pi * _TRACK_R


def _lane_offset_for_car(car_id: str) -> float:
    """Lech lan CO DINH theo tung xe (khong doi trong ca luot chay), de
    nhieu xe demo cung luc chay tren nhung "lan" hoi khac nhau, khong
    chong khit len nhau tren ban do."""
    digits = "".join(ch for ch in car_id if ch.isdigit())
    idx = int(digits) if digits else sum(ord(c) for c in car_id)
    return ((idx % 5) - 2) * 1.4  # ~ -2.8 .. +2.8


def _track_xy(dist_m: float, lane: float = 0.0):
    """Toa do demo (x, y) ung voi quang duong da di (cong don, co the
    vuot qua 1 vong) tren san oval bo tron: 2 doan thang + 2 khuc cua."""
    r = _TRACK_R + lane
    wx = _TRACK_WX
    s = dist_m % _TRACK_LAP_LEN
    if s < 2 * wx:                                  # doan thang duoi
        return s - wx, -r
    s -= 2 * wx
    turn_len = math.pi * _TRACK_R
    if s < turn_len:                                # khuc cua phai
        ang = -math.pi / 2 + s / _TRACK_R
        return wx + r * math.cos(ang), r * math.sin(ang)
    s -= turn_len
    if s < 2 * wx:                                  # doan thang tren
        return wx - s, r
    s -= 2 * wx
    ang = math.pi / 2 + s / _TRACK_R                # khuc cua trai
    return -wx + r * math.cos(ang), r * math.sin(ang)


_TIMER_IMPROVED = False


def improve_windows_timer_resolution():
    global _TIMER_IMPROVED
    if _TIMER_IMPROVED or sys.platform != "win32":
        return
    try:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
        _TIMER_IMPROVED = True
    except Exception:
        pass


def _sleep_until(deadline: float):
    while True:
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            return
        if remaining > 0.002:
            time.sleep(remaining - 0.0015)
        else:
            pass  # busy-spin nhung mili giay cuoi de chinh xac


def _fake_ai_result(rng: random.Random, dist_state: dict, interval_ms: float,
                     lane: float, frac: float) -> dict:
    speed_kmh = round(rng.uniform(15, 40), 1)
    steering_deg = round(rng.uniform(-25, 25), 1)
    lane_offset_cm = round(rng.uniform(-15, 15), 1)
    obstacle = rng.random() < 0.05
    confidence = round(rng.uniform(0.85, 0.99), 3)
    if obstacle:
        speed_kmh = round(speed_kmh * rng.uniform(0.2, 0.5), 1)  # cham lai khi "gap vat can"

    # x/y: DEMO, xem chu thich o dau file. progress = % THOI GIAN da chay
    # cua luot nay (0 luc bat dau -> gan 1 luc gan ket thuc), khop voi cach
    # dashboard hien thi "TIEN DO" (0-100%, khong bao gio vuot qua 100%).
    dist_state["m"] += speed_kmh * 1000.0 / 3600.0 * (interval_ms / 1000.0)
    x, y = _track_xy(dist_state["m"], lane + lane_offset_cm / 100.0)

    return {
        "x": round(x, 3),
        "y": round(y, 3),
        "progress": round(frac, 4),
        "speed_kmh": speed_kmh,
        "steering_deg": steering_deg,
        "lane_offset_cm": lane_offset_cm,
        "obstacle": obstacle,
        "confidence": confidence,
    }


def _wait_until_epoch_ms(target_epoch_ms: float):
    """Cho toi mot moc gio tuong doi (wall clock), dung de dong bo diem
    xuat phat GIUA CAC TIEN TRINH (process) khac nhau - perf_counter()
    khong dung chung moc 0 giua cac process nen phai dung time.time()."""
    while True:
        remaining = target_epoch_ms / 1000.0 - time.time()
        if remaining <= 0:
            return
        if remaining > 0.002:
            time.sleep(remaining - 0.0015)
        else:
            pass


def run_car(car_id: str, team_id: int, run_id: int, server_addr, duration_s: float,
            interval_ms: float = 10.0, start_barrier=None, start_at_epoch_ms=None,
            seed=None, verbose=False) -> dict:
    improve_windows_timer_resolution()
    rng = random.Random(seed)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    send_times = []  # perf_counter() cua tung goi da gui thanh cong
    errors = 0

    if start_barrier is not None:
        start_barrier.wait()  # dong bo diem xuat phat voi cac xe khac (cung tien trinh)
    if start_at_epoch_ms is not None:
        _wait_until_epoch_ms(start_at_epoch_ms)  # dong bo giua cac tien trinh

    interval_s = interval_ms / 1000.0
    t0 = time.perf_counter()
    deadline = t0
    sequence_no = 0
    end_at = t0 + duration_s
    lane = _lane_offset_for_car(car_id)
    dist_state = {"m": 0.0}

    while deadline < end_at:
        _sleep_until(deadline)
        car_timestamp = int(time.time() * 1000)
        frac = min(0.999, max(0.0, (deadline - t0) / duration_s)) if duration_s > 0 else 0.0
        ai_result = _fake_ai_result(rng, dist_state, interval_ms, lane, frac)
        payload = protocol.encode(run_id, team_id, sequence_no, car_timestamp, ai_result)
        try:
            sock.sendto(payload, server_addr)
            send_times.append(time.perf_counter())
        except OSError:
            errors += 1
        sequence_no += 1
        deadline += interval_s

    sock.close()

    intervals_ms = [(b - a) * 1000.0 for a, b in zip(send_times, send_times[1:])]
    result = {
        "car_id": car_id,
        "team_id": team_id,
        "run_id": run_id,
        "sent": len(send_times),
        "errors": errors,
        "interval_target_ms": interval_ms,
    }
    if intervals_ms:
        result.update({
            "interval_mean_ms": statistics.fmean(intervals_ms),
            "interval_stdev_ms": statistics.pstdev(intervals_ms) if len(intervals_ms) > 1 else 0.0,
            "interval_min_ms": min(intervals_ms),
            "interval_max_ms": max(intervals_ms),
            "late_count_gt2ms": sum(1 for v in intervals_ms if abs(v - interval_ms) > 2.0),
        })
    if verbose:
        print(f"[{car_id}] da gui {result['sent']} goi, loi={errors}")
    return result


def main():
    ap = argparse.ArgumentParser(description="Gia lap mot xe gui log UDP")
    ap.add_argument("--car-id", required=True)
    ap.add_argument("--team-id", type=int, required=True)
    ap.add_argument("--run-id", type=int, required=True)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9999)
    ap.add_argument("--duration", type=float, default=10.0, help="giay")
    ap.add_argument("--interval-ms", type=float, default=10.0)
    ap.add_argument("--start-at-epoch-ms", type=float, default=None,
                     help="cho toi moc gio nay (epoch ms) moi bat dau gui - de nhieu tien trinh xuat phat cung luc")
    ap.add_argument("--json", action="store_true", help="in ket qua dang JSON (dung khi chay boi test_10_cars.py)")
    args = ap.parse_args()

    result = run_car(args.car_id, args.team_id, args.run_id, (args.host, args.port),
                      args.duration, args.interval_ms,
                      start_at_epoch_ms=args.start_at_epoch_ms, verbose=not args.json)
    if args.json:
        import json
        print("RESULT_JSON:" + json.dumps(result))
    else:
        for k, v in result.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
