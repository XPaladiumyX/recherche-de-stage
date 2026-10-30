@echo off
setlocal
cd /d "%~dp0"
title Recherche de stage - serveur d'envoi

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js n'est pas installe.
  echo Installe-le depuis https://nodejs.org/ puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo.
  echo Un fichier .env a ete cree.
  echo Remplis ton adresse Gmail/Outlook et ton mot de passe d'application,
  echo puis enregistre et ferme le Bloc-notes.
  echo.
  start /wait notepad ".env"
)

if not exist "node_modules" (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 (
    echo.
    echo L'installation a echoue. Verifie ta connexion Internet.
    pause
    exit /b 1
  )
)

echo.
echo Ouverture de http://localhost:3001/campagne.html
start "" "http://localhost:3001/campagne.html"
echo.
echo Garde cette fenetre ouverte pendant l'envoi. Ctrl+C pour arreter.
echo.
call npm start
pause
