"""
One-off local OAuth flow for LinkedIn.

Run this ONCE on your laptop. It opens a browser, you approve the app,
and it prints the access token + refresh token for you to paste into
GitHub Secrets.

Usage:
    export LINKEDIN_CLIENT_ID=xxx
    export LINKEDIN_CLIENT_SECRET=xxx
    python scripts/auth.py

Requires the LinkedIn app to have these products added:
  - "Sign In with LinkedIn using OpenID Connect"
  - "Share on LinkedIn"

And redirect URL set to: http://localhost:8000/callback
"""

import http.server
import os
import secrets
import socketserver
import sys
import urllib.parse
import webbrowser
from typing import Optional

import requests

CLIENT_ID = os.environ.get("LINKEDIN_CLIENT_ID")
CLIENT_SECRET = os.environ.get("LINKEDIN_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:8000/callback"
SCOPES = "openid profile email w_member_social"
PORT = 8000

_auth_code: Optional[str] = None
_state_expected = secrets.token_urlsafe(16)


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global _auth_code
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return
        params = urllib.parse.parse_qs(parsed.query)
        if params.get("state", [None])[0] != _state_expected:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"State mismatch. Possible CSRF. Abort.")
            return
        if "error" in params:
            self.send_response(400)
            self.end_headers()
            msg = f"LinkedIn error: {params.get('error')} - {params.get('error_description')}"
            self.wfile.write(msg.encode())
            return
        _auth_code = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<h2>Authorised.</h2><p>You can close this tab and return to the terminal.</p>"
        )

    def log_message(self, format, *args):
        return  # silence


def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        print("ERROR: set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET env vars.")
        sys.exit(1)

    auth_url = "https://www.linkedin.com/oauth/v2/authorization?" + urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "state": _state_expected,
            "scope": SCOPES,
        }
    )

    print("Opening browser for LinkedIn authorisation...")
    print(f"If it doesn't open, visit:\n{auth_url}\n")
    webbrowser.open(auth_url)

    with socketserver.TCPServer(("127.0.0.1", PORT), CallbackHandler) as httpd:
        while _auth_code is None:
            httpd.handle_request()

    print("Got authorisation code. Exchanging for tokens...")
    resp = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code",
            "code": _auth_code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=30,
    )
    resp.raise_for_status()
    tokens = resp.json()

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in")
    refresh_expires_in = tokens.get("refresh_token_expires_in")

    # Resolve the author URN via /v2/userinfo
    who = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    who.raise_for_status()
    sub = who.json().get("sub")  # person id
    author_urn = f"urn:li:person:{sub}"

    print("\n" + "=" * 60)
    print("SUCCESS. Paste these into your GitHub repo secrets:")
    print("=" * 60)
    print(f"LINKEDIN_ACCESS_TOKEN   = {access_token}")
    if refresh_token:
        print(f"LINKEDIN_REFRESH_TOKEN  = {refresh_token}")
    else:
        print("LINKEDIN_REFRESH_TOKEN  = (not issued - refresh not enabled on app)")
    print(f"LINKEDIN_AUTHOR_URN     = {author_urn}")
    print("=" * 60)
    print(f"\nAccess token expires in {expires_in} seconds "
          f"(~{expires_in // 86400} days).")
    if refresh_expires_in:
        print(f"Refresh token valid for {refresh_expires_in // 86400} days.")
    print("\nIf no refresh token was issued, re-run this script before the access "
          "token expires (check 'Auth' tab in your LinkedIn app for refresh config).")


if __name__ == "__main__":
    main()
