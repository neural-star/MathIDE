import os
import requests

APP_ID = os.getenv("WOLFRAMALPHA_APP_ID")

url = "https://api.wolframalpha.com/v2/query"

def get_wolframalpha_result(query: str) -> dict:
    params = {
        "appid": APP_ID,
        "input": query,
        "output": "json"
    }

    response = requests.get(url, params=params)

    return response.json()