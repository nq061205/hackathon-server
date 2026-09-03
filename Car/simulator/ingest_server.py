"""
May chu nhan log qua UDP, ghi xuong Postgres theo LO (batch).

Ban NAY da duoc lam cung (hardened) de xu ly DU LIEU THAT xuyen suot cuoc thi,
khac voi ban test truoc do. Cac diem da vao:

  (1) Mot goi "xau" (run_id / team_id vi pham khoa ngoai) KHONG con lam chet
      luong ghi. Lo ghi that bai duoc ha xuong ghi TUNG DONG de co lap va
      BO dung dong vi pham (dem vao stats.fk_rejected), phan con lai van ghi.
  (2) MAT ket noi DB (Postgres restart / mang chop) -> tu dong rollback +
      ket noi lai co retry & backoff, khong lam chet luong ghi.
  (3) Hang doi CO GIOI HAN (maxsize). Khi DB cham/kdt, goi moi bi bo va DEM
      (stats.dropped_full) thay vi phinh bo nho vo han (OOM).
  (4) validate-run: refresh danh sach run 'running' nhanh hon (mac dinh 1s) VA
      "miss thi tra DB ngay" (co cache am ngan de khong bi flood) -> khong con
      mat goi o dau moi luot.
  (5) Luong NHAN chi lam recvfrom + dong dau gio + day vao hang doi; viec
      json.loads / validate / ghi DB nam o luong khac. Dat SO_RCVBUF lon de
      kernel it rot goi UDP khi co nhip GC / DB cham.
  (6) received_at = gio tuong cua may server -> may server PHAI dong bo NTP,
      neu khong toan bo so "do tre mang" sai. (Dieu kien van hanh, xem canh
      bao in ra luc khoi dong.)

Chay:
    python ingest_server.py --port 9999
    python ingest_server.py --port 9999 --validate-run     # chi nhan run 'running'
"""
import argparse
import json
import queue
import signal
import socket
import sys
import threading
import time

import psycopg2
import psycopg2.errors
import psycopg2.extras

import config
import protocol

STOP = threading.Event()


def handle_stop(signum, frame):
    STOP.set()


class Stats:
    """Bo dem quan sat. Chi dung cho giam sat nen cap nhat khong khoa
    (dua vao GIL) - sai lech nho la chap nhan duoc, doi lai luong nhan gon."""
    def __init__(self):
        self.received = 0          # so goi UDP da nhan
        self.parse_errors = 0      # goi khong decode duoc
        self.unknown_run = 0       # bi bo do validate-run
        self.inserted = 0          # so dong ghi thanh cong
        self.batches = 0           # so lo da flush
        self.dropped_full = 0      # goi bo do hang doi day (backpressure)
        self.fk_rejected = 0       # dong bi bo do vi pham khoa ngoai
        self.reconnects = 0        # so lan ket noi lai DB

    def snapshot(self):
        return dict(received=self.received, parse_errors=self.parse_errors,
                    unknown_run=self.unknown_run, inserted=self.inserted,
                    batches=self.batches, dropped_full=self.dropped_full,
                    fk_rejected=self.fk_rejected, reconnects=self.reconnects)


# ---------------------------------------------------------------------------
#  Kiem tra run hop le (chi khi --validate-run)
# ---------------------------------------------------------------------------
class RunValidator:
    """Xac dinh mot run_id co dang 'running' khong, de bo som goi rac.

    - Refresh toan bo danh sach run 'running' moi `refresh_s` giay.
    - "Miss thi tra DB ngay": run_id chua biet -> hoi DB mot phat, cache lai
      (duong tinh: ghi vao `valid`; am tinh: cache ngan `neg_ttl_s` de khong
      bi flood khi co mua goi rac).
    - FAIL-OPEN: neu DB tra loi loi khi kiem tra, CHAP NHAN goi (tra True) de
      khong lo mat du lieu that; dong sai (neu co) se bi tang ghi-tung-dong
      o writer co lap va bo. Mat mot vai dong rac < mat du lieu that.
    """
    def __init__(self, dsn, refresh_s=1.0, neg_ttl_s=0.5):
        self.dsn = dsn
        self.refresh_s = refresh_s
        self.neg_ttl_s = neg_ttl_s
        self.valid = set()
        self.invalid = {}          # run_id -> thoi diem het han (monotonic)
        self.last_refresh = 0.0
        self.conn = None
        self.cur = None

    def _ensure(self):
        if self.conn is not None and self.conn.closed == 0:
            return
        self.conn = psycopg2.connect(**self.dsn)
        self.conn.autocommit = True
        self.cur = self.conn.cursor()

    def _drop_conn(self):
        try:
            if self.cur is not None:
                self.cur.close()
        except Exception:
            pass
        try:
            if self.conn is not None:
                self.conn.close()
        except Exception:
            pass
        self.conn = None
        self.cur = None

    def maybe_refresh(self, now):
        if now - self.last_refresh < self.refresh_s:
            return
        self.last_refresh = now
        try:
            self._ensure()
            self.cur.execute("SELECT id FROM runs WHERE status = 'running'")
            ids = {row[0] for row in self.cur.fetchall()}
            self.valid = ids
            # bo cache am cho nhung run vua tro thanh hop le
            for rid in list(self.invalid):
                if rid in ids:
                    self.invalid.pop(rid, None)
        except Exception as e:
            print(f"[ingest] canh bao: refresh runs loi: {e}", file=sys.stderr, flush=True)
            self._drop_conn()

    def is_valid(self, run_id, now):
        if run_id in self.valid:
            return True
        exp = self.invalid.get(run_id)
        if exp is not None and exp > now:
            return False
        # miss -> tra DB ngay
        try:
            self._ensure()
            self.cur.execute(
                "SELECT 1 FROM runs WHERE id = %s AND status = 'running'", (run_id,))
            ok = self.cur.fetchone() is not None
        except Exception as e:
            print(f"[ingest] canh bao: kiem run {run_id} loi (fail-open): {e}",
                  file=sys.stderr, flush=True)
            self._drop_conn()
            return True  # FAIL-OPEN
        if ok:
            self.valid.add(run_id)
            return True
        self.invalid[run_id] = now + self.neg_ttl_s
        return False

    def close(self):
        self._drop_conn()


# ---------------------------------------------------------------------------
#  Luong ghi DB (decode + validate + batch), co chong sap & reconnect
# ---------------------------------------------------------------------------
class DbWriter(threading.Thread):
    def __init__(self, raw_queue: queue.Queue, stats: Stats,
                 flush_ms: int, flush_rows: int, validator: RunValidator):
        super().__init__(daemon=True)
        self.raw_queue = raw_queue
        self.stats = stats
        self.flush_ms = flush_ms
        self.flush_rows = flush_rows
        self.validator = validator
        self.conn = None
        self.cur = None
        self.can_on_conflict = False

        self.insert_cols = "(run_id, team_id, sequence_no, car_timestamp, received_at, ai_result)"
        # car_timestamp/received_at truyen qua duoi dang epoch-ms (int),
        # to_timestamp(x/1000.0) quy doi sang TIMESTAMPTZ ngay trong lenh.
        self.values_tpl = "(%s,%s,%s,to_timestamp(%s/1000.0),to_timestamp(%s/1000.0),%s)"

    # --- ket noi & ket noi lai ---
    def _connect_with_retry(self, first=False):
        backoff = 0.5
        while not STOP.is_set():
            try:
                conn = psycopg2.connect(**config.ingest_dsn())
                conn.autocommit = False
                cur = conn.cursor()
                cur.execute("SELECT has_table_privilege(current_user, 'logs', 'SELECT')")
                self.can_on_conflict = bool(cur.fetchone()[0])
                conn.commit()
                self.conn = conn
                self.cur = cur
                if not first:
                    self.stats.reconnects += 1
                    print("[ingest] da ket noi lai DB.", flush=True)
                if not self.can_on_conflict:
                    print("[ingest] CANH BAO: role thieu quyen SELECT tren logs -> "
                          "khong dung duoc ON CONFLICT DO NOTHING, lui ve ghi tung dong "
                          "khi gap goi trung. Chay 'GRANT SELECT ON logs TO svc_ingest;'.",
                          flush=True)
                return True
            except Exception as e:
                print(f"[ingest] khong ket noi duoc DB: {e} -> thu lai sau {backoff:.1f}s",
                      file=sys.stderr, flush=True)
                STOP.wait(backoff)
                backoff = min(backoff * 2, 5.0)
        return False

    def _drop_conn(self):
        try:
            if self.cur is not None:
                self.cur.close()
        except Exception:
            pass
        try:
            if self.conn is not None:
                self.conn.close()
        except Exception:
            pass
        self.conn = None
        self.cur = None

    def _batch_sql(self):
        sql = f"INSERT INTO logs {self.insert_cols} VALUES %s"
        if self.can_on_conflict:
            sql += " ON CONFLICT (run_id, sequence_no) DO NOTHING"
        return sql

    def _single_sql(self):
        sql = f"INSERT INTO logs {self.insert_cols} VALUES {self.values_tpl}"
        if self.can_on_conflict:
            sql += " ON CONFLICT (run_id, sequence_no) DO NOTHING"
        return sql

    # --- ghi tung dong de co lap va BO dong vi pham khoa ngoai ---
    def _insert_per_row(self, batch):
        single_sql = self._single_sql()
        inserted = 0
        for row in batch:
            while not STOP.is_set():
                try:
                    self.cur.execute(single_sql, row)
                    self.conn.commit()
                    inserted += 1
                    break
                except psycopg2.errors.UniqueViolation:
                    self.conn.rollback()          # goi trung (khi khong co ON CONFLICT)
                    break
                except (psycopg2.errors.ForeignKeyViolation,
                        psycopg2.errors.NotNullViolation,
                        psycopg2.errors.CheckViolation,
                        psycopg2.DataError) as e:
                    self.conn.rollback()          # dong xau -> BO, dem, ghi tiep
                    self.stats.fk_rejected += 1
                    _sample_warn(row, e)
                    break
                except (psycopg2.OperationalError, psycopg2.InterfaceError):
                    # mat ket noi giua chung -> ket noi lai roi thu lai dong nay
                    self._drop_conn()
                    if not self._connect_with_retry():
                        return inserted
                    single_sql = self._single_sql()
                    continue
                except Exception as e:
                    self.conn.rollback()
                    self.stats.fk_rejected += 1
                    _sample_warn(row, e)
                    break
        return inserted

    def _flush(self, batch):
        """Tra ve (so_dong_ghi, con_giu_lai_batch?).
        Neu mat ket noi va ket noi lai that bai tam thoi, GIU nguyen batch
        (khong xoa) de thu lai o vong sau -> khong mat du lieu da nhan."""
        if not batch:
            return 0, False
        batch_sql = self._batch_sql()
        while not STOP.is_set():
            try:
                psycopg2.extras.execute_values(
                    self.cur, batch_sql, batch,
                    template=self.values_tpl, page_size=len(batch))
                self.conn.commit()
                self.stats.inserted += len(batch)
                self.stats.batches += 1
                return len(batch), False
            except (psycopg2.OperationalError, psycopg2.InterfaceError):
                # mat ket noi -> ket noi lai, roi thu lai CA lo
                self._drop_conn()
                if not self._connect_with_retry():
                    return 0, True     # giu batch, thu lai sau
                batch_sql = self._batch_sql()
                continue
            except Exception:
                # loi du lieu trong lo (vd 1 dong vi pham khoa ngoai) ->
                # co lap bang cach ghi tung dong, bo dung dong xau.
                try:
                    self.conn.rollback()
                except Exception:
                    self._drop_conn()
                    if not self._connect_with_retry():
                        return 0, True
                inserted = self._insert_per_row(batch)
                self.stats.inserted += inserted
                self.stats.batches += 1
                return inserted, False
        return 0, True

    def run(self):
        if not self._connect_with_retry(first=True):
            return

        batch = []
        last_flush = time.monotonic()
        # tran chong phinh batch khi DB dang chet: chi gom toi 2x flush_rows,
        # phan con lai de o hang doi (va bi bo + dem neu day).
        batch_cap = self.flush_rows * 2

        while not STOP.is_set() or not self.raw_queue.empty() or batch:
            now = time.monotonic()
            if self.validator is not None:
                self.validator.maybe_refresh(now)

            timeout = max(0.0, self.flush_ms / 1000.0 - (now - last_flush))
            pull_timeout = min(timeout, 0.05) if timeout > 0 else 0.001

            if len(batch) < batch_cap:
                try:
                    raw, received_at = self.raw_queue.get(timeout=pull_timeout)
                    row = self._decode_row(raw, received_at)
                    if row is not None:
                        batch.append(row)
                except queue.Empty:
                    pass
            else:
                # batch day (DB dang kdt) -> khong keo them, cho flush
                time.sleep(0.005)

            due_size = len(batch) >= self.flush_rows
            due_time = (time.monotonic() - last_flush) * 1000.0 >= self.flush_ms
            if batch and (due_size or due_time):
                _, keep = self._flush(batch)
                if not keep:
                    batch = []
                elif STOP.is_set():
                    # dang tat ma van khong ket noi duoc DB -> thoi, tranh spin
                    break
                last_flush = time.monotonic()

        # flush lan cuoi (co gang)
        if batch:
            self._flush(batch)
        if self.validator is not None:
            self.validator.close()
        self._drop_conn()

    def _decode_row(self, raw, received_at):
        try:
            pkt = protocol.decode(raw)
        except Exception:
            self.stats.parse_errors += 1
            return None

        if self.validator is not None:
            if not self.validator.is_valid(pkt["run_id"], time.monotonic()):
                self.stats.unknown_run += 1
                return None

        ai_result_text = json.dumps(pkt["ai_result"], separators=(",", ":"))
        return (pkt["run_id"], pkt["team_id"], pkt["sequence_no"],
                pkt["car_timestamp"], received_at, ai_result_text)


_warned = {"n": 0}


def _sample_warn(row, exc):
    """In vai vi du dong bi bo (khong spam log khi co mua goi rac)."""
    if _warned["n"] < 10:
        _warned["n"] += 1
        rid = row[0] if len(row) > 0 else "?"
        tid = row[1] if len(row) > 1 else "?"
        print(f"[ingest] BO dong run_id={rid} team_id={tid}: "
              f"{type(exc).__name__}", file=sys.stderr, flush=True)


def stats_printer(stats: Stats, interval_s: float):
    last = stats.snapshot()
    last_t = time.monotonic()
    while not STOP.is_set():
        STOP.wait(interval_s)
        now = stats.snapshot()
        now_t = time.monotonic()
        dt = now_t - last_t
        rps = (now["received"] - last["received"]) / dt if dt > 0 else 0.0
        print(f"[ingest] nhan={now['received']} (+{rps:.0f}/s) ghi={now['inserted']} "
              f"lo={now['batches']} bo_day={now['dropped_full']} "
              f"bo_fk={now['fk_rejected']} loi_parse={now['parse_errors']} "
              f"run_la={now['unknown_run']} reconn={now['reconnects']}", flush=True)
        last, last_t = now, now_t


def main():
    ap = argparse.ArgumentParser(description="UDP ingest server (ban lam cung cho du lieu that)")
    ap.add_argument("--host", default=config.UDP_HOST)
    ap.add_argument("--port", type=int, default=config.UDP_PORT)
    ap.add_argument("--flush-ms", type=int, default=200)
    ap.add_argument("--flush-rows", type=int, default=500)
    ap.add_argument("--validate-run", action="store_true",
                    help="chi chap nhan goi co run_id dang 'running' trong DB")
    ap.add_argument("--refresh-ms", type=int, default=1000,
                    help="chu ky refresh danh sach run 'running' (chi khi --validate-run)")
    ap.add_argument("--queue-max", type=int, default=200000,
                    help="gioi han hang doi; day thi bo goi moi va dem (chong OOM)")
    ap.add_argument("--rcvbuf-mb", type=int, default=8,
                    help="kich thuoc SO_RCVBUF (MB) de kernel it rot goi UDP")
    args = ap.parse_args()

    signal.signal(signal.SIGINT, handle_stop)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, handle_stop)  # Windows: Ctrl+Break

    print("[ingest] LUU Y: 'received_at' dung gio may server -> hay dam bao "
          "may server DA dong bo NTP, neu khong so do-tre-mang se sai.", flush=True)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        want = args.rcvbuf_mb * 1024 * 1024
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, want)
        got = sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
        print(f"[ingest] SO_RCVBUF yeu cau {want} byte, he thong cap {got} byte.", flush=True)
    except OSError as e:
        print(f"[ingest] khong dat duoc SO_RCVBUF: {e}", file=sys.stderr, flush=True)
    sock.bind((args.host, args.port))
    sock.settimeout(0.5)

    raw_queue = queue.Queue(maxsize=args.queue_max)
    stats = Stats()

    validator = None
    if args.validate_run:
        validator = RunValidator(config.ingest_dsn(), refresh_s=args.refresh_ms / 1000.0)

    writer = DbWriter(raw_queue, stats, args.flush_ms, args.flush_rows, validator)
    printer = threading.Thread(target=stats_printer, args=(stats, 2.0), daemon=True)
    writer.start()
    printer.start()

    print(f"LISTENING on {args.host}:{args.port}", flush=True)

    try:
        while not STOP.is_set():
            # LUONG NHAN: giu that gon - chi recvfrom + dong dau gio + day hang doi.
            try:
                raw, _addr = sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                continue
            received_at = int(time.time() * 1000)
            stats.received += 1
            try:
                raw_queue.put_nowait((raw, received_at))
            except queue.Full:
                stats.dropped_full += 1
    except KeyboardInterrupt:
        pass
    finally:
        STOP.set()
        sock.close()
        writer.join(timeout=10)
        print("[ingest] da dung. Tong ket: " + json.dumps(stats.snapshot()), flush=True)


if __name__ == "__main__":
    main()
