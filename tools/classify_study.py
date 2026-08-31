#!/usr/bin/env python3
"""Classify study materials into content-type folders.
Priority: filename convention first, content keywords as fallback.
Output is a plan; does not move files.
"""
import re
from pathlib import Path

ROOT = Path(r"C:\LesargeMusicAI\study-materials")

def cat_from_name(name):
    n = name.lower()
    # Questions / mock exams
    if n.startswith("100 fragen") or "fragenkatalog" in n or "fragen" in n:
        return "fragen-antworten"
    if n.startswith("musterpr"):
        return "musterpruefungen"
    # Stichwortverzeichnis → keyword index
    if "stichwortverzeichnis" in n:
        return "kennzahlen-verzeichnisse"
    # Module core docs (plain NN_Topic.docx like 04_Produktionslogistik) → leave as core
    if re.match(r'^\d+\.', n) or re.match(r'^\d+[ _]', n):
        return "module-kerndokumente"
    # Document type
    if "zusammenfassung" in n:
        return "zusammenfassungen"
    if "powerpoint" in n or name.startswith("LF_PM_4"):
        return "lehrfolien-ppt"
    if "skript" in n or name.startswith("LF_PM_3"):
        return "skripte"
    if "beilage" in n:
        return "beilagen"
    if "werkzeug" in n or "kaizen" in n:
        return "zusatzmaterial"
    if "dokumentenregister" in n or "drehbuch" in n:
        return "projektplanung"
    return None  # fall back to content

def read_text(path):
    try:
        if path.suffix.lower() == ".pdf":
            import pdfplumber
            out = []
            with pdfplumber.open(path) as pdf:
                for pg in pdf.pages[:8]:
                    out.append(pg.extract_text() or "")
            return "\n".join(out)
        else:
            import docx
            return "\n".join(p.text for p in docx.Document(str(path)).paragraphs)
    except Exception:
        return ""

def cat_from_content(text, name):
    t = (text or "").lower()
    n = name.lower()
    if "frage:" in t or ("antwort:" in t) or t.count("?") > 20:
        return "fragen-antworten"
    if "kennzahl" in t and ("bestand" in t or "umschlag" in t or "kpi" in t):
        return "kennzahlen-verzeichnisse"
    return "module-kerndokumente"

def main():
    # Deduplicate: skip files whose stem ends `_<digits>`
    seen = {}
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file():
            continue
        m = re.match(r'^(.*)_\d+(\.[^.]+)$', p.name)
        key = (m.group(1) + m.group(2)) if m else p.name
        if key in seen:
            continue
        seen[key] = p

    results = {}
    for name, path in seen.items():
        cat = cat_from_name(path.name)
        if cat is None:
            text = read_text(path)
            cat = cat_from_content(text, path.name)
        results.setdefault(cat, []).append(path)

    total = 0
    for cat, paths in sorted(results.items()):
        print(f"\n=== {cat.upper()} ({len(paths)}) ===")
        for path in paths:
            print("   ", path.relative_to(ROOT))
            total += 1
    print(f"\nTOTAL: {total} unique files")

if __name__ == "__main__":
    main()
