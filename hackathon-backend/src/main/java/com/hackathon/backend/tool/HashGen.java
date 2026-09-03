package com.hackathon.backend.tool;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Tien ich sinh bcrypt hash de dat vao cot app_users.password_hash
 * (tai khoan dang nhap WEB cua NGUOI - admin/viewer).
 * (Du lieu mau trong init_basic_int.txt dang la hash gia '$2a$10$THAY_BANG_HASH_THAT'
 *  -> phai thay bang hash that thi moi dang nhap duoc.)
 *
 * Muon sinh mat khau WiFi cho DOI (teams.nt_hash) thi dung NtHashGen,
 * KHONG dung HashGen -- hai cot dung hai thuat toan khac nhau.
 *
 * Cach chay (sau khi da co internet tai deps):
 *   mvn -q compile exec:java \
 *       -Dexec.mainClass="com.hackathon.backend.tool.HashGen" \
 *       -Dexec.args="matkhau_cua_ban"
 *
 * Roi cap nhat DB:
 *   UPDATE app_users SET password_hash = '<hash in ra>' WHERE username = 'admin';
 */
public class HashGen {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("Dung: HashGen <mat_khau_tho>");
            return;
        }
        String hash = new BCryptPasswordEncoder().encode(args[0]);
        System.out.println(hash);
    }
}
