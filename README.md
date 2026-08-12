<div align="center">

  <!-- White High-Contrast Logo for GitHub -->
  <img src="logos/logo-white.svg" alt="WhatsGrow Logo" width="380" />

  <br />
  <br />

  <!-- Animated Typing SVG Subtitle -->
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1200&color=3B82F6&center=true&vCenter=true&width=600&lines=WhatsApp+Automation+%26+Marketing+API;Multi-Session+Messaging+Gateway;Self-Hosted+%26+100%25+Control;Docker+Native+%2B+REST+%2B+Webhooks" alt="Typing Banner" />
  </a>

  <br />
  <br />

  <!-- Badges -->
  <p align="center">
    <a href="https://github.com/parth7123/Whatsgrow"><img src="https://img.shields.io/badge/version-v0.7.6-3B82F6?style=for-the-badge&logo=github" alt="Version"/></a>
    <img src="https://img.shields.io/badge/node-22_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/NestJS-11.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"/>
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
    <img src="https://img.shields.io/badge/License-MIT-00C853?style=for-the-badge" alt="License"/>
  </p>

  <p align="center">
    <a href="#-quick-start"><b>Quick Start</b></a> •
    <a href="#-key-features"><b>Key Features</b></a> •
    <a href="#-architecture--tech-stack"><b>Tech Stack</b></a> •
    <a href="#-api-examples"><b>API Reference</b></a> •
    <a href="#-security"><b>Security</b></a>
  </p>

</div>

---

## ⚡ Overview

**WhatsGrow** is a production-ready **WhatsApp Automation & Marketing API Gateway**. It empowers developers, startups, and enterprises to send, receive, and automate WhatsApp communications at scale without vendor lock-in or recurring per-message fees.

### 🌟 Why Choose WhatsGrow?

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │   REST API      │ ───►  │   WhatsGrow     │ ───►  │  WhatsApp Web / │
 │   & Dashboard   │       │   Core Engine   │       │     Baileys     │
 └─────────────────┘       └─────────────────┘       └─────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
            ┌─────────────────────┐   ┌─────────────────────┐
            │ SQLite / Postgres   │   │ Local / S3 Media    │
            └─────────────────────┘   └─────────────────────┘
```

- 🚀 **100% Self-Hosted**: Complete ownership of your data, session storage, and media.
- 📱 **Multi-Session Management**: Run dozens of active WhatsApp sessions concurrently on a single server.
- ⚡ **Pluggable Architecture**: Seamlessly switch databases (SQLite/PostgreSQL), storage (Local/S3/MinIO), and caching (Memory/Redis) via configuration.
- 📊 **Built-in React Dashboard**: Included web interface for real-time chat monitoring, session QR pairing, webhook logs, and key management.
- 🤖 **AI & Webhook Friendly**: Real-time event streaming with HMAC signature verification, pre-dispatch filters, and Model Context Protocol (MCP) support for AI agents.

---

## 🛠 Tech Stack

<div align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=nodejs,nestjs,ts,docker,postgres,sqlite,redis,react,vite,express" alt="Tech Stack Icons" />
  </a>
</div>

<br />

| Layer | Technology |
| :--- | :--- |
| **Runtime & Backend** | Node.js 22 LTS, NestJS 11.x, TypeScript 5.x |
| **WhatsApp Engines** | `whatsapp-web.js` (default) & `Baileys` |
| **Frontend Dashboard** | React 18, Vite, Tailwind/CSS, Lucide Icons |
| **Databases** | SQLite (zero-config) & PostgreSQL |
| **Storage & Cache** | Local filesystem, AWS S3 / MinIO, Redis |
| **Containerization** | Docker, Docker Compose |

---

## 🎯 Key Features

| Feature | Description | Status |
| :--- | :--- | :---: |
| 📩 **REST Messaging API** | Send text, images, videos, audio, documents, stickers, and reactions | ✅ |
| 👥 **Multi-Session Engine** | Connect multiple numbers via QR code scan or Pairing Code | ✅ |
| 🪝 **Smart Webhooks** | Real-time events with HMAC signatures & field filtering | ✅ |
| 📊 **Admin Dashboard** | Interactive UI served right alongside the API | ✅ |
| 🔑 **API Key & User Roles** | Role-based authorization (Admin, Operator, Viewer) | ✅ |
| 📑 **Interactive Swagger** | Built-in Swagger UI documentation (`/api/docs`) | ✅ |
| 💬 **Groups & Channels** | Create/manage groups, fetch metadata, post to Channels | ✅ |
| 🏷️ **Labels & Contacts** | WhatsApp Business labels management & contact syncing | ✅ |
| 🤖 **MCP Server Support** | Built-in Model Context Protocol for Claude / Cursor AI | ✅ |

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

Get up and running in under 60 seconds with Docker:

```bash
# 1. Clone the repository
git clone https://github.com/parth7123/Whatsgrow.git
cd Whatsgrow

# 2. Launch with Docker Compose
docker compose -f docker-compose.dev.yml up -d
```

Access the interfaces once started:
- 📊 **Dashboard UI**: [http://localhost:2785](http://localhost:2785)
- 📚 **Swagger Docs**: [http://localhost:2785/api/docs](http://localhost:2785/api/docs)
- 🔌 **API Base**: `http://localhost:2785/api`

---

### Option 2: Local Node.js Development

```bash
# 1. Clone the repository
git clone https://github.com/parth7123/Whatsgrow.git
cd Whatsgrow

# 2. Install dependencies
npm install

# 3. Start development server (API + Dashboard concurrently)
npm run dev
```

Dev Server URLs:
- 📊 **Dashboard (Vite Hot-Reload)**: [http://localhost:2886](http://localhost:2886)
- ⚡ **API Server**: [http://localhost:2785](http://localhost:2785)

---

## 📡 API Reference & Code Examples

<details>
<summary><b>1. Create a WhatsApp Session</b></summary>

```bash
curl -X POST http://localhost:2785/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "name": "sales-bot"
  }'
```
</details>

<details>
<summary><b>2. Get QR Code for Pairing</b></summary>

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/start \
  -H "X-API-Key: YOUR_API_KEY"

# Fetch QR Code SVG/Image
curl http://localhost:2785/api/sessions/{sessionId}/qr \
  -H "X-API-Key: YOUR_API_KEY"
```
</details>

<details>
<summary><b>3. Send Text & Media Message</b></summary>

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/messages/send-text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "chatId": "1234567890@c.us",
    "text": "Hello from WhatsGrow API! 🚀"
  }'
```
</details>

<details>
<summary><b>4. Configure Webhooks</b></summary>

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "url": "https://your-domain.com/api/webhook",
    "events": ["message.received", "session.status"],
    "secret": "your-hmac-secret-key"
  }'
```
</details>

---

## 🔒 Security & Best Practices

- **Non-Root Execution**: Docker containers run as unprivileged `whatsgrow` user.
- **Docker Socket Proxy**: Protects host daemon via container proxy sidecar.
- **API Key Hashing**: Key secrets are stored using secure salted hashes (`bcrypt`).
- **IP & CIDR Whitelisting**: Restrict API keys to specific trusted server IP addresses.

---

## 📄 License

Distributed under the **MIT License**. Free for personal, commercial, and enterprise usage.

<br />

<div align="center">
  <sub>Built with ❤️ for the global WhatsApp developer community.</sub>
</div>
