# MINDCARE AI
> **AI-Powered Cognitive Gaming & Memory Assistance Platform**  
> *Smart India Hackathon Prototype (Problem Statement: SIH26003)*  
> **Team:** Algo Rangers

---

## 🌟 Overview & Product Vision

**MINDCARE AI** is a mobile-first, elderly-friendly cognitive support and caregiver monitoring platform designed specifically to aid elderly dementia patients in the North Eastern Region (NER) and beyond.

### Key Features
1. **5 Interactive Cognitive Games:**
   - 🧠 **Memory Match:** Flip card visual pattern matching.
   - 🔴 **Sequence Recall:** Simon-says style color/symbol pattern attention.
   - 🫖 **Object Recall:** Everyday household item retention & recall.
   - 👩‍👧 **Name & Face Memory:** Familiar family photo & name recognition.
   - 📖 **Story Recall:** Narrative reading/listening comprehension.
2. **Adaptive AI Engine:** Automatically measures accuracy, attempts, and response times to adjust challenge levels (Levels 1–4) and generate non-clinical caregiver insights.
3. **Memory Assistant:** Smart conversational assistant answering user queries regarding routines, family visits, and daily reminders.
4. **Caregiver Dashboard:** Real-time analytics, Recharts visualizations, familiar profile manager, and AI recommendations.
5. **QR Device Connection:** Cross-device pairing between caregiver laptop/phone and elderly tablet using temporary session tokens (`mindcare://connect/{token}`).
6. **Real-time Synchronization:** Multi-tab/multi-device state bus via `BroadcastChannel` API and window storage events.
7. **Elderly Accessibility:** Minimum 44px+ touch targets, text size scaling (Small, Medium, Large), high-contrast mode, and Web Speech voice guidance.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server with LAN Access
```bash
npm run dev -- --host 0.0.0.0
```

### 3. Open in Browser
- **Local Laptop:** `http://localhost:5173`
- **Mobile Phone / Tablet on same Wi-Fi:** `http://<YOUR_LOCAL_IP>:5173`

---

## 🎬 Live Hackathon Demo Sequence for Judges

1. Open **MindCare AI** landing page (`http://localhost:5173`).
2. Click **"Continue as Demo Caregiver"** to enter the Caregiver Dashboard.
3. Explore metric cards, Recharts charts, AI insights, and familiar people configuration.
4. Click **"QR Pair Device"** in top navbar.
5. Open the URL on a mobile device or second browser window and select **"Continue as Demo Elderly"**.
6. On the elderly device, navigate to **Connect Device** and scan the QR code (or enter token `MC-DEMO-7789`).
7. Watch the status change to **🟢 Online (Connected)** on both screens.
8. Play **Memory Match** or **Name & Face Memory** on the elderly screen.
9. Finish the game and view instant adaptive AI score calculation and difficulty recommendation.
10. Add a new reminder on caregiver view and witness it appear instantly on the elderly screen via real-time sync.

---

## 🔒 Medical & Privacy Safety
- MindCare AI is a cognitive support and engagement prototype.
- **Does NOT** diagnose medical conditions or provide treatment recommendations.
- All personal profile information remains private and stored locally.
