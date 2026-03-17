import argparse
import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRED_DIR = os.path.join(BASE_DIR, "credentials")


def main():
    parser = argparse.ArgumentParser(description="YouTube OAuth2 authentication")
    parser.add_argument("--channel", required=True, help="Channel ID (e.g. agent_zero)")
    args = parser.parse_args()

    channel_id = args.channel
    client_secret_path = os.path.join(CRED_DIR, f"{channel_id}_credentials.json")
    token_path = os.path.join(CRED_DIR, f"token_{channel_id}.json")

    if not os.path.exists(client_secret_path):
        print(f"ERROR: {client_secret_path} not found.")
        print(f"Place your OAuth client secret JSON as: credentials/{channel_id}_credentials.json")
        return

    flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
    credentials = flow.run_local_server(port=8080, prompt="consent")

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes),
    }

    with open(token_path, "w", encoding="utf-8") as f:
        json.dump(token_data, f, indent=2, ensure_ascii=False)

    print(f"Token saved to: {token_path}")
    print("Authentication complete!")


if __name__ == "__main__":
    main()
