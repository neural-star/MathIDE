import requests

url = "http://localhost:8000/cas/"
data = {
    "command": input("Enter CAS command: "),
    "description": "Simple addition"
}

response = requests.post(url, json=data)

if response.status_code == 200:
    print("Response:", response.json())
else:
    print("Error:", response.status_code, response.text)
