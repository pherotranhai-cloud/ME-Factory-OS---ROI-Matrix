import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [react()],
    define: {
      // Bơm trực tiếp các biến môi trường vào React
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME': JSON.stringify(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''),
      'process.env.CLOUDINARY_URL': JSON.stringify(process.env.CLOUDINARY_URL || env.CLOUDINARY_URL || ''),
      // Thủ thuật an toàn: Nếu code gọi process.env.KHAC thì sẽ trả về undefined thay vì crash!
      'process.env': {}
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});