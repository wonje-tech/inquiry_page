# 학과 상담 시스템

학과 재학생 ↔ 관리자 실시간 채팅 홈페이지.  
GitHub Pages(화면) + Firebase(채팅 저장·자정 초기화)로 운영합니다.

---

## 파일 구조

```
├── index.html                  # 로그인
├── chat.html                   # 학생 채팅
├── admin.html                  # 관리자 대시보드
├── css/style.css
├── js/
│   ├── config.js               # ← Firebase 설정 입력
│   └── auth.js                 # 로그인 인증 (해시 비교)
├── data/
│   └── students-hashed.json    # 학번+이름 SHA-256 해시 목록
├── scripts/
│   └── hash-students.js        # 명단 해시 생성 스크립트 (로컬 전용)
├── functions/
│   └── index.js                # 자정 초기화 Cloud Function
├── firestore.rules             # Firestore 보안 규칙
└── .gitignore                  # students-raw.csv 보호
```

---

## 셋업 순서

### 1. Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/) → 새 프로젝트
2. **Authentication** → 로그인 방법 → **익명** 사용 설정
3. **Firestore Database** → 데이터베이스 만들기 → 프로덕션 모드

### 2. Firebase 설정값 입력

Firebase Console → ⚙️ 프로젝트 설정 → 내 앱 → 웹 앱(`</>`) → SDK 구성  
복사한 값을 `js/config.js`에 붙여넣기.

### 3. 관리자 계정 설정

`js/auth.js` 상단:
```js
const ADMIN_ID   = "admin";   // 원하는 관리자 학번
const ADMIN_NAME = "관리자";   // 원하는 관리자 이름
```

### 4. 학생 명단 해시 생성

```
# scripts/students-raw.csv 작성 (헤더 없이)
20201234,홍길동
20201235,김철수
...

# 터미널에서 실행 (Node.js 필요)
node scripts/hash-students.js

# data/students-hashed.json 생성 확인 → 커밋
```

> `students-raw.csv`는 `.gitignore`에 있어 자동으로 제외됩니다.

### 5. Firestore 보안 규칙 적용

Firebase Console → Firestore → **규칙** 탭  
→ `firestore.rules` 내용 전체 복사 후 붙여넣기 → **게시**

### 6. GitHub Pages 배포

```bash
git init
git add .
git commit -m "초기 배포"
git remote add origin https://github.com/YOUR_ID/YOUR_REPO.git
git push -u origin main
```

GitHub 저장소 → Settings → Pages → Source: `main` 브랜치 루트(`/`)

### 7. 자정 초기화 설정 (선택)

터미널에서:
```bash
npm install -g firebase-tools
firebase login
firebase use --add          # 프로젝트 선택

cd functions && npm install && cd ..
firebase deploy --only functions
```

> 이 단계는 나중에 해도 됩니다. 없어도 로그인·채팅은 모두 동작합니다.

---

## 명단 보안

원본 명단은 `scripts/students-raw.csv`에만 존재하며, GitHub에는 올라가지 않습니다.  
해시값만 `data/students-hashed.json`에 저장되고, 해시는 단방향이라 역추적이 불가능합니다.

저장소를 **Private**으로 설정하면 해시 파일도 외부에 노출되지 않습니다.

---

## 명단 업데이트 방법

```bash
# students-raw.csv 수정 후
node scripts/hash-students.js
git add data/students-hashed.json
git commit -m "명단 업데이트"
git push
```
