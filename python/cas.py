import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    implicit_application,
    convert_xor,
    function_exponentiation,
)
from sympy.core.symbol import Symbol

import json
from pathlib import Path

# ---...
# Transformations
# ---...
transformations = (
    standard_transformations
    + (
        implicit_multiplication_application,
        implicit_application,
        function_exponentiation,
        convert_xor,
    )
)

# ---...
# CAS environment
# ---...
def make_default_env():
    return {
        "sp": sp,
        "pi": sp.pi,
        "E": sp.E,
        "I": sp.I,
        "sin": sp.sin,
        "cos": sp.cos,
        "tan": sp.tan,
        "exp": sp.exp,
        "log": sp.log,
        "sqrt": sp.sqrt,
        "diff": sp.diff,
        "integrate": sp.integrate,
        "limit": sp.limit,
        "solve": sp.solve,
        "factor": sp.factor,
        "expand": sp.expand,
        "simplify": sp.simplify,
    }

env = make_default_env()
history: list[str] = []
BUILTIN_KEYS = set(make_default_env().keys())


# ---...
# 定義をJSON形式で管理
# ---...
def _get_metadata_file(CAS_FOLDER: Path) -> Path:
    """メタデータファイルのパスを取得(関数の定義情報を記録)"""
    return CAS_FOLDER / ".metadata.json"


def _load_metadata(CAS_FOLDER: Path):

    """保存されたメタデータを読み込む"""
    meta_file = _get_metadata_file(CAS_FOLDER)
    if meta_file.exists():
        with open(meta_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_metadata(metadata, CAS_FOLDER: Path):
    """メタデータを保存"""
    meta_file = _get_metadata_file(CAS_FOLDER)
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def _auto_save_function(fname: str, args: list[str], expr_str: str, CAS_FOLDER: Path, description: str | None = None, ):
    """関数定義を自動保存(1ファイル1関数)"""
    filename = CAS_FOLDER / f"{fname}.cas"

    # テキスト形式で保存
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"{fname}({', '.join(args)}) = {expr_str}\n")

    # メタデータを更新
    metadata = _load_metadata(CAS_FOLDER)
    metadata[fname] = {
        "file": str(filename.name),
        "args": args,
        "expression": expr_str,
        "description": description,
        "type": "function",
    }
    _save_metadata(metadata, CAS_FOLDER)

    print(f"  → Auto-saved: {filename}")


def _auto_save_variable(varname: str, expr_str: str, CAS_FOLDER: Path):
    """変数定義を自動保存"""
    filename = CAS_FOLDER / f"{varname}.cas"

    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"{varname} = {expr_str}\n")

    metadata = _load_metadata(CAS_FOLDER)
    metadata[varname] = {
        "file": str(filename.name),
        "expression": expr_str,
        "type": "variable",
    }
    _save_metadata(metadata, CAS_FOLDER)

    print(f"  → Auto-saved: {filename}")


# ---...
# CAS core
# ---...
def cas(s: str, CAS_FOLDER: Path,record: bool = True, auto_save: bool = True, description: str | None = None) -> Symbol | str:
    global env

    s = s.strip()

    # =============================
    # 1. assignment / function def
    # =============================
    if "=" in s and not s.startswith(("solve", "Eq")):
        left, right = s.split("=", 1)
        left = left.strip()
        right = right.strip()

        # ---- function definition ----
        if "(" in left and ")" in left:
            fname = left[: left.index("(")].strip()
            arg_str = left[left.index("(") + 1 : left.index(")")]
            args = [a.strip() for a in arg_str.split(",") if a.strip()]

            sym_args = []
            for a in args:
                if a in env:
                    sym_args.append(env[a])
                else:
                    env[a] = sp.Symbol(a)
                    sym_args.append(env[a])

            expr = parse_expr(right, local_dict=env, transformations=transformations)
            env[fname] = sp.Lambda(sym_args, expr)

            if record:
                history.append(s)

            # 自動保存
            if auto_save:
                _auto_save_function(fname, args, right, CAS_FOLDER=CAS_FOLDER, description=description)

            return f"{fname}({', '.join(args)}) = {expr}"

        # ---- normal variable ----
        expr = parse_expr(right, local_dict=env, transformations=transformations)
        env[left] = expr

        if record:
            history.append(s)

        # 自動保存
        if auto_save:
            _auto_save_variable(left, right, CAS_FOLDER=CAS_FOLDER)

        return f"{left} = {expr}"

    # =============================
    # 2. normal evaluation
    # =============================
    expr = parse_expr(s, local_dict=env, transformations=transformations)
    return expr


# ---...
# 読み込み / 復元
# ---...
def load_from_cas_folder(CAS_FOLDER: Path):
    """CAS フォルダからメタデータを読み込み、全て復元"""
    metadata = _load_metadata(CAS_FOLDER)
    if not metadata:
        print("(no saved definitions in CAS folder)")
        return

    for name, info in metadata.items():
        if info["type"] == "function":
            definition = f"{name}({', '.join(info['args'])}) = {info['expression']}"
        else:  # variable
            definition = f"{name} = {info['expression']}"

        try:
            cas(definition, CAS_FOLDER=CAS_FOLDER, record=True, auto_save=False)
        except Exception as e:
            print(f"  Warning: Could not load {name}: {e}")

    print(f"Loaded {len(metadata)} definitions from CAS folder")


def list_definitions(CAS_FOLDER: Path, target_function: str | None = None) -> dict[str, str] | str:
    """CAS フォルダの定義一覧"""
    metadata = _load_metadata(CAS_FOLDER)
    if not metadata:
        return "(no definitions in CAS folder)"

    data = {}
    for name, info in sorted(metadata.items()):
        if info["type"] == "function":
            if name == target_function:
                return {"name": name, "args": info["args"], "expression": info["expression"], "description": info["description"]}
            data[name] = f"{name}({', '.join(info['args'])}) = {info['expression']}"
        else:
            data[name] = f"{name} = {info['expression']}"

    return data


def clear_all(CAS_FOLDER: Path):
    """CAS フォルダをクリア"""
    metadata = _load_metadata(CAS_FOLDER)
    for name in metadata:
        file_path = CAS_FOLDER / metadata[name]["file"]
        if file_path.exists():
            file_path.unlink()
    _save_metadata({}, CAS_FOLDER=CAS_FOLDER)
    print("Cleared all definitions in CAS folder")

def delete_definition(name: str, CAS_FOLDER: Path):
    """指定された名前の定義を削除"""
    metadata = _load_metadata(CAS_FOLDER)
    if name in metadata:
        file_path = CAS_FOLDER / metadata[name]["file"]
        if file_path.exists():
            file_path.unlink()
        del metadata[name]
        _save_metadata(metadata, CAS_FOLDER=CAS_FOLDER)
        print(f"Deleted definition: {name}")
    else:
        print(f"No definition found for: {name}")

def get_cas_folder(user_name: str, project_name: str) -> Path:
    """CAS フォルダを取得"""
    CAS_FOLDER = Path("Users") / user_name / project_name / "CAS"
    CAS_FOLDER.mkdir(parents=True, exist_ok=True)
    return CAS_FOLDER

def execute_cas_command(command: str, CAS_FOLDER: Path, description: str | None = None):
    """CAS コマンドを実行し、結果を返す"""
    load_from_cas_folder(CAS_FOLDER)
    
    try:
        res = cas(command, CAS_FOLDER=CAS_FOLDER, description=description)
        result_str = f"Exact: {res}"
        if hasattr(res, "evalf"):
            result_str += f"\nApprox: {res.evalf()}"
            print("Formula: $${{sp.latex(res)}}$$")
        return result_str
    except Exception as e:
        return f"Error: {e}"