# Real-time UI — Pulse Dashboard

A live, streaming real-time UI dashboard built with vanilla HTML, CSS, and JavaScript — submitted as **Task 6 (Advanced)** of the Nexe-Agent Frontend Developer Internship.

## 🔗 Live Demo[
https://uirealtime.netlify.app/

## ✦ Features

### 🔌 WebSocket Connection
- Connects to a real WebSocket server (wss://echo.websocket.events)
- Live status indicator — 🟢 Connected / 🟡 Connecting / 🔴 Disconnected
- Auto-reconnects every 5 seconds if connection drops
- Gracefully falls back to simulation mode if network blocks WebSocket

### 📡 Live Event Feed
- Events stream in automatically every 1–4 seconds
- 4 event types — Alert, Success, Info, Warning
- Each event shows title, message, source server and timestamp
- Filter tabs to show only one event type at a time
- Auto-scroll toggle to lock/follow the latest events
- Pause button to freeze the feed without disconnecting
- Clear All button to reset the feed

### 🔔 Live Notification Panel
- Critical alerts and warnings auto-push to notifications
- Unread count badge updates in real time
- Click any notification to mark it as read
- Mark All Read button clears all unread at once
- Max 25 notifications kept in panel

### ♻ Auto-Refresh Without Reload
- Progress bar at the bottom counts down every 8 seconds
- On completion, automatically fetches a fresh batch of events
- All stats and counters update live
- Zero page reloads required at any point

### ⬡ WebSocket Console
- Color-coded log — sent (blue), received (green), system (grey), error (red)
- Type any message and send it directly to the WebSocket server
- Server echoes it back and it appears in the log
- Clear button to wipe the console log

### 📊 Live Stats Bar
- Events/min — resets every 60 seconds
- Total Events — cumulative count since page load
- Uptime — live MM:SS counter since connection started
- Last Ping — timestamp of most recent server message

## 🛠 Built With
- HTML5
- CSS3 (CSS Variables, Grid, Flexbox, Keyframe Animations)
- Vanilla JavaScript
- WebSocket API (native browser)
- Google Fonts — Epilogue + Azeret Mono
- Zero external dependencies

## 📁 File Structure
