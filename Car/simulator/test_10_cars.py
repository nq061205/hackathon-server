"""
Kich ban test chinh: cho N xe (mac dinh 10) gui log UDP CUNG LUC, moi
10ms mot goi, roi kiem tra lai trong Postgres xem:
  - Co goi nao bi ROT (mat) khong (dua vao sequence_no lien tuc)?
  - Nhip gui thuc te cua tung xe co bam sat 10ms khong (do o phia gui)?
  - Do tre mang (received_at - car_timestamp) va do "rung" (jitter) o
    phia nhan the nao?

Chay:
    python test_10_cars.py --cars 10 --duration 10

Can co server Postgres dang chay voi DB "Hackathon" da tao theo
init_basic_int.txt (dung mat khau mac dinh trong config.py, hoac dat
bien moi truong HACKATHON_ADMIN_PASSWORD / HACKATHON_INGEST_PASSWORD).
"""
import argparse
import json
import statistics
import subprocess
import sys
import threading
import time
from queue import Queue, Empty

import psycopg2

import config


def ensure_teams(conn, n_cars: int, prefix: str):
    cur = conn.cursor()
    rows = []
    for i in range(1, n_cars + 1):
        car_id = f"{prefix}{i:02d}"
        rows.append((f"Load Test Car {i}", car_id, car_id, "loadtest-no-login"))
    cur.executemany(
        "INSERT INTO teams (team_name, car_id, username, password_hash, created_at) "
        "VALUES (%s, %s, %s, %s, now()) "
        "ON CONFLICT (car_id) DO NOTHING",
        rows,
    )
    conn.commit()

    car_ids = [f"{prefix}{i:02d}" for i in range(1, n_cars + 1)]
    cur.execute("SELECT id, car_id FROM teams WHERE car_id = ANY(%s)", (car_ids,))
    id_by_car = {car_id: team_id for team_id, car_id in cur.fetchall()}
    cur.close()
    return [(car_id, id_by_car[car_id]) for car_id in car_ids]


def open_runs(conn, teams):
    cur = conn.cursor()
    run_ids = {}
    for car_id, team_id in teams:
        cur.execute("SELECT COALESCE(MAX(heat_no), 0) + 1 FROM runs WHERE team_id = %s", (team_id,))
        heat_no = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO runs (team_id, heat_no, started_at, status) "
            "VALUES (%s, %s, now(), 'running') RETURNING id",
            (team_id, heat_no),
        )
        run_ids[car_id] = cur.fetchone()[0]
    conn.commit()
    cur.close()
    return run_ids


def close_runs(conn, run_ids):
    cur = conn.cursor()
    cur.execute(
        "UPDATE runs SET status = 'finished', ended_at = now() WHERE id = ANY(%s)",
        (list(run_ids),),
    )
    conn.commit()
    cur.close()


def start_ingest_server(host, port, flush_ms, flush_rows, validate_run, ready_timeout=5.0):
    cmd = [sys.executable, "ingest_server.py", "--host", host, "--port", str(port),
           "--flush-ms", str(flush_ms), "--flush-rows", str(flush_rows)]
    if validate_run:
        cmd.append("--validate-run")

    popen_kwargs = dict(stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, bufsize=1)
    if sys.platform == "win32":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(cmd, **popen_kwargs)
    ready_q = Queue()

    def relay():
        for line in proc.stdout:
            line = line.rstrip()
            if line.startswith("LISTENING"):
                ready_q.put(True)
            print(f"  [ingest_server] {line}")

    threading.Thread(target=relay, daemon=True).start()

    try:
        ready_q.get(timeout=ready_timeout)
    except Empty:
        raise RuntimeError("ingest_server.py khong san sang (timeout). Kiem tra ket noi DB / cong UDP.")

    return proc


def stop_ingest_server(proc, timeout=5.0):
    try:
        if sys.platform == "win32":
            import signal
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            proc.terminate()
        proc.wait(timeout=timeout)
    except Exception:
        proc.kill()


def _parse_car_result(car_id, stdout_text):
    for line in stdout_text.splitlines():
        if line.startswith("RESULT_JSON:"):
            return json.loads(line[len("RESULT_JSON:"):])
    raise RuntimeError(f"khong doc duoc ket qua tu tien trinh xe {car_id}:\n{stdout_text}")


def analyze_run(conn, car_id, run_id, sent_count):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM logs WHERE run_id = %s", (run_id,))
    received_count = cur.fetchone()[0]

    missing = []
    if sent_count > 0:
        cur.execute(
            "SELECT gs.seq FROM generate_series(0, %s) AS gs(seq) "
            "LEFT JOIN logs l ON l.run_id = %s AND l.sequence_no = gs.seq "
            "WHERE l.sequence_no IS NULL ORDER BY gs.seq",
            (sent_count - 1, run_id),
        )
        missing = [row[0] for row in cur.fetchall()]

    # received_at/car_timestamp la TIMESTAMPTZ -> hieu so la INTERVAL,
    # dung EXTRACT(EPOCH FROM ...) * 1000 de quy ve so mili giay.
    cur.execute(
        "SELECT MIN(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000), "
        "AVG(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000), "
        "MAX(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000) "
        "FROM logs WHERE run_id = %s",
        (run_id,),
    )
    lat_min, lat_avg, lat_max = cur.fetchone()

    cur.execute(
        "SELECT received_at FROM logs WHERE run_id = %s ORDER BY sequence_no", (run_id,)
    )
    received_ats = [row[0] for row in cur.fetchall()]  # datetime objects (TIMESTAMPTZ)
    cur.close()

    recv_intervals = [(b - a).total_seconds() * 1000.0 for a, b in zip(received_ats, received_ats[1:])]
    recv_stats = {}
    if recv_intervals:
        recv_stats = {
            "mean": statistics.fmean(recv_intervals),
            "stdev": statistics.pstdev(recv_intervals) if len(recv_intervals) > 1 else 0.0,
            "min": min(recv_intervals),
            "max": max(recv_intervals),
        }

    return {
        "car_id": car_id,
        "run_id": run_id,
        "sent": sent_count,
        "received": received_count,
        "missing_count": len(missing),
        "missing_sample": missing[:10],
        "latency_min_ms": lat_min,
        "latency_avg_ms": float(lat_avg) if lat_avg is not None else None,
        "latency_max_ms": lat_max,
        "recv_interval": recv_stats,
    }


def main():
    ap = argparse.ArgumentParser(description="Test N xe gui log UDP cung luc moi 10ms")
    ap.add_argument("--cars", type=int, default=10)
    ap.add_argument("--duration", type=float, default=10.0, help="giay")
    ap.add_argument("--interval-ms", type=float, default=10.0)
    ap.add_argument("--host", default=config.UDP_HOST)
    ap.add_argument("--port", type=int, default=config.UDP_PORT)
    ap.add_argument("--flush-ms", type=int, default=200)
    ap.add_argument("--flush-rows", type=int, default=500)
    ap.add_argument("--validate-run", action="store_true")
    ap.add_argument("--prefix", default="loadtest", help="tien to car_id cho doi test")
    ap.add_argument("--max-jitter-ms", type=float, default=10.0,
                     help="nguong lech de canh bao ve nhip gui (khong lam FAIL tru khi --strict-timing)")
    ap.add_argument("--allow-loss", type=int, default=0, help="so goi mat toi da cho phep de van PASS")
    ap.add_argument("--strict-timing", action="store_true",
                     help="ngoai viec khong duoc mat goi, con bat buoc moi khoang gui phai nam trong interval-ms +/- max-jitter-ms")
    ap.add_argument("--startup-margin", type=float, default=2.0,
                     help="giay cho de spawn xong toan bo tien trinh xe truoc khi dong bo xuat phat")
    ap.add_argument("--deactivate-after", action="store_true",
                     help="dat is_active=false cho cac doi test sau khi xong (khong xoa logs/runs)")
    args = ap.parse_args()

    print(f"== Test {args.cars} xe, {args.duration}s, moi {args.interval_ms}ms/goi ==")

    admin_conn = psycopg2.connect(**config.admin_dsn())

    print("[1/6] Tao/kiem tra doi test...")
    teams = ensure_teams(admin_conn, args.cars, args.prefix)

    print("[2/6] Mo luot chay (runs) cho tung xe...")
    run_ids = open_runs(admin_conn, teams)

    print("[3/6] Khoi dong ingest_server.py...")
    server_proc = start_ingest_server(args.host, args.port, args.flush_ms, args.flush_rows, args.validate_run)

    print(f"[4/6] Khoi dong {args.cars} tien trinh xe rieng biet (moi xe 1 process, "
          f"tranh tranh chap GIL giua cac xe), dong bo xuat phat sau {args.startup_margin}s...")
    # Moi xe la MOT TIEN TRINH rieng (khong phai thread trong cung 1
    # process) de tranh Python GIL lam tre lich gui khi chay 10 xe cung
    # luc. Dong bo diem xuat phat bang mot moc gio epoch chung, vi
    # perf_counter() khong dung chung goc giua cac tien trinh.
    start_at_epoch_ms = int((time.time() + args.startup_margin) * 1000)
    procs = {}
    for car_id, team_id in teams:
        run_id = run_ids[car_id]
        cmd = [sys.executable, "car_simulator.py",
               "--car-id", car_id, "--team-id", str(team_id), "--run-id", str(run_id),
               "--host", args.host, "--port", str(args.port),
               "--duration", str(args.duration), "--interval-ms", str(args.interval_ms),
               "--start-at-epoch-ms", str(start_at_epoch_ms), "--json"]
        procs[car_id] = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    car_results = {}
    for car_id, proc in procs.items():
        out, _ = proc.communicate()
        car_results[car_id] = _parse_car_result(car_id, out)

    print("[5/6] Cho ingest server flush lo cuoi roi dung...")
    time.sleep(max(0.5, args.flush_ms / 1000.0 * 2))
    stop_ingest_server(server_proc)

    close_runs(admin_conn, run_ids.values())

    if args.deactivate_after:
        cur = admin_conn.cursor()
        car_ids = [c for c, _ in teams]
        cur.execute("UPDATE teams SET is_active = false WHERE car_id = ANY(%s)", (car_ids,))
        admin_conn.commit()
        cur.close()

    print("[6/6] Phan tich ket qua trong Postgres...\n")
    overall_pass = True
    header = f"{'Xe':<12}{'Gui':>6}{'Nhan':>6}{'Mat':>6}{'Gui:tb(ms)':>12}{'Gui:max(ms)':>13}{'Do tre tb(ms)':>15}"
    print(header)
    print("-" * len(header))

    for car_id, _team_id in teams:
        run_id = run_ids[car_id]
        sent_stats = car_results[car_id]
        analysis = analyze_run(admin_conn, car_id, run_id, sent_stats["sent"])

        interval_mean = sent_stats.get("interval_mean_ms", 0.0)
        interval_max = sent_stats.get("interval_max_ms", 0.0)
        lat_avg = analysis["latency_avg_ms"]

        missing = analysis["missing_count"]
        no_loss = (missing <= args.allow_loss) and not sent_stats.get("errors")
        jitter_ok = interval_max <= args.interval_ms + args.max_jitter_ms

        car_pass = no_loss and (jitter_ok if args.strict_timing else True)
        overall_pass &= car_pass

        mark = "OK" if car_pass else "FAIL"
        print(f"{car_id:<12}{sent_stats['sent']:>6}{analysis['received']:>6}{missing:>6}"
              f"{interval_mean:>12.2f}{interval_max:>13.2f}"
              f"{(lat_avg if lat_avg is not None else float('nan')):>15.2f}  [{mark}]")

        if missing:
            sample = analysis["missing_sample"]
            print(f"    -> MAT DU LIEU: thieu {missing} goi, vi du sequence_no: {sample}")
        if sent_stats.get("errors"):
            print(f"    -> co {sent_stats['errors']} loi khi gui (socket)")
        if not jitter_ok:
            tag = "FAIL (--strict-timing)" if args.strict_timing else "canh bao, khong tinh FAIL"
            print(f"    -> [{tag}] co khoang gui cach nhau toi {interval_max:.1f}ms "
                  f"(muc tieu {args.interval_ms:.0f}ms +/-{args.max_jitter_ms:.0f}ms) - "
                  f"thuong do OS scheduler (Windows khong phai RTOS) khi nhieu tien trinh "
                  f"cung thuc day tai 1 thoi diem, KHONG dong nghia voi mat du lieu.")

    print()
    if overall_pass:
        scope = "khong mat goi nao VA nhip gui nam trong nguong" if args.strict_timing else "khong mat goi nao (du lieu ve du)"
        print(f"KET QUA CHUNG: PASS - {args.cars} xe, {scope}.")
    else:
        print("KET QUA CHUNG: FAIL - co xe bi mat du lieu, xem chi tiet o tren.")

    admin_conn.close()
    sys.exit(0 if overall_pass else 1)


if __name__ == "__main__":
    main()
