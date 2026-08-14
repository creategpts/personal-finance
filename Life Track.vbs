' Doble click para arrancar Life Track sin que se vea ninguna consola -- llama
' a desktop.bat oculto (0 = ventana oculta, False = no esperar a que termine).
' Sigue haciendo falta desktop.bat: este .vbs es solo la version silenciosa
' para el dia a dia, una vez que la primera vez ya paso por desktop.bat visible
' (o por este mismo) sin errores.
CreateObject("WScript.Shell").Run """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\desktop.bat""", 0, False
