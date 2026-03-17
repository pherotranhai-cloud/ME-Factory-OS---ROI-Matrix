# Factory OS ROI Matrix - Production Ready

A professional ROI (Return on Investment) calculation and reporting tool for shoe manufacturing equipment.

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts, Motion
- **Backend**: Express.js (Netlify Functions)
- **Database**: NeonDB (PostgreSQL)
- **Image Management**: Cloudinary
- **AI Engine**: Google Gemini API
- **Reporting**: html2pdf.js

## Local Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd react-example
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root directory and add the following:
   ```env
   DATABASE_URL=your_neondb_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   CLOUDINARY_URL=your_cloudinary_url
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   ADMIN_SECRET_KEY=your_admin_secret
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## Deployment

This application is optimized for deployment on **Netlify**.

1. Connect your GitHub repository to Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.
4. Configure the environment variables in the Netlify dashboard.
5. Set up a Cloudinary "Unsigned Upload Preset" for machine photos.
"# ME-Factory-OS---ROI-Matrix" 
