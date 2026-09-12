// Cau hinh duoc "dong cung" luc build (Vite doc file .env, ghi cung gia tri
// vao file JS bien dich - xem README/HUONG_DAN...md phan B2). Dung CHUNG mot
// hang so nay o moi noi (LoginScreen, BackendGate...) thay vi moi cho tu doc
// import.meta.env rieng, tranh lech gia tri.
export const DEFAULT_API = import.meta.env.VITE_DEFAULT_API ?? "http://localhost:8080";
