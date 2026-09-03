package com.hackathon.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Doi thi + xe. Cung la nguon tai khoan WiFi cho FreeRADIUS.
 * Bang duoc tao san (init_basic_int.txt); backend khong them/xoa dong,
 * chi doc va bat/tat is_active (cap / thu hoi quyen truy cap WiFi).
 * Moc thoi gian: TIMESTAMPTZ -> Instant (theo schema that init_basic_int.txt).
 *
 * ntHash = NT-Hash (MD4 cua mat khau, encode UTF-16LE) -- KHONG phai bcrypt.
 * FreeRADIUS/MSCHAPv2 (PEAP) bat buoc can dang nay de tinh challenge-response,
 * bcrypt (mot chieu, co salt) khong dung duoc cho muc dich nay. Sinh bang
 * tool NtHashGen, khong tu viet lai thuat toan MD4 o cho khac.
 * KHONG bao gio tra ntHash ra ngoai API (xem TeamResponse).
 */
@Entity
@Table(name = "teams")
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "team_name", nullable = false)
    private String teamName;

    @Column(name = "car_id", nullable = false, unique = true)
    private String carId;

    @Column(name = "username", nullable = false, unique = true)
    private String username;

    @Column(name = "nt_hash", nullable = false)
    private String ntHash;

    @Column(name = "note")
    private String note;

    @Column(name = "mac_address")
    private String macAddress;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }

    public String getCarId() { return carId; }
    public void setCarId(String carId) { this.carId = carId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNtHash() { return ntHash; }
    public void setNtHash(String ntHash) { this.ntHash = ntHash; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getMacAddress() { return macAddress; }
    public void setMacAddress(String macAddress) { this.macAddress = macAddress; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
