# 관리자 운영 가이드

> 이 문서는 시스템 운영자(교수·조교)를 위한 내부 문서입니다.  
> 학생에게 공개하지 마세요.

---

## 목차

1. [시스템 구조](#1-시스템-구조)
2. [관리자 로그인](#2-관리자-로그인)
3. [학생 명단 업데이트](#3-학생-명단-업데이트)
4. [자동 채팅 초기화 로직](#4-자동-채팅-초기화-로직)
5. [Firebase 규칙 배포](#5-firebase-규칙-배포)
6. [GitHub 배포 방법](#6-github-배포-방법)
7. [초기 세팅 방법 (최초 1회)](#7-초기-세팅-방법-최초-1회)
8. [파일 구조](#8-파일-구조)
9. [자주 묻는 문제](#9-자주-묻는-문제)

---

## 1. 시스템 구조

| 구성 요소 | 역할 |
|-----------|------|
| **GitHub Pages** | 정적 프론트엔드 호스팅 (index, chat, admin 페이지) |
| **Firebase Auth** | 익명 로그인 (채팅 세션 관리) |
| **Firestore** | 실시간 채팅 메시지 저장 |
| **students-hashed.json** | 학번+이름의 SHA-256 해시 목록 (로그인 인증용) |

학생 원본 명단(`students-raw.csv`)은 로컬에만 존재하며, GitHub에는 해시값만 올라갑니다.

---

## 2. 관리자 로그인

`js/auth.js` 상단에서 관리자 계정을 설정합니다.

```js
const ADMIN_ID   = "aidata2025";  // 관리자 학번(ID)
const ADMIN_NAME = "관리자";       // 관리자 이름
```

변경 후 GitHub에 push하면 즉시 반영됩니다.

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
> ⚠️ `students-raw.csv`는 `.gitignore`에 등록되어 있어 GitHub에 올라가지 않습니다. 절대 `git add`하지 마세요.

### 3-2. 해시 재생성

CSV를 수정한 후 아래 명령어로 해시 파일을 갱신합니다.

```powershell
python scripts/run_hash.py
```

완료 시 아래 메시지가 출력됩니다:
```
✅  148명 처리 완료 → data/students-hashed.json
👉  다음 단계: git add data/students-hashed.json && git commit && git push
```

### 3-3. GitHub에 반영

```powershell
git add data/students-hashed.json
git commit -m "학생 명단 업데이트"
git push
```

push 후 1~2분 내에 GitHub Pages에 자동 반영됩니다.

---

## 4. 자동 채팅 초기화 로직

### 동작 원리

Cloud Functions 없이 Firestore 타임스탬프를 활용합니다.

1. Firestore `settings/chatReset` 문서에 `lastResetAt` 타임스탬프를 저장합니다.
2. 관리자가 페이지에 접속하면, `lastResetAt`이 **오늘 자정(00:00) 이전**인지 확인합니다.
3. 오늘 자정 이전이면 → **전체 채팅 자동 삭제** → `lastResetAt`을 현재 시각으로 업데이트합니다.
4. 오늘 이미 초기화됐으면 → 아무 동작 없이 카운트다운만 표시합니다.

### 결과

- 하루에 한 번만 초기화됩니다 (몇 번 접속해도 중복 삭제 없음).
- 관리자가 당일 첫 접속 시 자동으로 전날 채팅이 삭제됩니다.
- 관리자 화면 헤더에 **"자정 초기화까지 HH:MM:SS"** 카운트다운이 표시됩니다.

### 수동 전체 삭제

긴급하게 전체 채팅을 지워야 할 때는 관리자 페이지 사이드바 하단의  
**"⚠️ 전체 채팅 삭제"** 버튼을 사용합니다. 확인 팝업이 2회 뜨며, 삭제 후 `lastResetAt`도 현재 시각으로 갱신됩니다.

---

## 5. Firebase 규칙 배포

Firestore 보안 규칙(`firestore.rules`)을 수정한 경우, Firebase에 직접 배포해야 적용됩니다.

```powershell
cd "C:\WONJE\1_HUFS\3_연구\0_Subjects\CURSOR\inquiry_page\inquiry_page"
firebase deploy --only firestore:rules
```

> Spark(무료) 플랜에서도 가능합니다.

### 현재 규칙 요약

| 컬렉션 | 읽기 | 생성 | 수정 | 삭제 |
|--------|------|------|------|------|
| `chat_threads` | 인증된 사용자 | 본인 uid 포함 시 | 인증된 사용자 | 인증된 사용자 |
| `chat_threads/*/messages` | 인증된 사용자 | 1~1000자 메시지 | ❌ 불가 | 인증된 사용자 |
| `settings` | 인증된 사용자 | 인증된 사용자 | 인증된 사용자 | 인증된 사용자 |

---

## 6. GitHub 배포 방법

파일을 수정한 후 아래 명령어로 GitHub에 반영합니다.

```powershell
git add .
git commit -m "변경 내용 설명"
git push
```

push 후 GitHub Pages가 자동으로 빌드되며, 1~2분 후 사이트에 반영됩니다.

### 자주 쓰는 배포 명령어

| 상황 | 명령어 |
|------|--------|
| 학생 명단 업데이트 | `git add data/students-hashed.json` |
| 전체 파일 반영 | `git add .` |
| 커밋 | `git commit -m "메시지"` |
| 푸시 | `git push` |

> ⚠️ `&&` 연산자는 PowerShell에서 동작하지 않습니다. 명령어를 한 줄씩 실행하세요.

---

## 7. 초기 세팅 방법 (최초 1회)

처음 이 시스템을 설치할 때 필요한 단계입니다.

### 7-1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) → 새 프로젝트 생성
2. **Authentication** → 로그인 방법 → **익명** 활성화
3. **Firestore Database** → 데이터베이스 만들기 → 프로덕션 모드

### 7-2. Firebase 설정값 입력

Firebase Console → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱(`</>`) → SDK 구성에서 복사한 값을 **루트에 `.env` 파일**로 옮깁니다.

1. `.env.example`을 복사해 `.env`로 저장합니다.  
2. `FIREBASE_API_KEY` 등 6개 항목을 SDK 값으로 채웁니다. (`.env`는 git에 올리지 않습니다.)  
3. `npm run build:config` 를 실행합니다. `js/firebase-config.generated.js`가 생성됩니다.  
4. `firebase deploy` 는 배포 직전에 `build:config` 를 자동으로 실행하므로( `firebase.json`의 `predeploy` ), deploy 전에 Node와 `.env`가 준비되어 있으면 됩니다.

### 7-3. Firebase CLI 설치 (규칙 배포용)

```powershell
# Node.js 설치 후
npm install -g firebase-tools
firebase login    # 브라우저에서 Google 계정 로그인
```

### 7-4. GitHub Pages 활성화

GitHub 저장소 → Settings → Pages → Source: `main` 브랜치 `/` (root)

### 7-5. .firebaserc 설정

프로젝트 폴더에 `.firebaserc` 파일이 있어야 Firebase CLI가 프로젝트를 인식합니다.

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
├── admin.html                  # 관리자 대시보드 (자동 초기화 포함)
├── css/
│   └── style.css               # 전체 스타일
├── js/
│   ├── config.js               # Firebase — 생성된 값 로드
│   ├── firebase-config.generated.js  # `npm run build:config`로 생성, git 제외
│   └── auth.js                 # 로그인 인증 (SHA-256 해시 비교)
├── .env.example                # .env 복사용 템플릿(키 없음; 실제 .env 는 git 제외)
├── data/
│   └── students-hashed.json    # 학번+이름 SHA-256 해시 목록 (공개)
├── scripts/
│   ├── students-raw.csv        # 원본 학생 명단 (로컬 전용, git 제외)
│   ├── hash-students.js        # 해시 생성 스크립트 (Node.js)
│   └── run_hash.py             # 해시 생성 스크립트 (Python, 권장)
├── functions/
│   ├── index.js                # Cloud Function (현재 미사용)
│   └── package.json
├── firestore.rules             # Firestore 보안 규칙
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

1. `scripts/students-raw.csv`에 해당 학생의 **학번과 이름**이 정확히 입력되어 있는지 확인합니다.
2. `python scripts/run_hash.py`로 해시를 재생성합니다.
3. `git add data/students-hashed.json → commit → push`합니다.
4. push 후 1~2분 대기합니다.

### Q. 전체 채팅 삭제가 오류가 납니다.

Firestore 규칙이 배포되지 않아서입니다.
```powershell
firebase deploy --only firestore:rules
```

### Q. 자동 초기화가 안 됩니다.

관리자가 당일 접속하지 않으면 초기화가 되지 않습니다 (Cloud Functions 미사용으로 인한 한계).  
관리자가 매일 한 번 이상 관리자 페이지에 접속하면 자동으로 초기화됩니다.

### Q. git push 시 `git` 명령어를 인식하지 못합니다.

PowerShell에 git 경로가 등록되지 않은 것입니다. 터미널을 닫고 새로 열면 해결됩니다.  
(Git 경로가 시스템 환경변수 PATH에 이미 등록되어 있습니다.)

### Q. `&&` 연산자가 동작하지 않습니다.

PowerShell에서는 `&&`를 지원하지 않습니다. 명령어를 한 줄씩 실행하세요.
