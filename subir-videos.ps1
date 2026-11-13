# subir-videos.ps1 — (en la computadora del usuario) sube los manuales en video a Vuneit450/videos-tableau (siempre desde Descargas)
# ÚNICO CAMBIO: la lista $Videos. Una línea por video:
#   "NOMBRE.mp4"                          -> se llama igual en Descargas y en GitHub
#   "NOMBRE-EN-GITHUB.mp4 <= ARCHIVO.mp4"  -> en GitHub con el nombre de la izquierda; en Descargas, el de la derecha
# Correr:  powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\subir-videos.ps1"
# En una sesión de Claude, el equivalente es publicar_video.py (sube solo, sin preguntar).
# Si el nombre ya existe en GitHub, se reemplaza (los links no cambian). Si no existe, se agrega como video nuevo.
# Los videos también se pueden pasar al correrlo, sin editar el archivo:
#   powershell -ExecutionPolicy Bypass -File subir-videos.ps1 "MANUAL-X.mp4 <= ARCHIVO.mp4" "MANUAL-Y.mp4"
# Para bajarlo y correrlo en un solo paso (está publicado en el repo VIDEOS-TABLEAU):
#   irm https://raw.githubusercontent.com/Vuneit450/VIDEOS-TABLEAU/main/subir-videos.ps1 -OutFile "$env:TEMP\subir-videos.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\subir-videos.ps1" "MANUAL-X.mp4 <= ARCHIVO.mp4"
$Videos = @(
  "MANUAL-CLIENTE.mp4 <= MANUAL-COBRANZA-CLIENTE.mp4"
  "MANUAL-OTRO-CLIENTE.mp4"
)
if ($args.Count -gt 0) { $Videos = @($args) }   # los que se pasen al correrlo mandan sobre la lista de arriba

& {
$ErrorActionPreference = "Stop"
$Repo      = "https://Vuneit450@github.com/Vuneit450/VIDEOS-TABLEAU.git"   # entra con la cuenta Vuneit450
$Autor     = "Jonathan Frias"
$Correo    = "Vuneit450@users.noreply.github.com"                          # correo privado de GitHub de Vuneit450
$Carpeta   = Join-Path $env:TEMP "videos-tableau"
$Descargas = Join-Path $env:USERPROFILE "Downloads"
$PortadaGenerica = "portadas/Binatsa_tableau.png"   # para videos nuevos sin portada propia (se cambia después)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "Falta Git: https://git-scm.com/download/win"; return }

# 1. Leer la lista y revisar cada archivo en Descargas
$Plan = @()
foreach ($linea in $Videos) {
  if ($linea -match '^\s*(.+?)\s*<=\s*(.+?)\s*$') { $destino = $Matches[1]; $archivo = $Matches[2] } else { $destino = $linea.Trim(); $archivo = $linea.Trim() }
  if ($destino -match '\s') { Write-Host "El nombre en GitHub no debe llevar espacios: '$destino' (usa guiones)."; return }
  $ruta = Join-Path $Descargas $archivo
  if (-not (Test-Path $ruta)) { Write-Host "No encontré $ruta"; return }
  $item = Get-Item $ruta; $mb = [math]::Round($item.Length / 1MB, 1)
  if ($mb -ge 100) { Write-Host "$archivo pesa $mb MB; GitHub no acepta 100 MB o más."; return }
  $Plan += [pscustomobject]@{ Destino = $destino; Ruta = $ruta; MB = $mb; Fecha = $item.LastWriteTime }
}

# 2. Copia limpia del repo
if (Test-Path $Carpeta) { Remove-Item $Carpeta -Recurse -Force }
git clone --depth 1 $Repo $Carpeta
if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo clonar el repo (inicia sesión en GitHub como Vuneit450)."; return }

Write-Host ""
foreach ($p in $Plan) {
  $p | Add-Member Nuevo (-not (Test-Path (Join-Path $Carpeta "MANUALES-DE-USO\$($p.Destino)")))
  $accion = if ($p.Nuevo) { "NUEVO     " } else { "REEMPLAZA " }
  Write-Host ("{0} {1}  <=  {2}  ({3} MB, modificado {4})" -f $accion, $p.Destino, (Split-Path $p.Ruta -Leaf), $p.MB, $p.Fecha)
}
Write-Host ""
Write-Host "Revisa que las fechas sean las de los videos NUEVOS."
$resp = Read-Host "¿Subo estos $($Plan.Count) videos? (s/n)"
if ($resp -ne "s") { Write-Host "Cancelado. No se subió nada."; return }

# 3. Copiar los videos; a los nuevos, agregarles su línea en index.html
$Index = Join-Path $Carpeta "index.html"
foreach ($p in $Plan) {
  Copy-Item $p.Ruta (Join-Path $Carpeta "MANUALES-DE-USO\$($p.Destino)") -Force
  if ($p.Nuevo) {
    $base = [IO.Path]::GetFileNameWithoutExtension($p.Destino)
    $id = $base.ToLower() -replace '[^a-z0-9]+', '-'
    $nombre = ($base -replace '^MANUAL-', '' -replace '[-_]+', ' ')
    $nueva = "    { id: '$id', nombre: '$nombre', video: 'MANUALES-DE-USO/$($p.Destino)', portada: '$PortadaGenerica' },"
    $lineas = [Collections.Generic.List[string]](Get-Content $Index -Encoding UTF8)
    $ultima = -1; for ($i = 0; $i -lt $lineas.Count; $i++) { if ($lineas[$i] -match "^\s*\{ id: '") { $ultima = $i } }
    if ($ultima -ge 0) { $lineas.Insert($ultima + 1, $nueva); Set-Content $Index $lineas -Encoding UTF8; Write-Host "index.html: agregado '$nombre' (con la portada genérica; cámbiala después)" }
    else { Write-Host "Aviso: no encontré la lista de videos en index.html; agrega '$($p.Destino)' a mano." }
  }
}

# 4. Subir (como Jonathan Frias, cuenta Vuneit450)
Push-Location $Carpeta
git config user.name  $Autor
git config user.email $Correo
git add MANUALES-DE-USO index.html
git status --short
git commit -m "Manuales en video: $(($Plan | ForEach-Object { $_.Destino }) -join ', ')"
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "No hubo cambios: los archivos son iguales a los publicados."; return }
git push origin main
$ok = $LASTEXITCODE
Pop-Location
if ($ok -ne 0) { Write-Host "El push falló. Revisa que hayas iniciado sesión como Vuneit450."; return }

# 5. Comprobar los links (GitHub Pages tarda 1-2 min)
Write-Host ""
Write-Host "Esperando a que GitHub Pages publique..."
Start-Sleep -Seconds 180
foreach ($p in $Plan) {
  $url = "https://vuneit450.github.io/VIDEOS-TABLEAU/MANUALES-DE-USO/$($p.Destino)"
  try {
    $r = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing
    if ([long]$r.Headers["Content-Length"] -eq (Get-Item $p.Ruta).Length) { Write-Host "OK      $url" }
    else { Write-Host "AÚN NO  $url (GitHub Pages aún no termina; revisa el link en unos minutos)" }
  } catch { Write-Host "ERROR   $url  $($_.Exception.Message)" }
}
}
