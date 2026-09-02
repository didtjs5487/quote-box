// ─────────────────────────────────────────────────────────────
// 백업 기능용 Firebase 설정 (선택 사항)
// 이 파일을 채우지 않아도 앱은 그대로 잘 동작해요 — 로컬 저장만 쓰고,
// "백업 암호" 기능만 못 쓰는 상태가 됩니다.
//
// 백업 기능을 쓰고 싶다면:
// 1) https://console.firebase.google.com 에서 새 프로젝트를 만드세요.
// 2) 빌드 > Firestore Database > 데이터베이스 만들기 (테스트 모드로 시작).
// 3) 프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > "</>" (웹 앱)을 추가하세요.
// 4) 아래 firebaseConfig 값을 발급받은 값으로 교체하세요.
// 5) firestore.rules 파일 내용을 Firestore Database > 규칙 탭에 붙여넣고 게시하세요.
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyCk0wonsLgcgPV-Z3ivnPOmy3ZMxsqKers",
  authDomain: "didtjs5487-quote-box.firebaseapp.com",
  projectId: "didtjs5487-quote-box",
  storageBucket: "didtjs5487-quote-box.firebasestorage.app",
  messagingSenderId: "793871789271",
  appId: "1:793871789271:web:6e8993220c16ca65325492",
  measurementId: "G-TKZ08WDCJN"
};

window.__FIREBASE_CONFIG__ = firebaseConfig;
