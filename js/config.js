// ============================================================
//  js/config.js
//  실제 키는 js/firebase-config.generated.js 에만 두고 (git 제외)
//  로컬/배포 전:  npm run build:config  (.env 는 .env.example 참고)
// ============================================================

const generatedHref = new URL(
  "./firebase-config.generated.js",
  import.meta.url
).href;

let FIREBASE_CONFIG;
try {
  const mod = await import(generatedHref);
  const c = mod.FIREBASE_CONFIG;
  if (!c || !c.apiKey) {
    throw new Error("empty FIREBASE_CONFIG");
  }
  FIREBASE_CONFIG = c;
} catch (err) {
  const hint =
    "Firebase 설정이 없습니다. 루트에 .env 를 만든 뒤 `npm run build:config` 를 실행하세요. (.env.example 참고)";
  console.error(hint, err);
  throw new Error(hint);
}

export { FIREBASE_CONFIG };
