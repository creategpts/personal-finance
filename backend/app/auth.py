import base64
import os
from urllib.parse import urlparse

import jwt
import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

NEON_AUTH_BASE_URL = os.environ.get("NEON_AUTH_BASE_URL", "")
JWKS_URL = f"{NEON_AUTH_BASE_URL}/.well-known/jwks.json"
_parsed = urlparse(NEON_AUTH_BASE_URL)
ORIGIN = f"{_parsed.scheme}://{_parsed.netloc}"

PUBLIC_PATHS = {"/api/health"}


def _signing_key(token: str, jwks: dict) -> Ed25519PublicKey:
    kid = jwt.get_unverified_header(token)["kid"]
    for jwk in jwks["keys"]:
        if jwk["kid"] == kid:
            public_key_bytes = base64.urlsafe_b64decode(jwk["x"] + "==")
            return Ed25519PublicKey.from_public_bytes(public_key_bytes)
    raise ValueError("Matching JWK not found")


def validate_neon_token(token: str) -> dict:
    # ponytail: fetches JWKS fresh every call, no cache — fine at personal-app
    # traffic; add a TTL cache here if this ever becomes a bottleneck.
    jwks = requests.get(JWKS_URL, timeout=5).json()
    signing_key = _signing_key(token, jwks)
    return jwt.decode(token, key=signing_key, algorithms=["EdDSA"], issuer=ORIGIN, audience=ORIGIN)


class NeonAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or not path.startswith("/api") or path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        try:
            validate_neon_token(auth_header.removeprefix("Bearer "))
        except Exception:
            return JSONResponse({"detail": "Invalid token"}, status_code=401)

        return await call_next(request)
