<p align="center">
  <img src="logos/WG_SVG_light.svg" alt="WhatsGrow Logo" width="320"/>
</p>

<h1 align="center">WhatsGrow</h1>
<p align="center">
  <strong>WhatsApp Automation & Marketing API Gateway</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-api-examples">API</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.17.0-blue" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"/>
  <img src="https://img.shields.io/badge/node-22_LTS-brightgreen.svg" alt="Node"/>
  <img src="https://img.shields.io/badge/NestJS-11.x-red.svg" alt="NestJS"/>
  <img src="https://img.shields.io/badge/docker-ready-blue.svg" alt="Docker"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript"/>
</p>

---

## ✨ Why WhatsGrow?

**WhatsGrow** is a powerful WhatsApp Automation & Marketing API Gateway designed for businesses and developers who need full control over their messaging infrastructure—without vendor lock-in or hidden paywalls.

Built on a **pluggable architecture**, WhatsGrow lets you swap database engines (SQLite/PostgreSQL), storage backends (Local/S3), and cache layers (Memory/Redis) without changing application code.

|                               |                                                              |
| ----------------------------- | ------------------------------------------------------------ |
| 🔓 **100% Self-Hosted**       | No licensing fees, no feature locks, full source code access |
| 🏗️ **Pluggable Architecture** | Swap adapters for database, storage, and cache via config    |
| 🖥️ **Full Dashboard**         | Modern React UI for session, webhook, and API key management |
| 🔹 **Multi-Session Ready**    | Run multiple WhatsApp sessions concurrently on one instance  |
| 🐳 **Docker Native**          | Production-ready with zero configuration                     |
| 🔗 **n8n Integration**        | Community nodes for workflow automation                      |
| 🧩 **Community Adapters**     | Third-party integrations — see [docs](./docs/23-community-integrations.md) |

---

## 🎯 Features

### Core Features

| Feature       | Status | Description                          |
| ------------- | ------ | ------------------------------------ |
| REST API      | ✅     | Full WhatsApp API via HTTP endpoints |
| Multi-Session | ✅     | Manage multiple WhatsApp accounts    |
| Webhooks      | ✅     | Real-time events with HMAC signature and optional smart pre-dispatch filters |
| Web Dashboard | ✅     | Visual management interface          |
| API Key Auth  | ✅     | Secure API authentication            |
| Swagger Docs  | ✅     | Interactive API documentation        |

### Messaging

| Feature           | Status | Description                      |
| ----------------- | ------ | -------------------------------- |
| Text Messages     | ✅     | Send/receive text messages       |
| Media Messages    | ✅     | Images, videos, documents, audio |
| Message Reactions | ✅     | React to messages with emoji     |
| Bulk Messaging    | ✅     | Send to multiple recipients      |
| Message Status    | ✅     | Track delivery and read receipts |

### Advanced

| Feature             | Status | Description                        |
| ------------------- | ------ | ---------------------------------- |
| Groups API          | ✅     | Create, manage, and message groups |
| Channels/Newsletter | ✅     | WhatsApp Channels support          |
| Labels Management   | ✅     | Organize chats with labels         |
| Proxy Support       | ✅     | Per-session proxy configuration    |
| Rate Limiting       | ✅     | Configurable request limits        |
| CIDR Whitelisting   | ✅     | IP-based access control            |
| Audit Logging       | ✅     | Track all API operations           |

### Infrastructure

| Feature          | Status | Description                    |
| ---------------- | ------ | ------------------------------ |
| SQLite           | ✅     | Zero-config embedded database  |
| PostgreSQL       | ✅     | Production-grade database      |
| Redis Cache      | ✅     | Optional performance caching   |
| S3/MinIO Storage | ✅     | Scalable media storage         |
| Docker           | ✅     | One-command deployment         |
| Health Checks    | ✅     | Kubernetes-ready probes        |
| Data Migration   | ✅     | Export/import between backends |

---

## 🚀 Quick Start

### Option A: Docker (Recommended)

```bash
# Clone and start
git clone https://github.com/parth7123/Whatsgrow.git
cd Whatsgrow
docker compose -f docker-compose.dev.yml up -d

# Access (the dashboard is bundled into the API image and served on the same port)
# Dashboard: http://localhost:2785
# API: http://localhost:2785/api
# Swagger: http://localhost:2785/api/docs
```

### Option B: Local Development

```bash
# Clone repository
git clone https://github.com/parth7123/Whatsgrow.git
cd Whatsgrow

# Install dependencies (includes dashboard)
npm install

# Start API + Dashboard
npm run dev

# Access
# Dashboard: http://localhost:2886
# API: http://localhost:2785/api
# Swagger: http://localhost:2785/api/docs
```

---

## 🔒 Security Architecture

### Non-root Container Execution

The production image never runs the Node.js process as root. On startup, the container follows this chain:

```
dumb-init (PID 1)
  └─ docker-entrypoint.sh (root — fixes named-volume ownership via chown)
       └─ gosu whatsgrow node dist/main
```

---

## 🏭 Production Deployment

For production, use the main `docker-compose.yml` with optional services:

```bash
# Basic production (SQLite, local storage)
docker compose up -d

# With PostgreSQL database
docker compose --profile postgres up -d

# Full stack (PostgreSQL, Redis, MinIO)
docker compose --profile full up -d
```

| Profile    | Services              |
| ---------- | --------------------- |
| `postgres` | PostgreSQL database   |
| `redis`    | Redis cache           |
| `minio`    | S3-compatible storage |
| `full`     | All services above    |

---

## 🔌 Ports

| Service         | Port            | Description                                   |
| --------------- | --------------- | --------------------------------------------- |
| API & Dashboard | `2785`          | REST API + bundled web dashboard (same port)  |
| Swagger         | `2785/api/docs` | Interactive API docs                          |
| Dashboard (dev) | `2886`          | Vite dev server with hot reload (`npm run dev`) |

---

## 📡 API Examples

### Create a Session

```bash
curl -X POST http://localhost:2785/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"name": "my-bot"}'
```

### Send a Message

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/messages/send-text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "chatId": "1234567890@c.us",
    "text": "Hello from WhatsGrow!"
  }'
```

---

## 🛠 Tech Stack

| Layer         | Technology              |
| ------------- | ----------------------- |
| **Runtime**   | Node.js 22 LTS          |
| **Framework** | NestJS 11.x             |
| **Language**  | TypeScript 5.x          |
| **WA Engine** | whatsapp-web.js (default) / baileys — set `ENGINE_TYPE` |
| **Database**  | SQLite / PostgreSQL     |
| **Cache**     | Redis (optional)        |
| **Storage**   | Local / S3 / MinIO      |
| **ORM**       | TypeORM                 |
| **Container** | Docker + Docker Compose |

---

## 📁 Project Structure

```
whatsgrow/
├── src/                        # NestJS API Backend
├── dashboard/                  # React Web Dashboard
├── docs/                      # Comprehensive Documentation
├── logos/                      # SVG Brand Assets
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## 📄 License

This project is licensed under the **MIT License**.

See [LICENSE](./LICENSE) for details.

---

<div align="center">

**WhatsGrow** – WhatsApp Automation & Marketing API Gateway

[📖 Documentation](./docs/README.md) · [🔌 API Docs](http://localhost:2785/api/docs)

</div>
