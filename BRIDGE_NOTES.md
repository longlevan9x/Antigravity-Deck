# 🤖 Agent Bridge - Development & Architecture Notes

This document provides a detailed log of changes, technical architecture overview, and troubleshooting steps for the Antigravity Deck Bridge system.

---

## 🏗️ Architecture Overview

The Agent Bridge acts as a multi-transport relay between the Antigravity AI Engine (Cascade) and external communication platforms (Telegram, Discord).

### Core Components:
- **`agent-bridge.js`**: The central orchestrator. It manages the lifecycle of different transports, handles unified logging, and broadcasts messages between the AI session and the active relays.
- **`telegram-relay.js`**: Handles Telegram-specific communication using the `telegraf` library.
- **`discord-relay.js`**: Handles Discord-specific communication using `discord.js`.
- **`agent-session-manager.js`**: (Referenced) Manages the underlying AI cascades and workspace state.

---

## 📝 Change Log (2024-03-24) - Fix: Telegram Logging & Event Propagation

### 1. Unified Event Hook & Logging
- **Modified:** [src/agent-bridge.js](file:///e:/code/project/extension/Antigravity-Deck/src/agent-bridge.js)
  - **Problem:** Transport modules (Telegram/Discord) had no way to send diagnostic logs back to the main Bridge UI or terminal correctly.
  - **Solution:** Enhanced the `eventHook` function. It now understands two new event types:
    - `'log'`: Directly calls `addLog(data.type, data.message)`.
    - `'update'`: Automatically formats incoming message info as a system log: `[Transport] Message from User: Text`.
  - **Benefit:** Centralized logging ensures that ALL important events from any bridge appear in the `bridge.log` file and the web UI.

### 2. Telegram Relay Diagnostics
- **Modified:** [src/telegram-relay.js](file:///e:/code/project/extension/Antigravity-Deck/src/telegram-relay.js)
  - **Fix:** Removed hardcoded calls to `addLog` (which didn't exist in that file's scope).
  - **New Logic:** Implemented a sequence of diagnostic traces in `bot.on('text')`:
    1.  `Start Received`: Logged the moment any message hits the bot.
    2.  `Before handlePiReply`: Logged before sending text to the AI engine.
    3.  `After handlePiReply`: Logged after the AI engine finishes processing.
  - **Command Logging:** Added logging to `handleCommandWrap` to track when `/help`, `/status`, etc., are used.

---

## ⚙️ Troubleshooting: Telegram Group Privacy

If your Bot starts correctly but **only responds to commands** (starting with `/`) and ignores normal text in a Group, use the following guide:

### Why is this happening?
Telegram bots have a **Privacy Mode** enabled by default. This prevents bots from reading every conversation in a group unless they are specifically mentioned or a command is used. To bridge a full conversation, you must disable this.

### How to Fix:
1.  **Chat with @BotFather** in Telegram.
2.  Type `/mybots` and select your specific bot.
3.  Navigate to **Bot Settings** -> **Group Privacy**.
4.  Select **Turn off** (Wait for the confirmation message).
5.  **CRITICAL STEP:** Telegram caches these settings per-chat. You **MUST** remove the bot from your group and then re-add it for the change to take effect immediately.

---

## 📂 Key Files Reference
- `BRIDGE_NOTES.md`: (This file) Overview and recent history.
- `bridge.log`: Auto-generated file in project root containing all historical logs.
- `src/config.js`: Contains tokens and channel/chat IDs.

*Last updated: 2024-03-24 08:55*
