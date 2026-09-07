// ============================================================
//  js/auth.js
//  재학생 명단 대조 (학번 + 이름)
//
//  ⚠️ 이 파일은 브라우저로 그대로 내려가는 공개 코드입니다.
//     관리자 비밀번호·계정 등 어떤 비밀값도 여기에 두지 마세요.
//     관리자 인증은 Firebase Auth(이메일/비밀번호) + Firestore 보안 규칙이
//     담당하며, admin.html 에서만 처리합니다.
// ============================================================

const HASH_URL = "data/students-hashed.json";

let rosterPromise = null;

function loadRoster() {
  if (!rosterPromise) {
    rosterPromise = fetch(HASH_URL, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("명단 파일 로드 실패");
      return res.json();
    });
  }
  return rosterPromise;
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

// v1(구버전) — salt 없는 단일 SHA-256. 명단을 v2 로 재생성하기 전까지만 사용.
async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  return toHex(await crypto.subtle.digest("SHA-256", buf));
}

// v2 — salt + PBKDF2-SHA256. 명단 파일이 유출돼도 학번·이름 역산 비용이 크게 올라간다.
async function pbkdf2Hex(str, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(str),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

/**
 * 재학생 명단에 있는 학번·이름인지 확인한다.
 * 관리자 판별은 하지 않는다 — 관리자 여부는 서버(보안 규칙)만 결정한다.
 * @returns {Promise<{valid: boolean}>}
 */
export async function verifyStudent(id, name) {
  const payload = `${String(id).trim()}|${String(name).trim()}`;

  let roster;
  try {
    roster = await loadRoster();
  } catch (e) {
    rosterPromise = null; // 다음 시도에서 다시 받도록
    console.error(e);
    throw e;
  }

  // v2: { version: 2, salt, iterations, hashes: [...] }
  if (roster && !Array.isArray(roster) && roster.version === 2) {
    const hash = await pbkdf2Hex(payload, roster.salt, roster.iterations);
    return { valid: roster.hashes.includes(hash) };
  }

  // v1(레거시): 해시 문자열 배열
  if (Array.isArray(roster)) {
    const hash = await sha256Hex(payload);
    return { valid: roster.includes(hash) };
  }

  throw new Error("명단 파일 형식을 인식할 수 없습니다.");
}
