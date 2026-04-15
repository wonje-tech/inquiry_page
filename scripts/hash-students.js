#!/usr/bin/env node
// ============================================================
//  scripts/hash-students.js
//  학생 명단 → SHA-256 해시 변환 (로컬 전용 스크립트)
//
//  사용법:
//    1. scripts/students-raw.csv 작성
//       형식(헤더 없음): 학번,이름
//       예) 20201234,홍길동
//    2. node scripts/hash-students.js
//    3. data/students-hashed.json 생성됨 → 커밋
//
//  ⚠️  students-raw.csv 는 절대 커밋하지 마세요! (.gitignore 처리됨)
// ============================================================

const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const INPUT  = path.join(__dirname, "students-raw.csv");
const OUTPUT = path.join(__dirname, "../data/students-hashed.json");

if (!fs.existsSync(INPUT)) {
  console.error("❌  scripts/students-raw.csv 파일이 없습니다.");
  process.exit(1);
}

const lines  = fs.readFileSync(INPUT, "utf-8").split("\n");
const hashes = [];

for (const raw of lines) {
  const line = raw.trim();
  if (!line) continue;
  const comma = line.indexOf(",");
  if (comma < 0) { console.warn("형식 오류 건너뜀:", line); continue; }
  const id   = line.slice(0, comma).trim();
  const name = line.slice(comma + 1).trim();
  if (!id || !name) continue;
  hashes.push(crypto.createHash("sha256").update(`${id}|${name}`).digest("hex"));
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(hashes, null, 2));
console.log(`✅  ${hashes.length}명 처리 완료 → data/students-hashed.json`);
console.log("⚠️   students-raw.csv 는 커밋하지 마세요!");
