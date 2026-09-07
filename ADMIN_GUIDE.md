# 관리자 운영 가이드

> 이 문서는 시스템 운영자(교수·조교)를 위한 내부 문서입니다.

---

## 목차

1. [시스템 구조](#1-시스템-구조)
2. [관리자 등록](#2-관리자-등록)
3. [채팅 삭제](#3-채팅-삭제)
4. [Firebase 규칙 배포](#4-firebase-규칙-배포)
5. [GitHub 배포 방법](#5-github-배포-방법)
6. [초기 세팅 방법 (최초 1회)](#6-초기-세팅-방법-최초-1회)
7. [파일 구조](#7-파일-구조)
8. [자주 묻는 문제](#8-자주-묻는-문제)
9. [보안 설계와 남은 한계](#9-보안-설계와-남은-한계)

---

## 1. 시스템 구조

| 구성 요소 | 역할 |
|-----------|------|
| **GitHub Pages** | 정적 프론트엔드 호스팅 (index, chat, admin 페이지) |
| **Firebase Auth** | HUFS Google 계정(@hufs.ac.kr) 로그인 — 학생·관리자 공통 |
| **Firestore 보안 규칙** | **모든 권한 판정** — 누가 무엇을 읽고 쓸 수 있는지 결정 |
| **Firestore** | 실시간 채팅 메시지 저장 |

이용 대상은 **HUFS 구성원 전체**입니다. 학과 제한은 두지 않으므로 이중전공·부전공
학생도 그대로 질문할 수 있고, 별도의 재학생 명단을 관리할 필요가 없습니다.

> 🔑 **가장 중요한 원칙**
> 브라우저에서 오는 값(화면 상태, JS 변수, sessionStorage)은 **아무것도 권한 근거가 되지 않습니다.**
> 신원은 Google 이 서명한 ID 토큰에서만 나오고, 그 토큰을 `firestore.rules` 가 매 요청마다 검증합니다.
> 관리자 화면을 강제로 열더라도 데이터 요청은 전부 거부됩니다.
> 새 기능을 추가할 때도 이 원칙을 깨지 마세요.

### 로그인 흐름

```
학생·관리자
   └─ index.html / admin.html 에서 "HUFS 계정으로 로그인"
        └─ Google 이 본인 확인 → @hufs.ac.kr ID 토큰 발급
             └─ Firestore 요청마다 규칙이 토큰을 검증
                  ├─ 학생  : chat_threads/{본인 uid} 만 접근
                  └─ 관리자: admins/{uid} 문서가 있으면 전체 접근
```

학번·이름을 입력받아 명단과 대조하던 방식은 없어졌습니다.
Google 이 본인 확인을 대신하므로 도용이 불가능하고, 계정 기준이라
기기나 브라우저가 바뀌어도 같은 상담이 이어집니다.

---

## 2. 관리자 등록

관리자도 학생과 똑같이 HUFS 계정으로 로그인합니다.
차이는 Firestore `admins` 컬렉션에 UID 가 등록되어 있는지 하나뿐입니다.

### 2-1. UID 확인

1. 관리자로 쓸 HUFS 계정으로 사이트(`https://aidata-qna.hufs.ac.kr/`)에 한 번 로그인합니다.
2. Firebase Console → **Authentication → Users** 에서 해당 계정의 **사용자 UID** 를 복사합니다.

### 2-2. 관리자 명부(`admins`)에 등록

**Firestore Database → 컬렉션 시작** → 컬렉션 ID `admins`

- **문서 ID**: 위에서 복사한 **UID** (문서 ID 가 반드시 UID 여야 합니다)
- 필드: `email` (문자열) — 누구 계정인지 알아보기 위한 참고용입니다.
  권한 판정은 **문서의 존재 여부**만 봅니다.

`admins` 컬렉션은 보안 규칙에서 클라이언트 쓰기가 완전히 차단되어 있습니다(`write: false`).
따라서 관리자 등록·해지는 **오직 Firebase Console 에서만** 가능합니다.

### 2-3. 로그인

`https://aidata-qna.hufs.ac.kr/admin.html` 에서 HUFS 계정으로 로그인합니다.
(학생 로그인 화면 하단의 "관리자" 링크로도 갈 수 있습니다.)

### 2-4. 관리자 교체·해지

| 상황 | 조치 |
|------|------|
| 조교 교체 | 새 계정을 2-1~2-2 로 등록하고, 이전 UID 의 `admins` 문서를 **삭제** |
| 권한만 회수 | Firestore `admins/{UID}` 문서 삭제 → 즉시 데이터 접근 차단 |
| 졸업·퇴직 | 학교에서 HUFS 계정이 정지되면 로그인 자체가 막힙니다. `admins` 문서도 함께 정리하세요 |

관리자 비밀번호를 따로 관리하지 않으므로, 계정 회수는 학교 계정 정책을 그대로 따릅니다.

---

## 3. 채팅 삭제

자동 초기화 기능은 사용하지 않습니다(Cloud Functions 미사용).
삭제는 관리자 페이지에서 **수동으로만** 이루어집니다.

- **메시지 1건 삭제**: 각 말풍선 아래 `삭제` 버튼
- **전체 삭제**: 사이드바 하단 **"⚠️ 전체 채팅 삭제"** 버튼
  - 확인 팝업이 2회 뜹니다.
  - 삭제 후 `settings/chatReset` 의 `lastResetAt` 이 현재 시각으로 갱신되고,
    사이드바 **"마지막 삭제"** 에 표시됩니다.

> 상담 내역에는 이제 실명과 학교 이메일이 함께 남습니다.
> 오래 보관하지 않는 것이 개인정보 측면에서 안전합니다.
> 학기 중 주기적인(예: 매주) 전체 삭제를 권장합니다.

---

## 4. Firebase 규칙 배포

Firestore 보안 규칙(`firestore.rules`)은 **이 시스템의 실제 접근통제**입니다.
파일을 수정했다면 반드시 배포해야 적용됩니다.

```powershell
firebase deploy --only firestore:rules
```

> Spark(무료) 플랜에서도 가능합니다.
> ⚠️ 코드를 GitHub 에 push 해도 규칙은 배포되지 않습니다. 위 명령을 따로 실행해야 합니다.

### 현재 규칙 요약

| 경로 | HUFS 학생 | 관리자 | 그 외(비HUFS·미로그인) |
|------|-----------|--------|------------------------|
| `admins/{uid}` | 본인 문서 읽기만 | 본인 문서 읽기만 | ❌ |
| `chat_threads/{uid}` | 문서 ID = 본인 uid 인 스레드만 읽기·생성·수정 | 전체 읽기·수정·삭제 | ❌ |
| `chat_threads/*/messages` | 본인 스레드에 `role:"student"` 만 작성 (수정 불가) | 전체 읽기, `role:"admin"` 작성, 삭제 | ❌ |
| `settings/*` | ❌ | 읽기·쓰기 | ❌ |
| 그 외 모든 경로 | ❌ | ❌ | ❌ |

핵심 포인트

- **HUFS 판정** = Google 로그인(`google.com`) + `email_verified` + `@hufs.ac.kr` 도메인.
  이 세 가지를 모두 토큰에서 확인하므로 클라이언트가 위조할 수 없습니다.
- **관리자 판정** = 위 조건 **그리고** `admins/{uid}` 문서 존재.
- **학생 격리** = 스레드 문서 ID 가 곧 본인 uid 입니다.
  다른 사람의 스레드는 경로 자체가 달라 규칙 단계에서 막힙니다.
- **이름표 위조 방지** = 스레드의 `email` 은 토큰의 email 과 같아야 생성됩니다.
- **관리자 사칭 방지** = `role: "admin"` 메시지는 관리자만 작성할 수 있습니다.

### 허용 도메인을 늘리려면

대학원 등에서 하위 도메인 메일(예: `gsis.hufs.ac.kr`)을 쓴다면 **두 곳을 함께** 고쳐야 합니다.

1. `firestore.rules` 의 `isHufs()` 정규식 → `'.*@(hufs[.]ac[.]kr|gsis[.]hufs[.]ac[.]kr)'`
2. `js/hufs.js` 의 `HUFS_DOMAINS` 배열에 도메인 추가

규칙만 고치면 화면 안내가 어긋나고, `hufs.js` 만 고치면 로그인은 되는데 데이터 요청이 거부됩니다.
고친 뒤에는 규칙 배포(`firebase deploy --only firestore:rules`)를 잊지 마세요.

---

## 5. GitHub 배포 방법

```powershell
git add .
git commit -m "변경 내용 설명"
git push
```

push 후 GitHub Pages가 자동으로 빌드되며, 1~2분 후 사이트에 반영됩니다.

| 상황 | 명령어 |
|------|--------|
| 전체 파일 반영 | `git add .` |
| 커밋 | `git commit -m "메시지"` |
| 푸시 | `git push` |
| **보안 규칙 변경** | `firebase deploy --only firestore:rules` (git push 와 **별도**) |

> ⚠️ `&&` 연산자는 PowerShell에서 동작하지 않습니다. 명령어를 한 줄씩 실행하세요.

---

## 6. 초기 세팅 방법 (최초 1회)

### 6-1. Firebase Authentication 설정

Firebase Console → **Authentication → Sign-in method**

1. **Google** 사용 설정 (프로젝트 지원 이메일 지정)
2. **익명** 로그인은 **사용 중지** — 더 이상 쓰지 않습니다

Firebase Console → **Authentication → Settings → 승인된 도메인**

3. `aidata-qna.hufs.ac.kr` 추가 ← **이게 빠지면 로그인이 안 됩니다**
4. GitHub Pages 기본 주소도 쓴다면 `wonje-tech.github.io` 도 추가

> 로그인 시 "이 도메인에서는 로그인이 허용되지 않았습니다" 안내가 뜨면 3번이 누락된 것입니다.

### 6-2. HUFS Workspace 쪽 확인

HUFS 는 Google Workspace 를 쓰므로 Google 로그인이 그대로 동작합니다.
다만 Workspace 관리자가 **서드파티 앱 접근을 차단**해 두었다면 로그인이 막힙니다.

- 확인 방법: HUFS 계정으로 아무 외부 서비스나 "Google로 로그인" 해 봅니다. 되면 통과입니다.
- 막혀 있다면 정보처에 Firebase 프로젝트의 OAuth 클라이언트 ID 허용을 요청해야 합니다.
  (Google Cloud Console → API 및 서비스 → 사용자 인증 정보 에서 확인 가능)

### 6-3. Firestore

Firebase Console → **Firestore Database** → 데이터베이스 만들기 → **프로덕션 모드**

### 6-4. Firebase 설정값 입력

Firebase Console → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱(`</>`) → SDK 구성 값을 `.env` 로 옮깁니다.

1. `.env.example` 을 복사해 `.env` 로 저장합니다.
2. `FIREBASE_API_KEY` 등 6개 항목을 채웁니다. (`.env` 는 git 에 올리지 않습니다.)
3. `npm run build:config` 를 실행하면 `js/firebase-config.generated.js` 가 생성됩니다.
4. `firebase deploy` 는 `firebase.json` 의 `predeploy` 로 이를 자동 실행합니다.

> 참고: 웹 SDK 의 `apiKey` 는 비밀값이 아니라 프로젝트 식별자입니다.
> 노출되어도 그 자체로는 문제가 없으며, 실제 보호는 **보안 규칙**이 담당합니다.

### 6-5. Firebase CLI 설치 (규칙 배포용)

```powershell
npm install -g firebase-tools
firebase login
```

### 6-6. 배포 순서

관리자 UID 는 한 번 로그인해 봐야 나오므로, 아래 순서를 지켜야 관리자가 잠기지 않습니다.

1. 6-1 (Google 활성화 + 승인된 도메인 추가)
2. 사이트 배포 — `git push` → GitHub Pages 반영 대기 (1~2분)
3. 관리자로 쓸 HUFS 계정으로 사이트에 **한 번 로그인**
4. Authentication → Users 에서 UID 복사 → Firestore `admins/{UID}` 문서 생성 ([2장](#2-관리자-등록))
5. `firebase deploy --only firestore:rules`
6. Authentication → Sign-in method → **익명 로그인 사용 중지**
7. `admin.html` 로그인 → **"전체 채팅 삭제"** 로 이전 구조의 옛 스레드 정리

> 순서를 뒤집어 규칙(5번)을 먼저 배포하면, `admins` 문서가 없어 관리자가 들어갈 수 없습니다.
> 학생 쪽은 2번만 끝나면 바로 쓸 수 있습니다.

### 6-7. .firebaserc 설정

```json
{
  "projects": {
    "default": "dept-consulting"
  }
}
```

---

## 7. 파일 구조

```
├── index.html                  # HUFS 계정 로그인 페이지
├── chat.html                   # 학생 채팅 페이지
├── admin.html                  # 관리자 로그인 + 대시보드
├── css/
│   └── style.css               # 전체 스타일
├── js/
│   ├── config.js               # Firebase — 생성된 값 로드
│   ├── firebase-config.generated.js  # `npm run build:config`로 생성, git 제외
│   └── hufs.js                 # 허용 도메인 목록, 로그인 오류 안내 (비밀값 없음)
├── .env.example                # .env 복사용 템플릿(키 없음; 실제 .env 는 git 제외)
├── scripts/
│   └── build-firebase-config.mjs
├── functions/
│   ├── index.js                # Cloud Function (현재 미사용)
│   └── package.json
├── firestore.rules             # ★ 실제 접근통제 — 수정 시 반드시 배포
├── firestore.indexes.json      # Firestore 인덱스
├── firebase.json               # Firebase 호스팅·규칙 설정
├── .firebaserc                 # Firebase 프로젝트 연결
├── CNAME                       # aidata-qna.hufs.ac.kr
├── README.md                   # 학생용 공개 안내
└── ADMIN_GUIDE.md              # 관리자용 운영 가이드 (이 파일)
```

학생 명단 파일(`data/students-hashed.json`)과 해시 생성 스크립트는
HUFS 계정 로그인으로 전환하면서 **삭제**했습니다. 더 이상 명단을 관리하지 않습니다.

---

## 8. 자주 묻는 문제

### Q. 학생이 로그인이 안 된다고 합니다.

| 증상 | 원인 / 조치 |
|------|-------------|
| "HUFS 계정(@hufs.ac.kr)으로 로그인해주세요" | 개인 Gmail 로 로그인했습니다. "다른 계정으로 로그인" 후 학교 계정 선택 |
| Google 계정 목록에 학교 계정이 없음 | HUFS 메일 계정을 아직 만들지 않았습니다. `https://mail.hufs.ac.kr` 에서 최초 1회 가입 필요 |
| "이 도메인에서는 로그인이 허용되지 않았습니다" | Firebase 승인된 도메인 누락 → [6-1](#6-1-firebase-authentication-설정) |
| "Google 로그인이 활성화되어 있지 않습니다" | Firebase Authentication 에서 Google 사용 설정 필요 |
| 로그인 창이 안 뜸 | 브라우저 팝업 차단. 허용 후 재시도 (차단 시 자동으로 리디렉션 방식으로 넘어갑니다) |
| Google 이 "관리자가 차단했습니다" 라고 함 | HUFS Workspace 의 서드파티 앱 차단 → [6-2](#6-2-hufs-workspace-쪽-확인) |

> HUFS 메일은 학생이 **직접 가입**하는 구조라, 아직 계정이 없는 학생이 있습니다.
> 공지에 `mail.hufs.ac.kr` 가입 안내를 함께 넣어두면 문의가 줄어듭니다.

### Q. 관리자 로그인이 안 됩니다.

| 증상 | 원인 / 조치 |
|------|-------------|
| "이 계정에는 관리자 권한이 없습니다" | Firestore `admins/{UID}` 문서가 없습니다. 문서 ID 가 UID 와 정확히 같은지 확인 |
| "관리자 권한을 확인하지 못했습니다" | 보안 규칙이 배포되지 않았습니다 → `firebase deploy --only firestore:rules` |
| 로그인 화면만 계속 뜸 | 학교 계정이 아닌 계정으로 로그인했을 수 있습니다 |

### Q. 학생 목록에 이름 없이 "(이름 없음)" 으로 뜨는 항목이 있습니다.

HUFS 계정 전환 **이전**에 만들어진 옛 스레드입니다.
관리자 화면에서 **"전체 채팅 삭제"** 를 한 번 실행하면 정리됩니다.

### Q. 이름이 학교 계정의 표시 이름으로 나옵니다.

Google 계정의 표시 이름을 그대로 씁니다. 학생이 Google 프로필 이름을 바꾸면
다음 접속 때 자동으로 반영됩니다. 이메일(학교 계정)은 변경할 수 없습니다.

### Q. git push 시 `git` 명령어를 인식하지 못합니다.

PowerShell 에 git 경로가 등록되지 않은 것입니다. 터미널을 닫고 새로 열면 해결됩니다.

### Q. `&&` 연산자가 동작하지 않습니다.

PowerShell 에서는 `&&` 를 지원하지 않습니다. 명령어를 한 줄씩 실행하세요.

---

## 9. 보안 설계와 남은 한계

### 보안 점검 지적사항과 조치

| 지적 | 이전 | 지금 |
|------|------|------|
| 공개 코드에 관리자 인증정보 (CWE-798) | 공개 JS 에 `aidata2025 / 관리자` 하드코딩 | 코드에 비밀값 없음. HUFS Google 계정 |
| sessionStorage 권한 상승 (CWE-602) | `sessionStorage.isAdmin` 으로 관리자 페이지 접근 | 보안 규칙이 `admins/{uid}` 확인. 클라이언트 값은 권한에 무관 |
| (점검 중 추가 확인) 데이터 전면 개방 | 익명 로그인만 하면 **전 학생 상담 내역 열람·수정·삭제 가능** | 본인 스레드만. 전체 접근은 관리자만 |
| (점검 중 추가 확인) 관리자 사칭 | 누구나 `role:"admin"` 메시지 작성 가능 | 관리자만 작성 가능 |
| (점검 중 추가 확인) 명단 해시 공개 | salt 없는 SHA-256 → 전수 대입으로 재학생 명단 복원 가능 | **파일 자체를 삭제**. 명단을 쓰지 않음 |
| 학번·이름 도용 | 학번과 이름만 알면 타인 사칭 가능 | Google 이 본인 확인. 도용 불가 |

### 새 기능을 추가할 때 지킬 것

1. 권한이 걸린 동작을 추가하면 **`firestore.rules` 를 먼저 고치고 배포**합니다.
   화면에서 버튼을 숨기는 것은 접근통제가 아닙니다.
2. `sessionStorage` / `localStorage` / JS 변수는 **화면 표시 용도로만** 씁니다.
   신원은 항상 `onAuthStateChanged` 가 준 Firebase 사용자에서 가져옵니다.
3. 비밀값(비밀번호, 서비스 계정 키, 토큰)은 `js/` 아래 어디에도 두지 않습니다.
   이 폴더는 전부 브라우저로 내려갑니다.
4. 규칙을 바꿨다면 **학생 계정과 관리자 계정 양쪽에서** 실제로 눌러 확인합니다.

### 남은 한계

**1) git 히스토리에 옛 자료가 남아 있습니다**

- 이전 관리자 자격증명 `aidata2025 / 관리자`
- 삭제한 `data/students-hashed.json` (salt 없는 SHA-256 형식)

현재 코드에서는 제거했지만 커밋 히스토리에는 남습니다.
해당 관리자 값은 **어떤 서비스에서도 재사용하지 마세요.**
명단 해시는 이미 공개되어 있던 파일이므로, 필요하다면 히스토리 재작성(`git filter-repo`)을
검토할 수 있습니다. 다만 재작성은 협업자 저장소를 깨뜨리므로 신중히 판단하세요.

**2) 상담 내용에 실명·학교 이메일이 남습니다**

익명 상담이 아닙니다. 예전에도 학번·이름을 저장했으므로 성격이 크게 달라지지는
않지만, 신원이 확실해진 만큼 민감한 상담은 학생이 꺼릴 수 있습니다.
정기적인 삭제([3장](#3-채팅-삭제))로 보관 기간을 짧게 유지하세요.

**3) HUFS 계정이 없는 학생은 이용할 수 없습니다**

HUFS 메일은 자동 발급이 아니라 학생이 직접 가입해야 합니다.
안내 공지에 가입 링크를 함께 제공하세요.

**4) 학과 구분이 없습니다**

HUFS 구성원이면 누구나 질문할 수 있습니다(이중전공·부전공 학생 이용을 위한 의도된 선택).
학과별로 나눠야 할 필요가 생기면, 스레드에 학과 필드를 두고 관리자 화면에서
필터링하는 방식이 가장 간단합니다.

### 보안 문의를 받았을 때

취약점 제보를 받으면 **먼저 `firestore.rules` 를 확인**하세요.
이 시스템에서 데이터가 실제로 새는지 여부는 거의 항상 이 파일이 결정합니다.
화면이 열리는 것과 데이터가 나가는 것은 다른 문제입니다.
