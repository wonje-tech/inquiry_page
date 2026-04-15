// ============================================================
//  functions/index.js
//  Firebase Cloud Functions — 매일 자정(KST) 채팅 초기화
// ============================================================

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

/**
 * 매일 KST 00:00 (= UTC 15:00) 채팅 초기화
 */
exports.resetDailyChat = onSchedule(
  { schedule: "0 15 * * *", timeZone: "UTC", region: "asia-northeast3" },
  async () => {
    console.log("채팅 초기화 시작...");

    const threads = await db.collection("chat_threads").get();
    if (threads.empty) { console.log("스레드 없음"); return; }

    let batch    = db.batch();
    let opCount  = 0;
    let msgTotal = 0;

    for (const thread of threads.docs) {
      const msgs = await thread.ref.collection("messages").get();
      for (const msg of msgs.docs) {
        batch.delete(msg.ref);
        msgTotal++;
        if (++opCount >= 490) {          // Firestore 배치 한도 500
          await batch.commit();
          batch = db.batch(); opCount = 0;
        }
      }
      batch.update(thread.ref, {
        lastMessage: "", lastMessageAt: FieldValue.serverTimestamp(), hasUnread: false
      });
      if (++opCount >= 490) {
        await batch.commit();
        batch = db.batch(); opCount = 0;
      }
    }
    if (opCount > 0) await batch.commit();
    console.log(`완료: ${threads.size}개 스레드, ${msgTotal}개 메시지 삭제`);
  }
);
