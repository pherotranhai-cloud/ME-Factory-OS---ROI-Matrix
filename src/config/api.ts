// Thay thế URL bằng đường link Render của bạn sau khi deploy thành công
// Hàm fallback isAIStudio giúp giữ nguyên bản preview trên nền tảng hiện tại
const isAIStudio = typeof window !== 'undefined' && window.location.hostname.includes('run.app');

export const API_BASE_URL = isAIStudio 
  ? '/api' 
  : (import.meta.env.MODE === 'production' 
      ? 'https://ly-roi-matrix-backend.onrender.com/api' 
      : 'http://localhost:5000/api');
