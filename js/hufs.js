// ============================================================
//  js/hufs.js
//  HUFS 계정 로그인 공통 헬퍼
//
//  ⚠️ 이 파일은 브라우저로 그대로 내려가는 공개 코드입니다.
//     비밀값을 두지 마세요. 여기의 도메인 검사는 안내 문구를 위한 것이고,
//     실제 접근 차단은 firestore.rules 의 isHufs() 가 담당합니다.
// ============================================================

// 허용 도메인 목록.
// 대학원 등에서 하위 도메인 메일(예: gsis.hufs.ac.kr)을 쓴다면 여기에 추가하고,
// ⚠️ firestore.rules 의 isHufs() 정규식도 반드시 같이 고쳐야 합니다.
// 이 파일만 고치면 화면은 통과하지만 데이터 요청은 규칙에서 거부됩니다.
export const HUFS_DOMAINS = ["hufs.ac.kr"];

// Google 로그인 창에 표시할 기본 도메인 (hd 파라미터는 하나만 받는다)
export const HUFS_DOMAIN = HUFS_DOMAINS[0];

/** 허용 도메인의 메일인지 확인 (등록하지 않은 하위 도메인은 거부) */
export function isHufsEmail(email) {
  if (typeof email !== "string") return false;
  const lower = email.toLowerCase();
  return HUFS_DOMAINS.some((d) => lower.endsWith("@" + d));
}

/** 로그인 화면에 표시할 이름 */
export function displayNameOf(user) {
  if (!user) return "";
  return user.displayName || String(user.email || "").split("@")[0];
}

/**
 * Firebase Auth 오류 코드를 사람이 읽을 수 있는 안내로 바꾼다.
 * 초기 세팅 단계에서 자주 만나는 오류를 구체적으로 알려주는 데 목적이 있다.
 */
export function describeAuthError(err) {
  const code = err && err.code;
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null; // 사용자가 직접 닫은 경우 — 오류로 표시하지 않는다

    case "auth/unauthorized-domain":
      return "이 도메인에서는 로그인이 허용되지 않았습니다. " +
             "Firebase Console → Authentication → Settings → 승인된 도메인에 " +
             "현재 주소를 추가해야 합니다.";

    case "auth/operation-not-allowed":
      return "Google 로그인이 활성화되어 있지 않습니다. " +
             "Firebase Console → Authentication → Sign-in method 에서 Google 을 사용 설정하세요.";

    case "auth/popup-blocked":
      return "브라우저가 로그인 창을 차단했습니다. 팝업을 허용하고 다시 시도해주세요.";

    case "auth/network-request-failed":
      return "네트워크 연결을 확인해주세요.";

    case "auth/too-many-requests":
      return "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";

    default:
      return "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}
