-- Fuente de "Life Track.app" — se compila localmente (ver desktop.command):
--   osacompile -o "Life Track.app" desktop.applescript
-- No se commitea el .app: cada máquina genera el suyo. Así no hay rutas
-- absolutas de nadie dentro, ni cuarentena de Gatekeeper al bajar el repo,
-- y TCC (permiso de Documentos) registra una identidad local limpia.
--
-- Un script con shebang metido a pelo como CFBundleExecutable no recibe bien
-- los permisos de TCC — macOS no lo trata como app "de verdad". Compilado con
-- osacompile es un binario real y Ajustes del Sistema lo trata como cualquier app.
on run
	-- el .app vive en la raíz del repo; su carpeta contenedora ES el repo
	set repoRoot to POSIX path of ((path to me as text) & "::")
	do shell script "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; " & quoted form of (repoRoot & "desktop.command") & " >> /tmp/lifetrack_launch.log 2>&1"
end run
