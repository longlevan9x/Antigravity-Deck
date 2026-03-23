# 🤖 Agent Bridge - Development Notes

This file records important changes and configuration steps for the Antigravity Deck Bridge (Telegram/Discord).

## 📝 Recent Changes (2024-03-24)

### 1. Unified Logging System
- **File:** `src/agent-bridge.js`
  - Updated `eventHook` to support `log` and `update` events.
  - Now correctly routes logs from transport modules to the central `addLog` function.
- **File:** `src/telegram-relay.js`
  - Replaced invalid `addLog` calls with `eventHook('log', ...)` calls.
  - Added "Start", "Before", and "After" diagnostic logs for incoming Telegram messages.

---

## ⚙️ Telegram Configuration: Group Privacy

If your Bot is in a Telegram Group and **cannot see plain text messages** (only seeing commands starting with `/`), you need to disable **Privacy Mode**.

### Steps to disable:
1.  Open Telegram and chat with **@BotFather**.
2.  Send `/mybots` and select your bot.
3.  Go to **Bot Settings** -> **Group Privacy**.
4.  Click **Turn off**. You should see: *"Privacy mode is currently disabled for [YourBot]"*.
5.  **CRITICAL:** You must **Remove the Bot from the Group and Add it back** for the change to take effect immediately.

---
*Last updated: 2024-03-24*
