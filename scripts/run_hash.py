#!/usr/bin/env python3
"""
scripts/run_hash.py
학생 명단 CSV → SHA-256 해시 JSON 변환 스크립트

사용법:
    python scripts/run_hash.py

입력:  scripts/students-raw.csv  (학번,이름 형식, 헤더 없음)
출력:  data/students-hashed.json (로그인 인증에 사용)

⚠️  students-raw.csv 는 절대 git commit 하지 마세요! (.gitignore 처리됨)
"""

import hashlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).parent.parent
INPUT  = BASE / "scripts" / "students-raw.csv"
OUTPUT = BASE / "data" / "students-hashed.json"

if not INPUT.exists():
    print(f"❌  파일 없음: {INPUT}")
    sys.exit(1)

hashes = []
errors = []

# utf-8-sig: Excel/Windows에서 저장한 BOM 포함 UTF-8도 자동 처리
with open(INPUT, encoding="utf-8-sig") as f:
    for i, raw in enumerate(f, 1):
        line = raw.strip()
        if not line:
            continue
        if "," not in line:
            errors.append(f"  줄 {i}: 형식 오류 → {line!r}")
            continue
        comma = line.index(",")
        sid   = line[:comma].strip()
        name  = line[comma + 1:].strip()
        if not sid or not name:
            errors.append(f"  줄 {i}: 학번 또는 이름 비어있음 → {line!r}")
            continue
        key = f"{sid}|{name}"
        hashes.append(hashlib.sha256(key.encode("utf-8")).hexdigest())

if errors:
    print("⚠️  처리 오류:")
    for e in errors:
        print(e)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(hashes, f, indent=2, ensure_ascii=False)

print(f"✅  {len(hashes)}명 처리 완료 → {OUTPUT}")
print("👉  다음 단계: git add data/students-hashed.json && git commit && git push")
