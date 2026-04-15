// ============================================================
//  js/auth.js
//  로그인 인증 — SHA-256 해시 비교
// ============================================================

// ⚠️ 관리자 계정: 원하는 값으로 바꾸세요
const ADMIN_ID   = "aidata2025";
const ADMIN_NAME = "관리자";

async function sha256(str) {
  const buf    = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export async function verifyStudent(id, name) {
  // 관리자 확인
  if (id === ADMIN_ID && name === ADMIN_NAME) {
    return { valid: true, isAdmin: true };
  }

  // 학생 해시 목록 로드
  let hashes;
  try {
    const res = await fetch("data/students-hashed.json");
    if (!res.ok) throw new Error("명단 파일 로드 실패");
    hashes = await res.json();
  } catch (e) {
    console.error(e);
    throw e;
  }

  const hash  = await sha256(`${id}|${name}`);
  return { valid: hashes.includes(hash), isAdmin: false };
}
