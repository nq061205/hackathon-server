// Helper cho bản desktop (Electron, xem electron/preload.js). Trong trình
// duyệt thường (npm run dev / web publish) window.electronAPI không tồn tại
// -> mọi hàm ở đây trở thành no-op an toàn, giao diện web hoạt động y như cũ.

export function isDesktop() {
  return typeof window !== "undefined" && !!window.electronAPI;
}

// Mở một "nguồn" (source id trong lib/sources.js) thành cửa sổ riêng, độc lập
// với cửa sổ chính — dùng để kéo sang màn hình phụ / máy chiếu, hoặc theo dõi
// một nguồn cố định trong lúc vẫn chuyển cảnh ở cửa sổ chính. Cửa sổ mới tải
// lại chính app này với ?popout=<id> (electron/main.js#createPopoutWindow),
// App.jsx sẽ render PopoutView thay vì Dashboard. Cùng ứng dụng Electron nên
// phiên đăng nhập trong localStorage được dùng chung, không cần đăng nhập lại.
export async function openPopout(sourceId) {
  if (!isDesktop()) return false;
  try {
    return await window.electronAPI.openPopout(sourceId);
  } catch (err) {
    console.error("[desktop] openPopout that bai:", err);
    return false;
  }
}

// Nguoc voi openPopout: dong cua so popout hien tai VA dua cua so chinh len
// truoc/focus (dung trong PopoutView.jsx, nut "Gộp lại"). Khong "gop noi
// dung" ve mat ky thuat — cua so chinh luon san co day du, day chi la dong
// popout + quay lai nhin cua so chinh.
export function mergeBack() {
  if (!isDesktop()) return false;
  window.electronAPI.mergeBack();
  return true;
}
