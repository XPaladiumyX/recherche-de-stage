# Installation automatique - Recherche de stage / Tech Vaucanson
# Lance ce script via INSTALLER.bat (double-clic).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root 'server'
$envPath = Join-Path $server '.env'

function Read-Default([string]$prompt, [string]$default) {
  $value = Read-Host "$prompt [$default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $default }
  return $value.Trim()
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RECHERCHE DE STAGE - INSTALLATION AUTOMATIQUE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $server)) {
  Write-Host "Dossier server introuvable. Place INSTALLER.bat a la racine du projet." -ForegroundColor Red
  exit 1
}

# 1. Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js n'est pas installe." -ForegroundColor Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    $answer = Read-Host "Installer Node.js LTS automatiquement avec winget ? (O/n)"
    if ($answer -notmatch '^[nN]') {
      Write-Host "Installation de Node.js..." -ForegroundColor Cyan
      winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
      if ($LASTEXITCODE -ne 0) { Write-Host "winget a echoue. Installe Node.js manuellement depuis nodejs.org." -ForegroundColor Yellow }
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    }
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js est toujours introuvable." -ForegroundColor Red
    Write-Host "Installe-le depuis https://nodejs.org/fr puis relance INSTALLER.bat."
    Start-Process "https://nodejs.org/fr"
    exit 1
  }
}
Write-Host ("Node.js : " + (node --version)) -ForegroundColor Green

# 2. Configuration existante
$replace = 'o'
if (Test-Path $envPath) {
  Write-Host ""
  Write-Host "Une configuration existe deja dans server/.env." -ForegroundColor Yellow
  $replace = Read-Host "La remplacer ? (o/N)"
  if ($replace -notmatch '^[oOyY]') {
    Write-Host "Configuration conservee." -ForegroundColor Green
  }
}

if ($replace -match '^[oOyY]') {
  Write-Host ""
  Write-Host "Choisis ta boite mail :" -ForegroundColor Cyan
  Write-Host "  1. Gmail (recommande)"
  Write-Host "  2. Outlook / Hotmail"
  Write-Host "  3. Autre serveur SMTP"
  $choice = Read-Default "Ton choix" "1"

  $provider = 'gmail'; $hostName = 'smtp.gmail.com'; $port = '465'; $secure = 'true'
  if ($choice -eq '2') { $provider = 'outlook'; $hostName = 'smtp.office365.com'; $port = '587'; $secure = 'false' }
  if ($choice -eq '3') {
    $provider = 'custom'
    $hostName = Read-Default "Adresse du serveur SMTP" ""
    $port = Read-Default "Port SMTP" "587"
    $secure = Read-Default "Connexion securisee SSL directe ? (true/false)" "false"
  }

  Write-Host ""
  Write-Host "Gmail : cree un mot de passe d'application sur https://myaccount.google.com/apppasswords" -ForegroundColor Cyan
  Write-Host "Outlook : https://account.microsoft.com/security" -ForegroundColor Cyan
  Write-Host ""
  do {
    $email = Read-Host "Adresse email d'envoi"
    if ($email -notmatch '^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$') { Write-Host "Adresse email invalide." -ForegroundColor Red }
  } while ($email -notmatch '^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$')

  $securePass = Read-Host "Mot de passe d'application (saisie masquee, sans espaces)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Host "Le mot de passe est vide. Relance l'installation." -ForegroundColor Red
    exit 1
  }

  $fromName = Read-Default "Nom affiche dans les mails" "Recherche de stage"
  $maxPerDay = Read-Default "Nombre maximum de mails par jour" "40"
  if ($maxPerDay -notmatch '^\d+$') { $maxPerDay = '40' }
  $real = Read-Host "Activer l'envoi REEL maintenant ? (O/n, O par defaut)"
  $dryRun = if ($real -match '^[nN]') { 'true' } else { 'false' }

  $lines = @(
    '# Configuration generee par INSTALLER.bat - ne pas commiter ce fichier',
    'HOST=127.0.0.1',
    'PORT=3001',
    "SMTP_PROVIDER=$provider",
    "SMTP_HOST=$hostName",
    "SMTP_PORT=$port",
    "SMTP_SECURE=$secure",
    "SMTP_USER=$email",
    "SMTP_PASS=$password",
    "FROM_EMAIL=$email",
    "FROM_NAME=$fromName",
    "MAX_PER_DAY=$maxPerDay",
    'DELAY_MIN_SECONDS=45',
    'DELAY_MAX_SECONDS=90',
    "DRY_RUN=$dryRun",
    'ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,https://xpaladiumyx.github.io'
  )
  [IO.File]::WriteAllLines($envPath, $lines, (New-Object Text.UTF8Encoding($false)))
  Write-Host "Configuration enregistree dans server/.env" -ForegroundColor Green
  if ($dryRun -eq 'true') {
    Write-Host "Mode TEST actif : aucun mail reel ne partira. Relance INSTALLER.bat pour passer en reel." -ForegroundColor Yellow
  } else {
    Write-Host "Envoi REEL active. Fais d'abord un test vers ta propre adresse dans la page Campagne." -ForegroundColor Yellow
  }
}

# 3. Dependances
Write-Host ""
Write-Host "Installation des dependances..." -ForegroundColor Cyan
Push-Location $server
& npm install --no-audit --no-fund
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) {
  Write-Host "L'installation des dependances a echoue. Verifie ta connexion Internet." -ForegroundColor Red
  exit 1
}
Write-Host "Dependances installees." -ForegroundColor Green

# 4. Raccourci Bureau
$shortcutAnswer = Read-Host "Creer un raccourci 'Lancer campagne' sur le Bureau ? (O/n)"
if ($shortcutAnswer -notmatch '^[nN]') {
  try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop 'Lancer campagne - Recherche de stage.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $root 'LANCER-CAMPAGNE.bat'
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = 'Lancer le serveur et la page Campagne - Recherche de stage'
    $shortcut.Save()
    Write-Host "Raccourci cree sur le Bureau." -ForegroundColor Green
  } catch {
    Write-Host "Impossible de creer le raccourci, ce n'est pas grave." -ForegroundColor Yellow
  }
}

# 5. Demarrage
$listening = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host "Demarrage du serveur..." -ForegroundColor Cyan
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$server`" && npm start" -WorkingDirectory $server
  Start-Sleep -Seconds 4
} else {
  Write-Host "Le serveur tourne deja sur le port 3001." -ForegroundColor Green
}
Start-Process "http://localhost:3001/campagne.html"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  C'EST PRET !" -ForegroundColor Green
Write-Host "  La page Campagne vient de s'ouvrir dans ton navigateur." -ForegroundColor Green
Write-Host "  Garde la fenetre noire du serveur ouverte pendant l'envoi." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
