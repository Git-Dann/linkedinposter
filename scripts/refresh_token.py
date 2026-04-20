"""
Refresh the LinkedIn access token using a stored refresh token.

Run manually when your access token is close to expiring. Prints the new
tokens to paste back into GitHub Secrets.

LinkedIn's refresh_token flow requires the "Programmatic refresh tokens"
feature to be enabled on your app. If it isn't, the initial auth.py call
will not return a refresh token and you need to re-run auth.py every 60 days.

Env vars:
    LINKEDIN_CLIENT_ID
    LINKEDIN_CLIENT_SECRET
    LINKEDIN_REFRESH_TOKEN
"""

import os
import sys

import requests


def main():
    cid = os.environ.get("LINKEDIN_CLIENT_ID")
    cs = os.environ.get("LINKEDIN_CLIENT_SECRET")
    rt = os.environ.get("LINKEDIN_REFRESH_TOKEN")
    if not (cid and cs and rt):
        print("ERROR: set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN.")
        sys.exit(1)

    resp = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": cid,
            "client_secret": cs,
        },
        timeout=30,
    )
    resp.raise_for_status()
    tokens = resp.json()

    print("=" * 60)
    print("Update these in GitHub Secrets:")
    print("=" * 60)
    print(f"LINKEDIN_ACCESS_TOKEN   = {tokens['access_token']}")
    if tokens.get("refresh_token"):
        print(f"LINKEDIN_REFRESH_TOKEN  = {tokens['refresh_token']}")
    print(f"\nExpires in {tokens.get('expires_in')} seconds.")


if __name__ == "__main__":
    main()
