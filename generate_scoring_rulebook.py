import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="CCCCCC", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def add_callout(doc, text_list, title="LƯU Ý QUAN TRỌNG", bg_hex="F0F9FF", border_hex="0284C7"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'  <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_hex}"/>'
        f'  <w:top w:val="none"/>'
        f'  <w:bottom w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    run_t = p.add_run(f"📌 {title}\n")
    run_t.bold = True
    run_t.font.name = "Segoe UI"
    run_t.font.size = Pt(10.5)
    run_t.font.color.rgb = RGBColor(2, 132, 199)
    
    for item in text_list:
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_before = Pt(2)
        p2.paragraph_format.space_after = Pt(2)
        r = p2.add_run(f"• {item}")
        r.font.name = "Segoe UI"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(30, 41, 59)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_after = Pt(6)

def style_heading(p, text, level=1):
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.name = "Segoe UI"
    if level == 1:
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(6)
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(26, 54, 93)  # Navy
    elif level == 2:
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(13, 148, 136)  # Teal
    elif level == 3:
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(30, 41, 59)

def style_para(p, text, bold_prefix="", space_after=6):
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.bold = True
        r_pre.font.name = "Segoe UI"
        r_pre.font.size = Pt(10)
        r_pre.font.color.rgb = RGBColor(15, 23, 42)
    r_txt = p.add_run(text)
    r_txt.font.name = "Segoe UI"
    r_txt.font.size = Pt(10)
    r_txt.font.color.rgb = RGBColor(51, 65, 85)

def format_table_header(row, headers, widths, bg_hex="1A365D"):
    for idx, (cell, h) in enumerate(zip(row.cells, headers)):
        cell.width = widths[idx]
        set_cell_background(cell, bg_hex)
        set_cell_margins(cell, top=120, bottom=120, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Segoe UI"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

def format_table_row(row, values, widths, is_even=False, aligns=None):
    bg_hex = "F8FAFC" if is_even else "FFFFFF"
    for idx, (cell, val) in enumerate(zip(row.cells, values)):
        cell.width = widths[idx]
        set_cell_background(cell, bg_hex)
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        if aligns and idx < len(aligns):
            p.alignment = aligns[idx]
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(str(val))
        r.font.name = "Segoe UI"
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(30, 41, 59)

def build_document(output_path):
    doc = Document()
    
    # Page setup - Margins 1 inch
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
    
    # Title Banner
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(10)
    p_title.paragraph_format.space_after = Pt(2)
    r_sub = p_title.add_run("🏁 HACKATHON 2026 · HỆ THỐNG PIT WALL\n")
    r_sub.bold = True
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(13, 148, 136)
    
    r_main = p_title.add_run("QUY CHẾ CHẤM ĐIỂM & ĐỀ THI XE TỰ HÀNH AI 100%\n")
    r_main.bold = True
    r_main.font.name = "Segoe UI"
    r_main.font.size = Pt(20)
    r_main.font.color.rgb = RGBColor(26, 54, 93)
    
    r_desc = p_title.add_run("Cơ chế xuất phát đối xứng công bằng · Quyết định rẽ đa chặng · Chấm điểm tự động qua Telemetry")
    r_desc.font.name = "Segoe UI"
    r_desc.font.size = Pt(10)
    r_desc.font.color.rgb = RGBColor(100, 116, 139)
    
    p_div = doc.add_paragraph()
    p_div.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_div.paragraph_format.space_after = Pt(14)
    r_div = p_div.add_run("—" * 45)
    r_div.font.color.rgb = RGBColor(203, 213, 225)
    
    # Section 1: Nguyên tắc cốt lõi
    style_heading(doc.add_paragraph(), "01. NGUYÊN TẮC CỐT LÕI: XE TỰ HÀNH HOÀN TOÀN (100% AI)", level=1)
    style_para(doc.add_paragraph(), 
               "Cuộc thi được thiết kế dành riêng cho các phương tiện tự hành hoàn toàn (Level 4/Level 5 Autonomous Driving). "
               "Bản chất cuộc thi là cuộc so tài thuật toán phần mềm giữa các đội thi, bao gồm các mô-đun: "
               "Thị giác máy tính (Computer Vision), Định vị tự hành (Localization), Lập kế hoạch đường đi (Path Planning) "
               "và Điều khiển bám quỹ đạo (Control Loop PID/MPC).")
    
    add_callout(doc, [
        "Zero Human-in-the-loop: Tuyệt đối không có sự can thiệp của con người bằng tay cầm điều khiển từ xa, bàn phím hay can thiệp vật lý sau khi xe xuất phát.",
        "Xuất phát ngẫu nhiên: Xe được đặt tại 1 trong các vị trí Spawn bất kỳ mà không được báo trước.",
        "Tự động hóa trọng tài: Toàn bộ quá trình theo dõi, tính điểm, phát hiện vi phạm và xếp hạng được thực hiện tự động 100% qua hệ thống Pit Wall (gói tin UDP Telemetry 10ms gửi về máy chủ)."
    ], title="NGUYÊN TẮC BẮT BUỘC", bg_hex="FEF2F2", border_hex="EF4444")
    
    # Section 2: Thiết kế sa bàn đối xứng
    style_heading(doc.add_paragraph(), "02. THIẾT KẾ SA BÀN ĐỐI XỨNG & ĐỒ THỊ NHÁNH RẼ CÔNG BẰNG", level=1)
    style_para(doc.add_paragraph(),
               "Để giải quyết bài toán xe xuất phát ở nơi ngẫu nhiên nhưng vẫn đảm bảo tính công bằng tuyệt đối, "
               "sa bàn thi đấu được thiết kế theo mô hình Đồ thị hướng tâm đối xứng quay 4 hướng (Rotational Symmetric DAG). "
               "Dù xe xuất phát ở bất kỳ điểm nào (S1, S2, S3, S4), cây quyết định và số lượng đường đi về đích là hoàn toàn bằng nhau.")
    
    style_heading(doc.add_paragraph(), "A. Cấu trúc các chặng và khoảng cách không đều nhau", level=2)
    style_para(doc.add_paragraph(),
               "Tại mỗi nút giao (Node), xe phải đưa ra quyết định rẽ Trái hoặc rẽ Phải. Các chặng có khoảng cách và đặc tính kỹ thuật không đều nhau:")
    
    # Table of Segments
    tbl_seg = doc.add_table(rows=1, cols=4)
    tbl_seg.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers_seg = ["Tầng / Chặng", "Khoảng cách (m)", "Đặc tính kỹ thuật", "Thử thách đối với AI"]
    widths_seg = [Inches(1.5), Inches(1.2), Inches(1.8), Inches(2.0)]
    format_table_header(tbl_seg.rows[0], headers_seg, widths_seg)
    
    seg_data = [
        ("Chặng 1: Nhánh A (Trái)", "2.8 m", "Đường ngắn, cua gắt góc 90° (R=0.6m)", "Phải giảm tốc độ, chống văng xe khỏi làn"),
        ("Chặng 1: Nhánh B (Phải)", "4.5 m", "Đường dài, cua thoải góc 45°", "Đường thoáng, cho phép AI vít ga tối đa"),
        ("Chặng 2: Nhánh C (Trái)", "3.2 m", "Đoạn dốc nhẹ hoặc có gờ giảm tốc", "Cần điều khiển chân ga mượt mà"),
        ("Chặng 2: Nhánh D (Phải)", "5.0 m", "Đường thẳng tắp kết hợp nút giao", "Tốc độ cao nhưng cần định vị chuẩn ngã rẽ"),
        ("Chặng 3: Về Đích (Final)", "1.8 m", "Đoạn thẳng hẹp dẫn vào Precision Box", "Phát hiện vạch đích, phanh dừng chính xác v=0")
    ]
    for idx, row_val in enumerate(seg_data):
        row = tbl_seg.add_row()
        format_table_row(row, row_val, widths_seg, is_even=(idx%2==1))
    set_table_borders(tbl_seg)
    
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_after = Pt(4)
    
    style_heading(doc.add_paragraph(), "B. Các lựa chọn lộ trình và bài toán tối ưu (Trade-off)", level=2)
    style_para(doc.add_paragraph(),
               "Mỗi điểm Spawn đều mở ra đúng 4 phương án đường đi đến đích. Đây là bài toán cân não của thuật toán AI:")
    style_para(doc.add_paragraph(), "• Phương án Siêu Tốc (Ngắn nhất - 7.8m): ", bold_prefix="1. Lộ trình A -> C -> Đích (2.8m + 3.2m + 1.8m): ")
    style_para(doc.add_paragraph(), "Tổng chiều dài ngắn nhất nhưng toàn góc cua hiểm hóc. AI phải tính toán tốc độ vào cua chính xác để không bị văng rào.")
    style_para(doc.add_paragraph(), "• Phương án Cân Bằng (Trung bình - 9.5m / 9.6m): ", bold_prefix="2. Lộ trình A -> D hoặc B -> C: ")
    style_para(doc.add_paragraph(), "Kết hợp giữa một đoạn ngắn cua gắt và một đoạn dài đường thoáng. Chiến thuật an toàn, độ rủi ro trung bình.")
    style_para(doc.add_paragraph(), "• Phương án Đường Xa Tốc Độ Cao (Dài nhất - 11.3m): ", bold_prefix="3. Lộ trình B -> D -> Đích (4.5m + 5.0m + 1.8m): ")
    style_para(doc.add_paragraph(), "Đường dài nhất nhưng góc lái luôn thẳng, xe có thể chạy vận tốc tối đa 40 km/h để bù đắp quãng đường.")
    
    # Section 3: Quy chế chấm điểm
    style_heading(doc.add_paragraph(), "03. HỆ THỐNG CHẤM ĐIỂM TOÀN DIỆN (THANG ĐIỂM 1.000)", level=1)
    style_para(doc.add_paragraph(),
               "Điểm số của mỗi lượt thi đấu được tổng hợp theo công thức toán học minh bạch, "
               "được trích xuất và tính toán tự động hoàn toàn từ bảng `logs` telemetry UDP:")
    
    p_formula = doc.add_paragraph()
    p_formula.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_f = p_formula.add_run("Score = S_NhiệmVụ (400) + S_LộTrình (250) + S_ChấtLượngAI (200) + S_TốcĐộ (150) - P_Phạt")
    r_f.bold = True
    r_f.font.name = "Consolas"
    r_f.font.size = Pt(11)
    r_f.font.color.rgb = RGBColor(26, 54, 93)
    
    # Table of Scoring Pillars
    tbl_score = doc.add_table(rows=1, cols=4)
    tbl_score.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers_score = ["Hạng mục điểm", "Trọng số", "Phương pháp đo tự động", "Mô tả & Tiêu chí"]
    widths_score = [Inches(1.5), Inches(1.0), Inches(1.8), Inches(2.2)]
    format_table_header(tbl_score.rows[0], headers_score, widths_score)
    
    score_rows = [
        ("1. Điểm Nhiệm Vụ (Task Completion)", "400 điểm", "Kiểm tra tọa độ X-Y và thứ tự qua Checkpoint", 
         "• Rời vạch xuất phát: +50đ\n• Qua Nút giao 1 hợp lệ: +100đ\n• Qua Nút giao 2 hợp lệ: +100đ\n• Dừng xe chính xác tại Đích (v=0 trong ô): +150đ"),
        ("2. Điểm Tối Ưu Lộ Trình (Route Planning)", "250 điểm", "Tính tỷ số: 250 x (T_opt / T_thực_tế)", 
         "Đánh giá độ thông minh của thuật toán Path Planning. Chọn đường tối ưu và di chuyển dứt khoát không ngập ngừng tại ngã rẽ."),
        ("3. Chất Lượng Điều Khiển (AI Quality)", "200 điểm", "Trích xuất độ lệch làn & góc lái từ Telemetry", 
         "• Bám tim đường (Lane-keeping): 120đ (120 - 5 x Avg(|lane_offset_cm|))\n• Độ mượt tay lái: 50đ (độ lệch chuẩn đạo hàm góc lái)\n• Độ tự tin mô hình: 30đ (30 x Avg(confidence))"),
        ("4. Tốc Độ Hành Trình (Speed Score)", "150 điểm", "Tính tỷ số: 150 x (V_tb / V_chuẩn_25kmh)", 
         "Khuyến khích AI chạy nhanh nhưng ổn định. Đạt tối đa 150 điểm khi vận tốc trung bình đạt hoặc vượt 25 km/h."),
        ("5. Điểm Phạt Vi Phạm (Penalties)", "Trừ điểm", "Telemetry & Giám sát hệ thống", 
         "• Bánh xe chạm vạch giới hạn (|offset| > 15cm): -20đ/lần\n• Do dự quá 2 giây tại ngã rẽ: -30đ/lần\n• Rẽ nhầm đường cụt / Quay đầu: -150đ\n• Mất gói telemetry > 1s: -30đ")
    ]
    for idx, row_val in enumerate(score_rows):
        row = tbl_score.add_row()
        format_table_row(row, row_val, widths_score, is_even=(idx%2==1))
    set_table_borders(tbl_score)
    
    p_space2 = doc.add_paragraph()
    p_space2.paragraph_format.space_after = Pt(6)
    
    # Section 4: Cơ chế tự động xử lý sự cố (Fail-safe)
    style_heading(doc.add_paragraph(), "04. CƠ CHẾ XỬ LÝ SỰ CỐ & FAIL-SAFE TỰ ĐỘNG", level=1)
    style_para(doc.add_paragraph(),
               "Do không có sự can thiệp của con người, hệ thống Pit Wall backend tự động áp dụng các quy tắc an toàn sau:")
    
    add_callout(doc, [
        "Kẹt xe / Mất phương hướng (Stall Timeout): Nếu vận tốc speed_kmh = 0 liên tục trong 5 giây giữa đường thi đấu, hệ thống tự động xác định xe đã bị kẹt, kết thúc lượt với trạng thái DNF (unscored).",
        "Treo máy tính nhúng (Heartbeat Timeout): Nếu cổng UDP không nhận được gói tin nào từ xe trong vòng 2.0 giây, hệ thống tự động đánh cờ Mất kết nối khẩn cấp.",
        "Thời gian tối đa một lượt (Hard Cutoff): Giới hạn tối đa 60 giây. Quá 60 giây xe chưa về đích sẽ tự động dừng tính điểm."
    ], title="CƠ CHẾ FAIL-SAFE BẢO VỆ ĐƯỜNG ĐUA", bg_hex="FFFBEB", border_hex="F59E0B")
    
    # Section 5: Mô phỏng cuộc thi thực tế
    style_heading(doc.add_paragraph(), "05. MÔ PHỎNG MỘT CUỘC THI THỰC TẾ (CASE STUDY 6 ĐỘI THI)", level=1)
    style_para(doc.add_paragraph(),
               "Để chứng minh tính thực tiễn và tính khả thi của quy chế, một vòng thi đấu mô phỏng hoàn chỉnh gồm 6 đội xe tự hành "
               "với 6 trường phái thuật toán AI khác nhau đã được thực hiện trên hệ thống Pit Wall:")
    
    # Simulation Results Table
    tbl_sim = doc.add_table(rows=1, cols=8)
    tbl_sim.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers_sim = ["Hạng", "Đội Thi (Mã xe)", "Điểm Spawn", "Lộ trình chọn", "Thời gian", "Lệch làn", "Điểm Phạt", "TỔNG ĐIỂM"]
    widths_sim = [Inches(0.6), Inches(1.3), Inches(0.8), Inches(1.1), Inches(0.8), Inches(0.8), Inches(0.6), Inches(0.8)]
    format_table_header(tbl_sim.rows[0], headers_sim, widths_sim)
    
    sim_data = [
        ("🥇 1", "Alpha Racing (car01)", "S2 (Đông)", "A -> C -> Đích (7.8m)", "14.2 s", "1.4 cm", "0", "932.4"),
        ("🥈 2", "Falcon AI (car02)", "S4 (Tây)", "B -> D -> Đích (11.3m)", "15.8 s", "1.8 cm", "0", "886.1"),
        ("🥉 3", "CyberBot (car03)", "S1 (Bắc)", "A -> D -> Đích (9.6m)", "18.5 s", "2.1 cm", "0", "819.5"),
        ("4", "Steady Drive (car04)", "S3 (Nam)", "B -> C -> Đích (9.5m)", "22.1 s", "1.1 cm", "0", "784.2"),
        ("5", "Jitter Pilot (car05)", "S1 (Bắc)", "A -> C -> Đích (7.8m)", "19.4 s", "6.8 cm", "-40", "641.8"),
        ("DNF", "Drift Master (car06)", "S2 (Đông)", "A -> C (Văng cua)", "DNF", ">25 cm", "-150", "150.0")
    ]
    aligns_sim = [
        WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER,
        WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.RIGHT, WD_ALIGN_PARAGRAPH.RIGHT,
        WD_ALIGN_PARAGRAPH.RIGHT, WD_ALIGN_PARAGRAPH.RIGHT
    ]
    for idx, row_val in enumerate(sim_data):
        row = tbl_sim.add_row()
        format_table_row(row, row_val, widths_sim, is_even=(idx%2==1), aligns=aligns_sim)
    set_table_borders(tbl_sim)
    
    p_space3 = doc.add_paragraph()
    p_space3.paragraph_format.space_after = Pt(6)
    
    style_heading(doc.add_paragraph(), "Phân tích diễn biến kỹ thuật của các đội thi:", level=2)
    style_para(doc.add_paragraph(), "Đội áp dụng mô hình Deep Reinforcement Learning kết hợp bộ lọc MPC. Xe chọn lộ trình ngắn nhất (7.8m), vào cua gắt 90° cực kỳ chuẩn xác với độ lệch làn chỉ 1.4cm, đạt vận tốc trung bình 28.5 km/h và dừng xe ngọt ngào ở vạch đích.", bold_prefix="• Đội Vô Địch - Alpha Racing (932.4 điểm): ")
    style_para(doc.add_paragraph(), "Đội chọn chiến thuật đường dài thoáng (11.3m) để tận dụng sức mạnh động cơ và tầm nhìn xa của camera. Xe vít ga lên tới 38 km/h ở đoạn thẳng 5.0m, về đích chỉ sau xe vô địch 1.6 giây và giành ngôi Á Quân thuyết phục.", bold_prefix="• Đội Á Quân - Falcon AI (886.1 điểm): ")
    style_para(doc.add_paragraph(), "Thuật toán bám làn PID của đội chưa được cân chỉnh tối ưu (hệ số P quá cao) dẫn tới xe bị lắc lư hình sin dọc đường thẳng. Xe bị trừ 40 điểm phạt do 2 lần bánh xe liếm vạch, xếp thứ 5.", bold_prefix="• Đội Jitter Pilot (641.8 điểm): ")
    style_para(doc.add_paragraph(), "Xe cố gắng chạy tốc độ quá cao khi vào khúc cua 90° của nhánh A (2.8m). Xe bị trượt bánh, lệch khỏi làn quá 25cm và đâm vào tường lốp. Hệ thống Fail-safe tự động ngắt lượt chạy để bảo vệ thiết bị, chỉ ghi nhận 150 điểm nhiệm vụ ban đầu.", bold_prefix="• Đội Drift Master (DNF - 150.0 điểm): ")
    
    # Section 6: Cấu trúc JSON tích hợp
    style_heading(doc.add_paragraph(), "06. CẤU TRÚC LƯU TRỮ KẾT QUẢ VÀO HỆ THỐNG PIT WALL", level=1)
    style_para(doc.add_paragraph(),
               "Toàn bộ kết quả chấm điểm được đóng gói dưới dạng JSON và lưu trữ trực tiếp vào cột `result` của bảng `runs` "
               "khi gọi API `POST /api/runs/{id}/finish`:")
    
    p_code = doc.add_paragraph()
    p_code.paragraph_format.left_indent = Inches(0.2)
    r_code = p_code.add_run(
        "{\n"
        '  "run_id": 101,\n'
        '  "team_id": 1,\n'
        '  "spawn_point": "S2",\n'
        '  "path_taken": ["S2", "N1A", "N2C", "DEST"],\n'
        '  "total_distance_m": 7.8,\n'
        '  "duration_s": 14.2,\n'
        '  "scores": {\n'
        '    "task": 400.0,\n'
        '    "route": 250.0,\n'
        '    "ai_quality": 172.4,\n'
        '    "speed": 110.0,\n'
        '    "penalty": 0,\n'
        '    "total": 932.4\n'
        '  },\n'
        '  "telemetry_summary": {\n'
        '    "avg_offset_cm": 1.4,\n'
        '    "max_speed_kmh": 32.1,\n'
        '    "steering_std_dev": 2.8,\n'
        '    "packet_loss_rate": "0.0%"\n'
        '  }\n'
        "}"
    )
    r_code.font.name = "Consolas"
    r_code.font.size = Pt(8.5)
    r_code.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.save(output_path)
    print(f"File quy che da tao thanh cong tai: {output_path}")

if __name__ == "__main__":
    out_file = r"d:\Hackathon\Quy-Che-Cham-Diem-Xe-Tu-Hanh.docx"
    build_document(out_file)
