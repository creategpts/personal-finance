"""App de escritorio: misma ventana nativa aloja backend y frontend en un solo
proceso, así que arrancan y mueren juntos al cerrar la ventana. Requiere
frontend/dist ya construido (ver desktop.command) — main.py sirve esos
estáticos cuando existen.
"""

import threading
import time

import uvicorn
import webview

from app.main import app

URL = "http://127.0.0.1:8000"

config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
server = uvicorn.Server(config)


def _wait_started(timeout=15):
    # server.started solo se pone a True tras un bind de verdad — a diferencia de
    # sondear /api/health, no se confunde con OTRO proceso ya escuchando en el puerto.
    deadline = time.time() + timeout
    while time.time() < deadline and not server.started:
        time.sleep(0.1)
    return server.started


if __name__ == "__main__":
    threading.Thread(target=server.run, daemon=True).start()

    if _wait_started():
        webview.create_window("Life Track", URL, width=1280, height=860, min_size=(960, 640), maximized=True)
    else:
        webview.create_window(
            "Life Track",
            html="<body style='font-family:-apple-system;padding:2rem'>"
            "<h2>No se pudo arrancar</h2>"
            "<p>El puerto 8000 ya está en uso por otro proceso. Ciérralo "
            "(otra ventana de Life Track, o un start.command abierto) y vuelve a intentarlo.</p>"
            "</body>",
            width=520,
            height=240,
        )
    webview.start()
