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
  (7) MOT goi tin di hinh KHONG the giet luong ghi nua. protocol.decode kiem
      chat kieu & khoang gia tri, va vong lap ghi con bat moi loi ngoai du
      kien. Truoc day mot goi ~90 byte co "run_id": [] la du: `run_id in set`
      nem TypeError (list khong bam duoc), luong ghi chet trong khi luong nhan
      van chay -> server van bao LISTENING, 'nhan' van tang deu, 'ghi' dung im
      va moi du lieu that sau do mat sach ma khong bo dem nao bao dong.
  (8) Cac bang canh bao va cache am ("run_id la") deu CO TRAN, va viec tra DB
      cho run_id la co ngan sach moi giay. Neu khong, ke tan cong chi can rai
      IP nguon / run_id ngau nhien la lam phinh bo nho hoac bien may chu thanh
      may bom truy van vao chinh Postgres ma dashboard dang doc.

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
        self.rate_limited = 0      # goi bo do 1 IP gui qua nhanh (chong flood)
        self.blocked_ip = 0        # goi bo do IP khong nam trong danh sach cho phep
        self.wrong_team = 0        # goi bo do team_id khong khop IP (mao danh doi khac)
        # Tach hai bo dem hay dung nhat theo TUNG NGUON. Con so tong chi noi
        # "dang bi chan", khong noi DOI NAO - ma luc thi thi cau hoi dau tien
        # khi mot doi chay toi hoi "sao xe toi khong len bang" chinh la doi nao.
        # Chi ghi tren duong BO GOI, khong dung toi tren duong chay binh thuong.
        self.flood_by = {}         # nguon -> so goi bi bo do gui qua nhanh
        self.parse_by = {}         # nguon -> so goi bi bo do sai dinh dang
        self.allowlist = None      # gan o main() de doi IP sang ten doi

    # So nguon toi da theo doi. Co tran de khong lap lai loi cu: bang khoa
    # theo IP ma khong gioi han thi ke gia IP nguon lam phinh den het RAM.
    MAX_NGUON = 64

    def nguon(self, ip):
        """Doi IP sang nhan de doc: 'doi 2' neu biet, khong thi giu nguyen IP."""
        if self.allowlist is not None and self.allowlist.enabled:
            t = self.allowlist.team_for(ip)
            if t is not None:
                return "doi%d" % t
        return ip if ip else "?"

    def _ghi(self, bang, ip):
        k = self.nguon(ip)
        n = bang.get(k)
        if n is None:
            if len(bang) >= self.MAX_NGUON:
                return
            bang[k] = 1
        else:
            bang[k] = n + 1

    def ghi_flood(self, ip):
        self._ghi(self.flood_by, ip)

    def ghi_parse(self, ip):
        self._ghi(self.parse_by, ip)

    def snapshot(self):
        return dict(received=self.received, parse_errors=self.parse_errors,
                    unknown_run=self.unknown_run, inserted=self.inserted,
                    batches=self.batches, dropped_full=self.dropped_full,
                    fk_rejected=self.fk_rejected, reconnects=self.reconnects,
                    rate_limited=self.rate_limited, blocked_ip=self.blocked_ip,
                    wrong_team=self.wrong_team,
                    flood_by=dict(self.flood_by), parse_by=dict(self.parse_by))


# ---------------------------------------------------------------------------
#  Chong flood: gioi han so goi/giay theo TUNG IP nguon
# ---------------------------------------------------------------------------
class RateLimiter:
    """Dem goi theo tung IP trong cua so 1 giay. Vuot nguong -> bo goi.

    Vi sao theo TUNG IP chu khong phai tong: mot xe bug/co tinh flood thi chi
    minh no bi bop, cac doi khac van gui log binh thuong. Neu gioi han tong
    thi ke tan cong keo ca cuoc thi xuong cung.

    Chay trong LUONG NHAN (hot path, ~2000 goi/giay) nen phai that re:
    1 phep chia + 1 tra cuu dict + 1 phep cong, khong khoa, khong cap phat.

    Bo dem tu reset moi giay -> khong phinh bo nho theo thoi gian. Rieng so
    LUONG IP khac nhau thi chan bang max_ips: qua nhieu IP la (vd bi spoof IP
    nguon lien tuc) thi dung them IP moi vao bang, coi nhu vuot nguong.
    """
    def __init__(self, max_pps: int, max_ips: int = 512):
        self.max_pps = max_pps          # 0 = tat kiem tra
        self.max_ips = max_ips
        self.window = 0                 # moc giay hien tai
        self.counts = {}                # ip -> so goi trong giay nay

    def allow(self, ip: str, now: float) -> bool:
        if self.max_pps <= 0:
            return True
        sec = int(now)
        if sec != self.window:          # sang giay moi -> xoa sach bo dem
            self.window = sec
            self.counts.clear()
        n = self.counts.get(ip)
        if n is None:
            if len(self.counts) >= self.max_ips:
                return False            # bang day -> khong nhan them IP la
            self.counts[ip] = 1
            return True
        if n >= self.max_pps:
            self.counts[ip] = n + 1     # van dem de biet muc do flood
            return False
        self.counts[ip] = n + 1
        return True


# ---------------------------------------------------------------------------
#  Danh sach IP hop le: chi nhan goi tu dung IP cua tung doi
# ---------------------------------------------------------------------------
class IpAllowlist:
    """Anh xa IP nguon -> team_id. Chan 2 thu cung luc:

      (1) IP LA: ke tan cong gia IP nguon ngau nhien de vuot rate limiter
          (moi IP gia duoc mot han muc rieng) -> bi bo NGAY o luong nhan,
          khong ton tai nguyen giai ma JSON.

      (2) MAO DANH DOI: mot doi da vao mang hop le nhung ghi team_id cua
          doi KHAC vao goi tin. IP cua no khong khop team_id trong goi
          -> bo goi + ghi canh bao (biet ngay ai mao danh ai).

    Khong bat mac dinh: khong truyen --allow-file thi chay nhu cu (mo),
    de khong lam hong moi truong dev/test dang dung.

    Dinh dang file (moi dong: IP <khoang trang> team_id, '#' la ghi chu):
        # IP            team_id
        192.168.0.11    1
        192.168.0.12    2
    """
    def __init__(self, path: str = None):
        self.enabled = path is not None
        self.by_ip = {}
        if path:
            self._load(path)

    def _load(self, path):
        with open(path, "r", encoding="utf-8") as f:
            for lineno, line in enumerate(f, 1):
                line = line.split("#", 1)[0].strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) != 2:
                    raise ValueError(
                        f"{path} dong {lineno}: can dung dinh dang '<IP> <team_id>', doc duoc: {line!r}")
                ip, team = parts[0], parts[1]
                if not team.isdigit():
                    raise ValueError(f"{path} dong {lineno}: team_id phai la so, doc duoc: {team!r}")
                self.by_ip[ip] = int(team)
        if not self.by_ip:
            raise ValueError(f"{path}: khong co dong hop le nao - kiem tra lai file")

    def team_for(self, ip: str):
        """Tra team_id neu IP nam trong danh sach, None neu khong."""
        return self.by_ip.get(ip)


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
    def __init__(self, dsn, refresh_s=1.0, neg_ttl_s=0.5,
                 max_lookups_per_s=20, max_invalid=10000):
        self.dsn = dsn
        self.refresh_s = refresh_s
        self.neg_ttl_s = neg_ttl_s
        self.valid = set()
        self.invalid = {}          # run_id -> thoi diem het han (monotonic)
        self.last_refresh = 0.0
        self.conn = None
        self.cur = None
        # Ngan sach tra cuu DB moi giay (chong khuech dai - xem _lookup_budget).
        self.max_lookups_per_s = max_lookups_per_s
        self.max_invalid = max_invalid
        self.lookup_window = 0
        self.lookup_count = 0
        self.lookups_skipped = 0

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
            # Don cache am moi giay: bo cac muc DA HET HAN va cac run vua tro
            # thanh hop le. Truoc day chi bo loai thu hai, nen muc het han nam
            # lai vinh vien -> ro ri bo nho khi bi rai run_id ngau nhien.
            self.invalid = {rid: exp for rid, exp in self.invalid.items()
                            if exp > now and rid not in ids}
        except Exception as e:
            print(f"[ingest] canh bao: refresh runs loi: {e}", file=sys.stderr, flush=True)
            self._drop_conn()

    def _lookup_budget(self, now) -> bool:
        """Ngan sach tra cuu DB: toi da `max_lookups_per_s` lan moi giay.

        VI SAO CAN: nhanh "miss thi tra DB ngay" o duoi bien MOT goi UDP thanh
        MOT truy van Postgres. Cache am chi chan viec LAP LAI cung mot run_id,
        nen ke tan cong chi can doi run_id moi moi goi la vuot qua - 300 goi/s
        (tran cua rate limiter) thanh 300 truy van/s moi IP, dap thang vao dung
        CSDL ma dashboard dang doc. Ngan sach nay cat dut duong khuech dai do.

        Khong anh huong xe that: run hop le nam trong `self.valid`, va
        maybe_refresh() cap nhat danh sach do moi giay. Ngan sach chi ap cho
        run_id LA - binh thuong moi luot chi co vai cai.
        """
        sec = int(now)
        if sec != self.lookup_window:
            self.lookup_window = sec
            self.lookup_count = 0
        if self.lookup_count >= self.max_lookups_per_s:
            self.lookups_skipped += 1
            _warn_lookup_budget(self.max_lookups_per_s)
            return False
        self.lookup_count += 1
        return True

    def is_valid(self, run_id, now):
        if run_id in self.valid:
            return True
        exp = self.invalid.get(run_id)
        if exp is not None and exp > now:
            return False
        # Tu day la "miss" -> phai tra DB. Hai chot chan truoc khi cham DB:
        if len(self.invalid) >= self.max_invalid or not self._lookup_budget(now):
            return False        # dang bi rai run_id rac -> bo goi, KHONG hoi DB
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
                 flush_ms: int, flush_rows: int, validator: RunValidator,
                 allowlist: "IpAllowlist" = None):
        super().__init__(daemon=True)
        self.raw_queue = raw_queue
        self.stats = stats
        self.flush_ms = flush_ms
        self.flush_rows = flush_rows
        self.validator = validator
        self.allowlist = allowlist
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
                    raw, received_at, src_ip = self.raw_queue.get(timeout=pull_timeout)
                except queue.Empty:
                    pass
                else:
                    # CHOT CHAN CUOI: mot goi tin - du di hinh den dau - KHONG
                    # duoc phep giet luong nay. Truoc day o day chi bat
                    # queue.Empty, nen mot TypeError tu _decode_row la du lam
                    # chet luong ghi trong khi luong nhan van chay: server van
                    # bao LISTENING, 'nhan' van tang, nhung 'ghi' dung im va
                    # toan bo du lieu that sau do mat sach ma khong bao dong.
                    # protocol.decode da kiem kieu chat che roi; day la lop
                    # phong ve thu hai cho moi loi chua luong truoc duoc.
                    try:
                        row = self._decode_row(raw, received_at, src_ip)
                    except Exception as e:
                        self.stats.parse_errors += 1
                        self.stats.ghi_parse(src_ip)
                        _warn_decode_crash(e)
                        row = None
                    if row is not None:
                        batch.append(row)
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

    def _decode_row(self, raw, received_at, src_ip=None):
        try:
            pkt = protocol.decode(raw)
        except Exception:
            self.stats.parse_errors += 1
            self.stats.ghi_parse(src_ip)
            return None

        # Chong MAO DANH: team_id trong goi phai khop voi doi so huu IP nguon.
        # Doi A da vao mang hop le van co the ghi team_id cua doi B vao goi tin
        # (WiFi/MAC chi kiem "ai duoc vao mang", khong kiem "goi tin noi gi").
        if self.allowlist is not None and self.allowlist.enabled:
            expected = self.allowlist.team_for(src_ip)
            if expected is not None and pkt["team_id"] != expected:
                self.stats.wrong_team += 1
                _warn_wrong_team(src_ip, expected, pkt["team_id"], pkt["run_id"])
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


# ---------------------------------------------------------------------------
#  Canh bao co TRAN - chinh cac bang canh bao cung phai chong duoc tan cong
# ---------------------------------------------------------------------------
# Cac bang duoi day khoa theo IP nguon. Truoc day chung KHONG co gioi han:
# ke tan cong gia IP nguon ngau nhien thi moi goi lai them mot khoa moi va
# khong bao gio bi xoa -> bang phinh den het RAM. Tro treu la no nam dung
# tren duong ma danh sach IP dang bao ve. Nay chan bang _MAX_WARN_KEYS.
#
# Danh doi: bang day thi ke tan cong den sau khong duoc ghi canh bao rieng.
# Chap nhan duoc - so lieu that su quan trong (bo_ipla / bo_flood / MAO_DANH)
# nam o bo dem trong Stats, khong phu thuoc bang nay. In mot dong bao day
# mot lan de nguoi truc biet log da khong con liet ke day du.
_MAX_WARN_KEYS = 1000
_warn_tables_full = set()


def _warn_allow(table, name: str, key, limit: int) -> bool:
    """True = duoc phep in canh bao cho `key` lan nay.

    Chan hai chieu: moi khoa toi da `limit` lan (chong spam mot IP), va toi
    da _MAX_WARN_KEYS khoa khac nhau (chong phinh bo nho khi bi gia IP).
    """
    n = table.get(key, 0)
    if n >= limit:
        return False
    if n == 0 and len(table) >= _MAX_WARN_KEYS:
        if name not in _warn_tables_full:
            _warn_tables_full.add(name)
            print(f"[ingest] bang canh bao '{name}' da day {_MAX_WARN_KEYS} muc -> "
                  f"ngung liet ke chi tiet (bo dem trong dong thong ke van dung).",
                  file=sys.stderr, flush=True)
        return False
    table[key] = n + 1
    return True


_flood_warned = {}
_blocked_warned = {}
_wrongteam_warned = {}
_decode_warned = {}


def _warn_blocked_ip(ip: str):
    """IP la gui goi - moi IP chi in 2 lan (chong flood chinh log)."""
    if _warn_allow(_blocked_warned, "ip_la", ip, 2):
        print(f"[ingest] CHAN: IP {ip} khong nam trong danh sach cho phep, bo goi.",
              file=sys.stderr, flush=True)


def _warn_wrong_team(ip, expected, claimed, run_id):
    """MAO DANH: canh bao dam - day la bang chung xu ly sau tran, in nhieu hon."""
    if _warn_allow(_wrongteam_warned, "mao_danh", (ip, claimed), 20):
        print(f"[ingest] *** MAO DANH *** IP {ip} (cua doi {expected}) gui goi "
              f"ghi team_id={claimed}, run_id={run_id}. Da BO goi.",
              file=sys.stderr, flush=True)


def _warn_flood(ip: str):
    """Canh bao IP dang flood - moi IP chi in toi da 3 lan, tranh chinh log
    tro thanh flood khi dang bi tan cong."""
    if _warn_allow(_flood_warned, "flood", ip, 3):
        print(f"[ingest] CANH BAO: IP {ip} gui vuot nguong, dang bo bot goi cua IP nay.",
              file=sys.stderr, flush=True)


_lookup_warned = {"n": 0}


def _warn_lookup_budget(limit: int):
    """Bao mot vai lan khi ngan sach tra cuu bi can - dau hieu co ai dang rai
    run_id ngau nhien de bien may chu thanh may bom truy van vao Postgres."""
    if _lookup_warned["n"] < 5:
        _lookup_warned["n"] += 1
        print(f"[ingest] CANH BAO: vuot {limit} luot tra cuu run_id la/giay -> "
              f"bo goi thay vi hoi DB (dau hieu bi rai run_id rac).",
              file=sys.stderr, flush=True)


def _warn_decode_crash(exc: Exception):
    """Loi KHONG luong truoc khi giai ma mot goi. Truoc ban va nay, mot loi
    nhu the giet luon luong ghi. Nay goi bi bo va chay tiep - nhung van phai
    in ra vi no la dau hieu co lo hong kiem tra o protocol.decode."""
    if _warn_allow(_decode_warned, "giai_ma", type(exc).__name__, 5):
        print(f"[ingest] LOI giai ma ngoai du kien (da BO goi, luong ghi VAN CHAY): "
              f"{type(exc).__name__}: {exc}", file=sys.stderr, flush=True)


def _tach(bang, tong):
    """Dung chuoi '[doi2:154792 doi3:17]' cho 3 nguon nhieu nhat.

    Chi in khi that su co goi bi bo, va cat con 3 nguon dau de dong thong ke
    khong bi dai ra luc dang bi danh tu nhieu phia."""
    if not bang or tong == 0:
        return ""
    top = sorted(bang.items(), key=lambda kv: -kv[1])[:3]
    them = " +%d nguon" % (len(bang) - 3) if len(bang) > 3 else ""
    return "[" + " ".join("%s:%d" % (k, v) for k, v in top) + them + "]"


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
              f"bo_fk={now['fk_rejected']} "
              f"loi_parse={now['parse_errors']}{_tach(now['parse_by'], now['parse_errors'])} "
              f"run_la={now['unknown_run']} reconn={now['reconnects']} "
              f"bo_flood={now['rate_limited']}{_tach(now['flood_by'], now['rate_limited'])} "
              f"bo_ipla={now['blocked_ip']} "
              f"MAO_DANH={now['wrong_team']}", flush=True)
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
    ap.add_argument("--max-run-lookups-per-s", type=int, default=20,
                    help="chong khuech dai: so lan tra DB toi da moi giay cho "
                         "run_id LA (chi khi --validate-run). Vuot nguong thi "
                         "bo goi thay vi hoi DB.")
    ap.add_argument("--queue-max", type=int, default=200000,
                    help="gioi han hang doi; day thi bo goi moi va dem (chong OOM)")
    ap.add_argument("--rcvbuf-mb", type=int, default=8,
                    help="kich thuoc SO_RCVBUF (MB) de kernel it rot goi UDP")
    ap.add_argument("--allow-file", default=None,
                    help="file danh sach IP hop le (moi dong: '<IP> <team_id>'). "
                         "Bat len thi CHI nhan goi tu dung IP cua tung doi, va "
                         "team_id trong goi phai khop IP -> chan ca gia IP nguon "
                         "lan mao danh doi khac. Khong truyen = nhan tu moi IP.")
    ap.add_argument("--max-pps-per-ip", type=int, default=300,
                    help="chong flood: so goi/giay toi da cho MOT IP nguon "
                         "(xe binh thuong gui 100/s, mac dinh 300 = gap 3 lan "
                         "de con bien an toan). Dat 0 de tat kiem tra.")
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
        validator = RunValidator(config.ingest_dsn(), refresh_s=args.refresh_ms / 1000.0,
                                 max_lookups_per_s=args.max_run_lookups_per_s)

    # Danh sach IP hop le: loi file -> DUNG HAN ngay tu dau, khong chay tiep.
    # Co y fail-closed o day: cau hinh sai ma van chay thi ca cuoc thi tuong
    # la duoc bao ve trong khi thuc te dang mo toang.
    allowlist = None
    if args.allow_file:
        try:
            allowlist = IpAllowlist(args.allow_file)
        except (OSError, ValueError) as e:
            print(f"[ingest] LOI danh sach IP: {e}", file=sys.stderr, flush=True)
            sys.exit(1)
        print(f"[ingest] danh sach IP: {len(allowlist.by_ip)} doi duoc phep gui "
              f"(IP la se bi bo, team_id sai IP se bi bo + canh bao).", flush=True)
    else:
        print("[ingest] LUU Y: khong dung --allow-file -> nhan goi tu MOI IP "
              "(chi co chong flood theo IP). Nen bat khi thi that.", flush=True)

    stats.allowlist = allowlist   # de doi IP sang ten doi trong dong thong ke
    writer = DbWriter(raw_queue, stats, args.flush_ms, args.flush_rows, validator, allowlist)
    printer = threading.Thread(target=stats_printer, args=(stats, 2.0), daemon=True)
    writer.start()
    printer.start()

    limiter = RateLimiter(args.max_pps_per_ip)
    if args.max_pps_per_ip > 0:
        print(f"[ingest] chong flood: toi da {args.max_pps_per_ip} goi/giay moi IP nguon.", flush=True)
    else:
        print("[ingest] CANH BAO: da TAT chong flood (--max-pps-per-ip 0).", flush=True)

    print(f"LISTENING on {args.host}:{args.port}", flush=True)

    try:
        while not STOP.is_set():
            # LUONG NHAN: giu that gon - chi recvfrom + dong dau gio + day hang doi.
            try:
                raw, addr = sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                continue
            now = time.time()
            received_at = int(now * 1000)
            src_ip = addr[0]
            stats.received += 1
            # Goi qua co: bo ngay tai day thay vi de no chiem mot cho trong
            # hang doi roi moi bi loai o luong ghi. protocol.decode van kiem
            # lai lan nua - day chi la cat som cho re.
            if len(raw) > protocol.MAX_PACKET_BYTES:
                stats.parse_errors += 1
                stats.ghi_parse(src_ip)
                continue
            # (1) IP la -> bo NGAY, truoc ca rate limiter. Ke tan cong gia IP
            #     nguon ngau nhien se bi chan o day thay vi moi IP gia lai
            #     duoc cap mot han muc rieng.
            if allowlist is not None and allowlist.team_for(src_ip) is None:
                stats.blocked_ip += 1
                _warn_blocked_ip(src_ip)
                continue
            # (2) Chan flood: mot IP gui qua nhanh thi bo goi cua rieng no,
            #     cac IP khac khong bi anh huong.
            if not limiter.allow(src_ip, now):
                stats.rate_limited += 1
                stats.ghi_flood(src_ip)
                _warn_flood(src_ip)
                continue
            try:
                raw_queue.put_nowait((raw, received_at, src_ip))
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
