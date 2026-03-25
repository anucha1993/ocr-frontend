#!/bin/bash
# =============================================================
# deploy-frontend.sh — Next.js Frontend on Plesk Node.js (SSH)
# รันหลังจาก upload ไฟล์ขึ้น server แล้ว
# =============================================================
set -e

echo "▶ [1/3] Installing npm dependencies..."
npm install --omit=dev

echo "▶ [2/3] Building Next.js..."
NODE_ENV=production npm run build

echo "▶ [3/3] Done."
echo ""
echo "✅ Frontend built successfully!"
echo "   ตั้งค่า Plesk Node.js App:"
echo "   • Startup file : server.js"
echo "   • Node version : 22.x"
echo "   • Document root: / (root ของ app)"
echo "   กด Restart App ใน Plesk หลัง deploy"
