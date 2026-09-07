#!/usr/bin/env node
// ============================================================
//  scripts/hash-students.js
//  학생 명단 → salt + PBKDF2-SHA256 해시 변환 (로컬 전용 스크립트)
//
//  사용법:
//    1. scripts/students-raw.csv 작성
//       형식(헤더 없음): 학번,이름
//       예) 20201234,홍길동
//    2. node scripts/hash-students.js
//    3. data/students-hashed.json 생성됨 → 커밋
//
//  ⚠️  students-raw.csv 는 절대 커밋하지 마세요! (.gitignore 처리됨)
//
//  왜 PBKDF2 인가:
//  data/students-hashed.json 은 정적 호스팅이라 누구나 내려받을 수 있습니다.
//  단순 SHA-256 이면 학번(연도+학과 접두사로 경우의 수가 작음) × 이름 조합을
//  전수 대입해 재학생 명단을 그대로 복원할 수 있습니다. salt 로 사전 계산을,
//  높은 반복 횟수로 대입 비용을 올려 이를 실질적으로 어렵게 만듭니다.
//  (근본 해결은 명단을 서버 측에 두고 검증하는 것입니다 — ADMIN_GUIDE 참고)
// ============================================================

// package.json 이 "type": "module" 이므로 ES 모듈로 작성한다.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT  = path.join(__dirname, "students-raw.csv");
const OUTPUT = path.join(__dirname, "../data/students-hashed.json");

const ITERATIONS = 600000; // js/auth.js 가 파일에 적힌 값을 그대로 사용한다
const KEYLEN     = 32;     // 256-bit
const DIGEST     = "sha256";

if (!fs.existsSync(INPUT)) {
  console.error("❌  scripts/students-raw.csv 파일이 없습니다.");
  process.exit(1);
}

const salt   = crypto.randomBytes(32).toString("hex");
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

  const hash = crypto
    .pbkdf2Sync(`${id}|${name}`, Buffer.from(salt, "hex"), ITERATIONS, KEYLEN, DIGEST)
    .toString("hex");
  hashes.push(hash);

  if (hashes.length % 25 === 0) {
    process.stdout.write(`  ...${hashes.length}명 처리\n`);
  }
}

// CSV 순서(대개 학번 오름차순)가 그대로 남지 않도록 정렬해 순서 정보를 없앤다.
hashes.sort();

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(
  OUTPUT,
  JSON.stringify({ version: 2, salt, iterations: ITERATIONS, hashes }, null, 2)
);

console.log(`✅  ${hashes.length}명 처리 완료 → data/students-hashed.json`);
console.log("⚠️   students-raw.csv 는 커밋하지 마세요!");
