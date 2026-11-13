@echo off
cd /d "%~dp0"
title Simulador de Campeonatos - Esports

echo ===================================================
echo     Simulador de Campeonatos - Esports
echo ===================================================
echo.
echo Iniciando o servidor...
echo O navegador abrira em http://localhost:8080
echo.

if exist "esports-bracket-builder-main\package.json" cd esports-bracket-builder-main

start http://localhost:8080

call npm run dev

pause
