@echo off
rem Project Switcher - dois cliques para abrir.
title Project Switcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao 20 ou superior: https://nodejs.org
  pause
  exit /b 1
)

rem Se ja estiver rodando, apenas abre o navegador.
curl -s -o nul http://127.0.0.1:4477/ >nul 2>nul
if not errorlevel 1 (
  start "" http://127.0.0.1:4477/
  exit /b 0
)

echo Iniciando Project Switcher em http://127.0.0.1:4477 ...
echo Feche esta janela para encerrar.
echo.
node src\server.js --open
if errorlevel 1 pause
