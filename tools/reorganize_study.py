#!/usr/bin/env python3
"""Reorganize study-materials into content-type folders.
Each category is a top-level folder; module subfolder is preserved inside.
Moves the 63 unique files (skips the _N duplicates).
"""
import re, shutil
from pathlib import Path

ROOT = Path(r"C:\LesargeMusicAI\study-materials")

def cat_from_name(name, text="", stem=""):
    n = name.lower()
    if n.startswith("100 fragen") or "fragenkatalog" in n or "fragen" in n and "stichwort" not in n:
        return "fragen-antworten"
    if n.startswith("musterpr") or (n.startswith("musterpr")):
        return "musterpruefungen"
    if "stichwortverzeichnis" in n:
        return "kennzahlen-verzeichnisse"
    if "zusammenfassung" in n:
        return "zusammenfassungen"
    if "powerpoint" in n:
        return "lehrfolien-ppt"
    if "skript" in n:
        return "skripte"
    if "beilage" in n:
        return "beilagen"
    if "werkzeug" in n or "kaizen" in n:
        return "zusatzmaterial"
    if "dokumentenregister" in n or "drehbuch" in n:
        return "projektplanung"
    return "module-kerndokumente"

def main():
    # Collect unique files (skip _N dupes)
    files = []
    seen = set()
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        m = re.match(r'^(.*)_\d+(\.[^.]+)$', p.name)
        key = (m.group(1) + m.group(2)) if m else p.name
        if key in seen:
            continue
        seen.add(key)
        files.append((key, p))

    for key, path in files:
        cat = cat_from_name(path.name)
        # module subfolder = parent folder name
        module = path.parent.name if path.parent != ROOT else ""
        dest_dir = ROOT / cat
        if module:
            dest_dir = dest_dir / module
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / key
        if dest.exists():
            continue
        shutil.move(str(path), str(dest))
        print(f"moved -> {cat}/{module}/{key}")

    print("\nDone.")

if __name__ == "__main__":
    main()
