import json
import shutil
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from python.cas import execute_cas_command
from python.cas import list_definitions
from python.cas import clear_all
from python.cas import delete_definition as core_delete_definition
from python.cas import get_cas_folder
from python.wolframalpha import get_wolframalpha_result

app = FastAPI(title="MathIDE API",
              description="API for MathIDE",
              version="1.0.0")

class UserItem(BaseModel):
    command: str
    user_name: str
    project_name: str
    description: str | None = None

class WolframAlphaItem(BaseModel):
    query: str

@app.post("/user/{user_name}/{project_name}/cas/execute/")
async def execute_cas(command: UserItem):
    CAS_FOLDER = get_cas_folder(command.user_name, command.project_name)
    result = execute_cas_command(command.command, CAS_FOLDER=CAS_FOLDER, description=command.description)
    return {"data": result}

@app.get("/user/{user_name}/{project_name}/cas/list/{target}")
async def get_definition(user_name: str, project_name: str, target: str | None = None):
    CAS_FOLDER = get_cas_folder(user_name, project_name)
    return {"definition": list_definitions(CAS_FOLDER=CAS_FOLDER, target_function=target)}

@app.delete("/user/{user_name}/{project_name}/cas/delete/{name}")
async def delete_definition(user_name: str, project_name: str, name: str):
    CAS_FOLDER = get_cas_folder(user_name, project_name)
    core_delete_definition(name, CAS_FOLDER=CAS_FOLDER)
    return {"message": f"Definition deleted: {name}"}

@app.post("/user/{user_name}/{project_name}/wolframalpha/")
async def wolframalpha(item: WolframAlphaItem):
    return {"result": get_wolframalpha_result(item.query)}

@app.delete("/user/{user_name}/{project_name}/cas/clear/")
async def clear_cas(user_name: str, project_name: str):
    CAS_FOLDER = get_cas_folder(user_name, project_name)
    clear_all(CAS_FOLDER=CAS_FOLDER)
    return {"message": "All definitions cleared in CAS folder"}

@app.post("/user/{user_name}/{project_name}/project/save/")
async def save_project(user_name: str, project_name: str, data: dict):
    CAL_FOLDER = get_cas_folder(user_name, project_name)
    project_folder = CAL_FOLDER.parent
    project_file = project_folder / "project.json"
    with open(project_file, "w") as f:
        json.dump(data, f, indent=4)
    
    return {"message": f"Project {project_name} saved for user {user_name}"}

@app.get("/user/{user_name}/{project_name}/project/data/")
async def load_project(user_name: str, project_name: str):
    CAL_FOLDER = get_cas_folder(user_name, project_name)
    project_folder = CAL_FOLDER.parent
    project_file = project_folder / "project.json"
    
    if not project_file.exists():
        return {"message": f"No project found for {project_name} of user {user_name}"}
    
    with open(project_file, "r") as f:
        data = json.load(f)
    
    return {"data": data}

@app.delete("/user/{user_name}/{project_name}/project/delete/")
async def delete_project(user_name: str, project_name: str):
    CAL_FOLDER = get_cas_folder(user_name, project_name)
    project_folder = CAL_FOLDER.parent
    if project_folder.exists():
        shutil.rmtree(project_folder)
        return {"message": f"Project {project_name} deleted for user {user_name}"}
    else:
        return {"message": f"No project found for {project_name} of user {user_name}"}

@app.post("/user/{user_name}/{project_name}/project/create/")
async def create_project(user_name: str, project_name: str):
    CAL_FOLDER = get_cas_folder(user_name, project_name)
    project_folder = CAL_FOLDER.parent
    project_file = project_folder / "project.json"

    if project_file.exists():
        return {"message": f"Project {project_name} already exists for user {user_name}"}
    
    project_folder.mkdir(parents=True, exist_ok=True)
    
    print(project_folder)

    with open(project_file, "w") as f:
        json.dump({}, f, indent=4)

    return {"message": f"Project {project_name} created for user {user_name}"}

@app.post("/user/{user_name}/{project_name}/project/rename/")
async def rename_project(user_name: str, project_name: str, new_name: str):
    CAL_FOLDER = get_cas_folder(user_name, project_name)
    project_folder = CAL_FOLDER.parent
    project_file = project_folder / "project.json"

    if not project_file.exists():
        return {"message": f"No project found for {project_name} of user {user_name}"}

    new_project_file = project_folder / f"{new_name}.json"
    project_file.rename(new_project_file)

    return {"message": f"Project {project_name} renamed to {new_name} for user {user_name}"}

BASE_DIR = Path(__file__).resolve().parent
if (BASE_DIR / "dist").exists():
    app.mount("/", StaticFiles(directory=BASE_DIR / "dist", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)