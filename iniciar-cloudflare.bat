@echo off
REM =============================================================================
REM  iniciar-cloudflare.bat — Inicia o servidor Cordeiro + Cloudflare Tunnel
REM
REM  Pré-requisito: instale o cloudflared uma vez:
REM    winget install Cloudflare.cloudflared
REM
REM  Uso: duplo-clique neste arquivo. Pressione Ctrl+C para parar tudo.
REM =============================================================================

setlocal
cd /d "%~dp0backend"

echo ============================================
echo  Cordeiro Fiscal - Servidor + Cloudflare
echo ============================================
echo.

REM Inicia o servidor Node em background
echo [1/2] Iniciando servidor backend na porta 3000...
start "Cordeiro-Backend" /B cmd /c "node server.js"
timeout /t 3 /nobreak >nul

REM Verifica se subiu
curl -s -o nul -w "Servidor: HTTP %%{http_code}\n" http://localhost:3000/api/health
echo.

REM Inicia o tunnel Cloudflare
echo [2/2] Iniciando Cloudflare Tunnel...
echo A URL publica aparecera abaixo (CTRL+C para parar):
echo.
cloudflared tunnel --url http://localhost:3000

echo.
echo Tunnel encerrado. Encerrando servidor...
taskkill /FI "WINDOWTITLE eq Cordeiro-Backend*" /T /F >nul 2>&1
endlocal
