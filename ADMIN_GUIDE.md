# 관리자 운영 가이드

> 이 문서는 시스템 운영자(교수·조교)를 위한 내부 문서입니다.
> 학생에게 공개하지 마세요.

---

## 목차

1. [시스템 구조](#1-시스템-구조)
2. [관리자 로그인](#2-관리자-로그인)
3. [학생 명단 업데이트](#3-학생-명단-업데이트)
4. [채팅 삭제](#4-채팅-삭제)
5. [Firebase 규칙 배포](#5-firebase-규칙-배포)
6. [GitHub 배포 방법](#6-github-배포-방법)
7. [초기 세팅 방법 (최초 1회)](#7-초기-세팅-방법-최초-1회)
8. [파일 구조](#8-파일-구조)
9. [자주 묻는 문제](#9-자주-묻는-문제)
10. [보안 설계와 남은 한계](#10-보안-설계와-남은-한계)

---

## 1. 시스템 구조

| 구성 요소 | 역할 |
|-----------|------|
| **GitHub Pages** | 정적 프론트엔드 호스팅 (index, chat, admin 페이지) |
| **Firebase Auth** | 학생 = 익명 로그인 / 관리자 = 이메일·비밀번호 로그인 |
| **Firestore 보안 규칙** | **모든 권한 판정** — 누가 무엇을 읽고 쓸 수 있는지 결정 |
| **Firestore** | 실시간 채팅 메시지 저장 |
| **students-hashed.json** | 학번+이름의 PBKDF2 해시 목록 (재학생 명단 대조용) |

학생 원본 명단(`students-raw.csv`)은 로컬에만 존재하며, GitHub에는 해시값만 올라갑니다.

> 🔑 **가장 중요한 원칙**
> 브라우저에서 오는 값(`sessionStorage`, 화면 상태, JS 변수)은 **아무것도 권한 근거가 되지 않습니다.**
> 관리자 화면을 강제로 열더라도, 데이터 요청은 전부 `firestore.rules` 에서 다시 검증되어 거부됩니다.
> 새 기능을 추가할 때도 이 원칙을 깨지 마세요.

---

## 2. 관리자 로그인

> ⚠️ **관리자 계정 정보는 코드에 절대 넣지 않습니다.**
> 예전 방식(`js/auth.js` 의 `ADMIN_ID` / `ADMIN_NAME`)은 공개 저장소와 브라우저에
> 그대로 노출되어, 그 값을 읽은 누구나 관리자로 로그인할 수 있었습니다.
> 지금은 Firebase Auth 계정으로 로그인하고, 관리자 여부는 서버(보안 규칙)가 판정합니다.

### 2-1. 관리자 계정 만들기

1. [Firebase Console](https://console.firebase.google.com/) → **Authentication** → Sign-in method
   → **이메일/비밀번호** 사용 설정
2. **Authentication → Users → 사용자 추가**
   - 이메일: 운영자 이메일
   - 비밀번호: **12자 이상**, 다른 서비스와 겹치지 않는 값
3. 생성된 사용자의 **사용자 UID** 를 복사합니다.

### 2-2. 관리자 명부(`admins`)에 등록

**Firestore Database → 컬렉션 시작** → 컬렉션 ID `admins`

- **문서 ID**: 2-1에서 복사한 **UID** (문서 ID 가 반드시 UID 여야 합니다)
- 필드: `email` (문자열) — 누구 계정인지 알아보기 위한 참고용입니다.
  권한 판정은 **문서의 존재 여부**만 봅니다.

`admins` 컬렉션은 보안 규칙에서 클라이언트 쓰기가 완전히 차단되어 있습니다(`write: false`).
따라서 관리자 등록·해지는 **오직 Firebase Console 에서만** 가능합니다.

### 2-3. 로그인

`https://aidata-qna.hufs.ac.kr/admin.html` 에 접속해 이메일·비밀번호를 입력합니다.

- 이메일/비밀번호 계정이 아니면(예: 학생의 익명 세션) 관리자 화면이 열리지 않습니다.
- 로그인에 성공해도 `admins/{UID}` 문서가 없으면 접근이 거부됩니다.

### 2-4. 관리자 교체·해지

| 상황 | 조치 |
|------|------|
| 조교 교체 | 새 계정을 2-1~2-2 로 등록하고, 이전 UID 의 `admins` 문서를 **삭제** |
| 권한만 회수 | Firestore `admins/{UID}` 문서 삭제 → 즉시 데이터 접근 차단 |
| 계정까지 폐기 | 위에 더해 Authentication → Users 에서 사용자 삭제 |
| 비밀번호 변경 | Authentication → Users → ⋮ → 비밀번호 재설정 |

### 2-5. 과거 노출된 자격증명 처리 (1회성 점검)

이전 버전의 `aidata2025 / 관리자` 값은 공개 저장소와 배포된 JS에 노출되었습니다.
코드에서는 제거되었지만, **git 히스토리에는 그대로 남아 있습니다.**

- [x] 코드에서 제거 (이번 변경)
- [ ] 해당 값을 **다른 어떤 서비스에서도 재사용하지 않기**
- [ ] Firebase Console → Firestore → 사용량, Authentication → Users 에서
      점검 기간 외의 비정상적인 접근·삭제 흔적 확인
- [ ] 노출 기간 중 상담 내역이 열람되었을 가능성을 학과 차원에서 판단
      (익명 로그인만으로도 전체 조회가 가능했던 상태였습니다 — 10장 참고)

---

## 3. 학생 명단 업데이트

### 3-1. CSV 파일 형식

`scripts/students-raw.csv` 파일을 아래 형식으로 작성합니다.
헤더(첫 줄 제목) 없이, 한 줄에 `학번,이름` 형식으로 작성합니다.

```
20201234,홍길동
20211234,김철수
20220001,이영희
```

> ⚠️ 엑셀에서 저장 시 **UTF-8 (BOM 포함)** 또는 **UTF-8** 모두 가능합니다.
> ⚠️ `students-raw.csv` 는 `.gitignore` 에 등록되어 있어 GitHub에 올라가지 않습니다. 절대 `git add` 하지 마세요.

### 3-2. 해시 재생성

```powershell
python scripts/run_hash.py
```

Node 로 실행해도 결과는 같습니다: `node scripts/hash-students.js`

149명 기준 20~30초 정도 걸립니다(반복 해시 계산 때문이며 정상입니다).
완료되면 `data/students-hashed.json` 이 아래 형식으로 갱신됩니다.

```json
{ "version": 2, "salt": "…", "iterations": 600000, "hashes": [ "…" ] }
```

> 실행할 때마다 salt 가 새로 만들어지므로 해시값이 전부 바뀝니다. 정상입니다.
> 예전 형식(해시 문자열 배열)도 로그인은 계속 동작하지만, 되도록 빨리 재생성하세요.
> 이유는 10장을 참고하세요.

### 3-3. GitHub에 반영

```powershell
git add data/students-hashed.json
git commit -m "학생 명단 업데이트"
git push
```

push 후 1~2분 내에 GitHub Pages에 자동 반영됩니다.

---

## 4. 채팅 삭제

자동 초기화 기능은 사용하지 않습니다(Cloud Functions 미사용).
삭제는 관리자 페이지에서 **수동으로만** 이루어집니다.

- **메시지 1건 삭제**: 각 말풍선 아래 `삭제` 버튼
- **전체 삭제**: 사이드바 하단 **"⚠️ 전체 채팅 삭제"** 버튼
  - 확인 팝업이 2회 뜹니다.
  - 삭제 후 `settings/chatReset` 의 `lastResetAt` 이 현재 시각으로 갱신되고,
    사이드바 **"마지막 삭제"** 에 표시됩니다.

> 상담 내역을 오래 보관하지 않는 것이 개인정보 측면에서 안전합니다.
> 학기 중에는 주기적으로(예: 매주) 전체 삭제하는 운영을 권장합니다.

---

## 5. Firebase 규칙 배포

Firestore 보안 규칙(`firestore.rules`)은 **이 시스템의 실제 접근통제**입니다.
파일을 수정했다면 반드시 배포해야 적용됩니다.

```powershell
firebase deploy --only firestore:rules
```

> Spark(무료) 플랜에서도 가능합니다.
> ⚠️ 코드를 GitHub 에 push 해도 규칙은 배포되지 않습니다. 위 명령을 따로 실행해야 합니다.

### 현재 규칙 요약

| 경로 | 학생 (익명 로그인) | 관리자 | 그 외 |
|------|-------------------|--------|-------|
| `admins/{uid}` | 본인 문서 읽기만 | 본인 문서 읽기만 | ❌ |
| `chat_threads/{uid}` | 문서 ID = 본인 uid 인 스레드만 읽기·생성·수정 | 전체 읽기·수정·삭제 | ❌ |
| `chat_threads/*/messages` | 본인 스레드에 `role:"student"` 만 작성 (수정 불가) | 전체 읽기, `role:"admin"` 작성, 삭제 | ❌ |
| `settings/*` | ❌ | 읽기·쓰기 | ❌ |
| 그 외 모든 경로 | ❌ | ❌ | ❌ |

핵심 포인트

- **관리자 판정** = 이메일/비밀번호 로그인 **그리고** `admins/{uid}` 문서 존재.
  익명 사용자는 어떤 경우에도 관리자가 될 수 없습니다.
- **학생 격리** = 스레드 문서 ID 가 곧 본인 uid 입니다.
  다른 학생의 스레드는 경로 자체가 달라 규칙 단계에서 막힙니다.
- **관리자 사칭 방지** = `role: "admin"` 메시지는 관리자만 작성할 수 있습니다.
- **쓰기 금지 컬렉션** = `admins` 는 클라이언트에서 만들 수도, 지울 수도 없습니다.

---

## 6. GitHub 배포 방법

파일을 수정한 후 아래 명령어로 GitHub에 반영합니다.

```powershell
git add .
git commit -m "변경 내용 설명"
git push
```

push 후 GitHub Pages가 자동으로 빌드되며, 1~2분 후 사이트에 반영됩니다.

| 상황 | 명령어 |
|------|--------|
| 학생 명단 업데이트 | `git add data/students-hashed.json` |
| 전체 파일 반영 | `git add .` |
| 커밋 | `git commit -m "메시지"` |
| 푸시 | `git push` |
| **보안 규칙 변경** | `firebase deploy --only firestore:rules` (git push 와 **별도**) |

> ⚠️ `&&` 연산자는 PowerShell에서 동작하지 않습니다. 명령어를 한 줄씩 실행하세요.

---

## 7. 초기 세팅 방법 (최초 1회)

### 7-1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) → 새 프로젝트 생성
2. **Authentication → Sign-in method**
   - **익명** 활성화 (학생용)
   - **이메일/비밀번호** 활성화 (관리자용)
3. **Firestore Database** → 데이터베이스 만들기 → **프로덕션 모드**

### 7-2. 관리자 계정 등록

[2장](#2-관리자-로그인)을 따라 관리자 계정을 만들고 `admins` 컬렉션에 등록합니다.

### 7-3. Firebase 설정값 입력

Firebase Console → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱(`</>`) → SDK 구성 값을 `.env` 로 옮깁니다.

1. `.env.example` 을 복사해 `.env` 로 저장합니다.
2. `FIREBASE_API_KEY` 등 6개 항목을 채웁니다. (`.env` 는 git 에 올리지 않습니다.)
3. `npm run build:config` 를 실행하면 `js/firebase-config.generated.js` 가 생성됩니다.
4. `firebase deploy` 는 `firebase.json` 의 `predeploy` 로 이를 자동 실행합니다.

> 참고: 웹 SDK 의 `apiKey` 는 비밀값이 아니라 프로젝트 식별자입니다.
> 노출되어도 그 자체로는 문제가 없으며, 실제 보호는 **보안 규칙**이 담당합니다.

### 7-4. Firebase CLI 설치 (규칙 배포용)

```powershell
npm install -g firebase-tools
firebase login
```

### 7-5. 보안 규칙 배포

```powershell
firebase deploy --only firestore:rules
```

### 7-6. GitHub Pages 활성화

GitHub 저장소 → Settings → Pages → Source: `main` 브랜치 `/` (root)

### 7-7. .firebaserc 설정

```json
{
  "projects": {
    "default": "dept-consulting"
  }
}
```

---

## 8. 파일 구조

```
├── index.html                  # 학생 로그인 페이지
├── chat.html                   # 학생 채팅 페이지
├── admin.html                  # 관리자 로그인 + 대시보드
├── css/
│   └── style.css               # 전체 스타일
├── js/
│   ├── config.js               # Firebase — 생성된 값 로드
│   ├── firebase-config.generated.js  # `npm run build:config`로 생성, git 제외
│   └── auth.js                 # 재학생 명단 대조 (비밀값 없음)
├── .env.example                # .env 복사용 템플릿(키 없음; 실제 .env 는 git 제외)
├── data/
│   └── students-hashed.json    # 학번+이름 PBKDF2 해시 목록 (공개 파일)
├── scripts/
│   ├── students-raw.csv        # 원본 학생 명단 (로컬 전용, git 제외)
│   ├── run_hash.py             # 해시 생성 스크립트 (Python, 권장)
│   └── hash-students.js        # 해시 생성 스크립트 (Node.js, 결과 동일)
├── functions/
│   ├── index.js                # Cloud Function (현재 미사용)
│   └── package.json
├── firestore.rules             # ★ 실제 접근통제 — 수정 시 반드시 배포
├── firestore.indexes.json      # Firestore 인덱스
├── firebase.json               # Firebase 호스팅·규칙 설정
├── .firebaserc                 # Firebase 프로젝트 연결
├── .gitignore                  # students-raw.csv 등 제외 목록
├── README.md                   # 학생용 공개 안내
└── ADMIN_GUIDE.md              # 관리자용 운영 가이드 (이 파일)
```

---

## 9. 자주 묻는 문제

### Q. 학생이 로그인이 안 된다고 합니다.

1. `scripts/students-raw.csv` 에 해당 학생의 **학번과 이름**이 정확히 입력되어 있는지 확인합니다.
2. `python scripts/run_hash.py` 로 해시를 재생성합니다.
3. `git add data/students-hashed.json` → commit → push 합니다.
4. push 후 1~2분 대기합니다.

### Q. 학생이 "예전 대화가 사라졌다"고 합니다.

정상 동작입니다. 상담 스레드는 **브라우저 단위**로 유지됩니다.
다른 기기·다른 브라우저·시크릿 창에서 접속하거나 브라우저 저장소를 지우면 새 대화가 시작됩니다.

이는 서버 없이 학생을 격리하기 위한 구조입니다. 학번만 입력하면 누구나 그 학번의 대화를
가져갈 수 있는 방식은 곧 개인정보 유출이 되기 때문에, 안전한 쪽을 택했습니다.
기기가 바뀌어도 이력을 유지하려면 10장의 "남은 한계" 를 참고하세요.

관리자 화면에서는 같은 학생이 여러 줄로 보일 수 있습니다(기기마다 스레드가 하나씩).
학번이 같으므로 구분에는 문제가 없습니다.

### Q. 관리자 로그인이 안 됩니다.

| 증상 | 원인 / 조치 |
|------|-------------|
| "이메일 또는 비밀번호가 올바르지 않습니다" | 계정·비밀번호 확인. Authentication → Users 에 계정이 있는지 확인 |
| "이 계정에는 관리자 권한이 없습니다" | Firestore `admins/{UID}` 문서가 없습니다. 2-2 를 다시 확인 (문서 ID 가 UID 와 정확히 같아야 합니다) |
| "관리자 권한을 확인하지 못했습니다" | 보안 규칙이 배포되지 않았습니다 → `firebase deploy --only firestore:rules` |
| 로그인 화면만 계속 뜸 | Authentication 의 **이메일/비밀번호** 로그인이 비활성 상태일 수 있습니다 |

### Q. 학생 목록이나 전체 삭제에서 권한 오류가 납니다.

보안 규칙이 배포되지 않았거나, `admins` 문서 등록이 누락된 경우입니다.

```powershell
firebase deploy --only firestore:rules
```

### Q. git push 시 `git` 명령어를 인식하지 못합니다.

PowerShell 에 git 경로가 등록되지 않은 것입니다. 터미널을 닫고 새로 열면 해결됩니다.

### Q. `&&` 연산자가 동작하지 않습니다.

PowerShell 에서는 `&&` 를 지원하지 않습니다. 명령어를 한 줄씩 실행하세요.

---

## 10. 보안 설계와 남은 한계

### 이번에 바로잡은 것

| 문제 | 이전 | 지금 |
|------|------|------|
| 관리자 자격증명 | 공개 JS 에 `aidata2025 / 관리자` 하드코딩 | 코드에 비밀값 없음. Firebase Auth 계정 |
| 관리자 판정 | 브라우저의 `sessionStorage.isAdmin` | 보안 규칙에서 `admins/{uid}` 문서 확인 |
| 데이터 접근 | 익명 로그인만 하면 **전 학생 상담 내역 열람·수정·삭제 가능** | 학생은 본인 스레드만, 관리자만 전체 |
| 관리자 답변 | 누구나 `role:"admin"` 메시지 작성 가능 | 관리자만 작성 가능 |
| 명단 해시 | salt 없는 단일 SHA-256 (전수 대입으로 명단 복원 가능) | salt + PBKDF2 60만 회 |

### 새 기능을 추가할 때 지킬 것

1. 권한이 걸린 동작을 추가하면 **`firestore.rules` 를 먼저 고치고 배포**합니다.
   화면에서 버튼을 숨기는 것은 접근통제가 아닙니다.
2. `sessionStorage` / `localStorage` / JS 변수는 **화면 표시 용도로만** 씁니다.
3. 비밀값(비밀번호, 서비스 계정 키, 토큰)은 `js/` 아래 어디에도 두지 않습니다.
   이 폴더는 전부 브라우저로 내려갑니다.
4. 규칙을 바꿨다면 **학생 계정과 관리자 계정 양쪽에서** 실제로 눌러 확인합니다.

### 남은 한계 (서버가 없어서 생기는 것)

이 시스템은 GitHub Pages + Firebase(Spark 무료 플랜) 로만 동작합니다.
서버 코드가 없기 때문에 아래 두 가지는 구조적으로 남아 있습니다.

**1) 재학생 명단 파일이 공개됩니다**

`data/students-hashed.json` 은 누구나 내려받을 수 있습니다.
salt + PBKDF2 60만 회로 역산 비용을 크게 올렸지만(단순 SHA-256 대비 수십만 배),
자원을 들이면 학번·이름 조합을 대입해 명단을 복원하는 것 자체는 여전히 가능합니다.

**2) 학번은 "본인 확인" 이 아니라 "명단 확인" 입니다**

학번과 이름을 아는 사람은 그 학생 이름으로 상담을 시작할 수 있습니다.
(다만 **다른 학생의 기존 대화를 읽을 수는 없습니다** — 그 부분은 규칙이 막습니다.)
또한 기기가 바뀌면 이전 대화 이력이 이어지지 않습니다.

**두 한계를 없애려면** Firebase 를 Blaze(종량제) 플랜으로 올리고 Cloud Functions 를 도입해야 합니다.
이 규모에서 실사용 비용은 사실상 0원이지만 결제수단 등록이 필요합니다. 구성은 다음과 같습니다.

- 명단을 Firestore 비공개 컬렉션으로 옮기고 `data/students-hashed.json` 을 삭제
- Function 이 학번·이름을 **서버에서** 대조한 뒤 커스텀 토큰 발급
  (uid 를 학번 기반으로 고정 → 기기가 바뀌어도 이력 유지)
- 학교 계정(SSO)이나 이메일 인증을 붙이면 본인 확인까지 가능

### 보안 문의를 받았을 때

취약점 제보를 받으면 **먼저 `firestore.rules` 를 확인**하세요.
이 시스템에서 데이터가 실제로 새는지 여부는 거의 항상 이 파일이 결정합니다.
화면이 열리는 것과 데이터가 나가는 것은 다른 문제입니다.
