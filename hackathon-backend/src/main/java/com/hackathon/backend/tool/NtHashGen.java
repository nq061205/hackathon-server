package com.hackathon.backend.tool;

import org.bouncycastle.crypto.digests.MD4Digest;

import java.nio.charset.StandardCharsets;

/**
 * Tien ich sinh NT-Hash (MD4 cua mat khau, encode UTF-16LE) de dat vao
 * cot teams.nt_hash -- dung cho xac thuc WiFi qua FreeRADIUS/MSCHAPv2.
 * KHAC bcrypt (HashGen.java): NT-Hash khong salt, khong an toan neu lo ra
 * ngoai -- chi dung cho muc dich RADIUS, khong bao giờ dung lai o cho khac
 * (vi du khong dung lam mat khau dang nhap web).
 *
 * Cach chay:
 *   mvn -q compile exec:java \
 *       -Dexec.mainClass="com.hackathon.backend.tool.NtHashGen" \
 *       -Dexec.args="matkhau_cua_ban"
 *
 * Roi cap nhat DB:
 *   UPDATE teams SET nt_hash = '<hash in ra>' WHERE username = 'team01';
 */
public class NtHashGen {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("Dung: NtHashGen <mat_khau_tho>");
            return;
        }
        System.out.println(ntHash(args[0]));
    }

    static String ntHash(String password) {
        byte[] utf16le = password.getBytes(StandardCharsets.UTF_16LE);
        MD4Digest md4 = new MD4Digest();
        md4.update(utf16le, 0, utf16le.length);
        byte[] out = new byte[md4.getDigestSize()];
        md4.doFinal(out, 0);
        StringBuilder hex = new StringBuilder(out.length * 2);
        for (byte b : out) hex.append(String.format("%02X", b));
        return hex.toString();
    }
}
