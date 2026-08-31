#!/usr/bin/env python3
"""
unzip_organizer.py -- Unzip a file and auto-organize contents into:
    tables/    -> .csv .xlsx .xls .tsv .parquet .json .sql .db .sqlite
    charts/    -> .svg .pdf .pptx .ppt .pptm .xml (when chart data)
    images/    -> .jpg .jpeg .png .gif .bmp .webp .tiff .tif .ico .heic .heif
    banners/   -> images with wide aspect ratio (≥2:1) OR filenames containing "banner"
    audio/     -> .mp3 .wav .flac .ogg .m4a .aac .wma
    video/     -> .mp4 .avi .mov .mkv .webm .wmv .flv
    documents/ -> .pdf .doc .docx .txt .md .rtf .odt .epub
    code/      -> .py .js .ts .jsx .tsx .html .css .java .c .cpp .go .rs .rb .php
    archives/  -> .zip .rar .7z .tar .gz .bz2 .xz
    fonts/     -> .ttf .otf .woff .woff2 .eot
    other/     -> everything else

Usage:
    python unzip_organizer.py <zipfile.zip> [--output <dir>] [--clean] [--dry-run]

    --output, -o   Output directory (default: ./unzipped_<zipname>)
    --clean, -c    Remove the original zip after extraction
    --dry-run, -n  Show what would happen without moving files
"""

import argparse
import os
import shutil
import sys
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Classification rules -- extension -> category
# ---------------------------------------------------------------------------
TABLE_EXTS   = {'.csv', '.xlsx', '.xls', '.tsv', '.parquet', '.sql', '.db',
                '.sqlite', '.sqlite3', '.ods', '.numbers'}
CHART_EXTS   = {'.pptx', '.ppt', '.pptm', '.key', '.odp', '.xml', '.svg'}
IMAGE_EXTS   = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff',
                '.tif', '.ico', '.heic', '.heif', '.raw', '.cr2', '.nef',
                '.avif', '.jfif'}
AUDIO_EXTS   = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma',
                '.opus', '.aiff'}
VIDEO_EXTS   = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv',
                '.m4v', '.mpg', '.mpeg', '.3gp'}
DOCUMENT_EXTS = {'.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt',
                 '.epub', '.tex', '.log', '.csv'}   # .csv also tables-first
CODE_EXTS    = {'.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css',
                '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb',
                '.php', '.sh', '.bat', '.ps1', '.yaml', '.yml', '.toml',
                '.ini', '.cfg', '.conf', '.env', '.json'}
ARCHIVE_EXTS = {'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.zst'}
FONT_EXTS    = {'.ttf', '.otf', '.woff', '.woff2', '.eot'}

# Priority: first match wins
CATEGORY_PRIORITY = [
    ('tables',    TABLE_EXTS),
    ('charts',    CHART_EXTS),
    ('images',    IMAGE_EXTS),
    ('audio',     AUDIO_EXTS),
    ('video',     VIDEO_EXTS),
    ('documents', DOCUMENT_EXTS),
    ('code',      CODE_EXTS),
    ('archives',  ARCHIVE_EXTS),
    ('fonts',     FONT_EXTS),
]

# ---------------------------------------------------------------------------
# Banner detection heuristic (wide image = banner)
# ---------------------------------------------------------------------------
BANNER_KEYWORDS = {'banner', 'header', 'hero', 'splash', 'promo', 'ad ',
                    'leaderboard', 'billboard', 'jumbotron'}

def _try_get_image_width_height(filepath: Path):
    """Return (width, height) using Pillow, or (0,0) on failure."""
    try:
        from PIL import Image
        with Image.open(filepath) as img:
            return img.size
    except Exception:
        return (0, 0)

def _is_banner(filepath: Path) -> bool:
    name_lower = filepath.name.lower()
    if any(kw in name_lower for kw in BANNER_KEYWORDS):
        return True
    w, h = _try_get_image_width_height(filepath)
    if w > 0 and h > 0:
        ratio = w / h
        if ratio >= 2.0 and w >= 400:
            return True
    return False

# ---------------------------------------------------------------------------
# Core classifier
# ---------------------------------------------------------------------------
def classify(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    for category, exts in CATEGORY_PRIORITY:
        if ext in exts:
            if category == 'images' and _is_banner(filepath):
                return 'banners'
            return category
    return 'other'

# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------
def organize(zip_path: str, output_dir: str | None = None,
             clean: bool = False, dry_run: bool = False):

    zip_path = Path(zip_path).resolve()
    if not zip_path.exists():
        print(f"ERROR: {zip_path} not found", file=sys.stderr)
        sys.exit(1)

    stem = zip_path.stem
    if output_dir:
        dest_root = Path(output_dir).resolve()
    else:
        dest_root = zip_path.parent / f"unzipped_{stem}"
    dest_root.mkdir(parents=True, exist_ok=True)

    print(f"{'[DRY RUN] ' if dry_run else ''}Extracting {zip_path.name}")
    print(f"  >> {dest_root}\n")

    # Create category subdirs
    categories = [c for c, _ in CATEGORY_PRIORITY] + ['banners', 'other']
    for cat in categories:
        (dest_root / cat).mkdir(exist_ok=True)

    stats = {cat: 0 for cat in categories}
    skipped_dirs = 0

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for info in zf.infolist():
            if info.is_dir():
                skipped_dirs += 1
                continue

            raw_name = info.filename
            filename = Path(raw_name).name
            if not filename:
                continue

            ext = Path(filename).suffix.lower()
            if ext:
                cat = classify(Path(filename))
            else:
                cat = 'other'

            # Preserve subdirectory structure inside category folder
            parts = Path(raw_name).parts
            if len(parts) > 1:
                subdir = dest_root / cat / Path(*parts[:-1])
            else:
                subdir = dest_root / cat

            target = subdir / filename

            # Handle duplicates
            if target.exists():
                base = target.stem
                suffix_num = 1
                while target.exists():
                    target = subdir / f"{base}_{suffix_num}{target.suffix}"
                    suffix_num += 1

            if dry_run:
                print(f"  [{cat:10}] {raw_name}")
            else:
                subdir.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(target, 'wb') as dst:
                    dst.write(src.read())
                # Try to get file size
                size_kb = info.file_size / 1024
                if size_kb > 1024:
                    size_str = f"{size_kb/1024:.1f} MB"
                else:
                    size_str = f"{size_kb:.0f} KB"
                print(f"  [{cat:10}] {raw_name}  ({size_str})")

            stats[cat] += 1

    # Summary
    total = sum(stats.values())
    print(f"\n{'=' * 50}")
    print(f"  Total files:  {total}")
    print(f"  Skipped dirs: {skipped_dirs}")
    print(f"{'=' * 50}")
    for cat, count in sorted(stats.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  {cat:12}  {count:>5} files")
    print(f"{'=' * 50}")

    if clean and not dry_run:
        zip_path.unlink()
        print(f"\n  Deleted {zip_path.name}")

    print(f"\nDone -> {dest_root}")
    return stats

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Unzip and organize files by type (tables/images/banners/etc)")
    parser.add_argument("zipfile", help="Path to the zip file")
    parser.add_argument("-o", "--output", help="Output directory")
    parser.add_argument("-c", "--clean", action="store_true",
                        help="Delete the zip after extraction")
    parser.add_argument("-n", "--dry-run", action="store_true",
                        help="Show classification without extracting")
    args = parser.parse_args()
    organize(args.zipfile, args.output, args.clean, args.dry_run)

if __name__ == "__main__":
    main()
