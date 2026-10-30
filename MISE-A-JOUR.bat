@echo off
title Mise a jour - Recherche de stage
cd /d "%~dp0"

if not exist ".git" (
  echo.
  echo Ce dossier n'est pas un clone Git.
  echo Telecharge la derniere version ZIP depuis :
  echo https://github.com/XPaladiumyX/recherche-de-stage/archive/refs/heads/main.zip
  echo puis extrais-la par-dessus ce dossier. Ton fichier server/.env et tes donnees locales sont conserves.
  echo.
  pause
  exit /b 0
)

echo Mise a jour du site et du serveur...
git pull origin main
if errorlevel 1 (
  echo.
  echo La mise a jour a echoue. Verifie ta connexion Internet.
  pause
  exit /b 1
)

echo.
echo Mise a jour terminee. Relance LANCER-CAMPAGNE.bat.
pause
