#!/usr/bin/env python3
"""
scripts/run_hash.py
학생 명단 CSV → salt + PBKDF2-SHA256 해시 JSON 변환 스크립트

사용법:
    python scripts/run_hash.py

입력:  scripts/students-raw.csv  (학번,이름 형식, 헤더 없음)
출력:  data/students-hashed.json (로그인 인증에 사용)

⚠️  students-raw.csv 는 절대 git commit 하지 마세요! (.gitignore 처리됨)

왜 PBKDF2 인가:
data/students-hashed.json 은 정적 호스팅이라 누구나 내려받을 수 있습니다.
단순 SHA-256 이면 학번(연도+학과 접두사로 경우의 수가 작음) × 이름 조합을
전수 대입해 재학생 명단을 그대로 복원할 수 있습니다. salt 로 사전 계산을,
높은 반복 횟수로 대입 비용을 올려 이를 실질적으로 어렵게 만듭니다.
(근본 해결은 명단을 서버 측에 두고 검증하는 것 — ADMIN_GUIDE 10장 참고)
"""

import hashlib
import json
import secrets
import sys
from pathlib import Path

# Windows 기본 콘솔(cp949)에서 이모지 출력 시 죽지 않도록 UTF-8 로 맞춘다.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = Path(__file__).parent.parent
INPUT = BASE / "scripts" / "students-raw.csv"
OUTPUT = BASE / "data" / "students-hashed.json"

ITERATIONS = 600_000  # js/auth.js 는 파일에 적힌 값을 그대로 사용한다
KEYLEN = 32           # 256-bit

if not INPUT.exists():
    print(f"❌  파일 없음: {INPUT}")
    sys.exit(1)

salt_hex = secrets.token_hex(32)
salt = bytes.fromhex(salt_hex)

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
        sid = line[:comma].strip()
        name = line[comma + 1:].strip()
        if not sid or not name:
            errors.append(f"  줄 {i}: 학번 또는 이름 비어있음 → {line!r}")
            continue
        key = f"{sid}|{name}".encode("utf-8")
        digest = hashlib.pbkdf2_hmac("sha256", key, salt, ITERATIONS, KEYLEN)
        hashes.append(digest.hex())
        if len(hashes) % 25 == 0:
            print(f"  ...{len(hashes)}명 처리")

if errors:
    print("⚠️  처리 오류:")
    for e in errors:
        print(e)

# CSV 순서(대개 학번 오름차순)가 남지 않도록 정렬해 순서 정보를 없앤다.
hashes.sort()

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(
        {"version": 2, "salt": salt_hex, "iterations": ITERATIONS, "hashes": hashes},
        f,
        indent=2,
        ensure_ascii=False,
    )

print(f"✅  {len(hashes)}명 처리 완료 → {OUTPUT}")
print("👉  다음 단계: git add data/students-hashed.json → commit → push")
