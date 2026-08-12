# OpenWA — Open Source WhatsApp API Gateway & Marketing Automation Platform

> **Complete Website Content Blueprint & Collage Copy**
> Organised specifically into standard landing website navigation sections: **Hero**, **About**, **Features**, **Solutions**, **FAQ**, and **Contact**.

---

## 🚀 1. HERO SECTION

### Headlines
* **Primary Headline:** "The Enterprise-Grade, Self-Hosted WhatsApp API Gateway & Marketing Automation Engine."
* **Alternative Tagline:** "Scale Unlimited WhatsApp Messaging, Broadcast Campaigns, and AI Agents — 100% Open Source."

### Sub-headline
"OpenWA is a developer-first HTTP API Gateway and marketing automation platform built on NestJS and React. Connect multiple WhatsApp accounts, execute targeted drip campaigns, integrate AI agents via MCP, and automate workflows with zero vendor lock-in or per-message charges."

### Primary Call-to-Action (CTA) Buttons
* 🟢 **Get Started Free** (`docker run openwa`)
* 📖 **Explore API Documentation** (`/api/docs`)
* ⭐️ **Star on GitHub** (MIT Licensed)

### Live Impact Metrics
* **$0** Cloud API Markup / Per-Message Fees
* **100%** Data Ownership & Self-Hosted Privacy
* **Multi-Session** Concurrent Account Management
* **39+** Built-in MCP Tools for Claude & AI Agents
* **2** Interchangeable Protocol Engines (`whatsapp-web.js` & `Baileys`)

---

## ℹ️ 2. ABOUT (About OpenWA & Core Architecture)

### What is OpenWA?
OpenWA is a free, self-hosted, enterprise-ready WhatsApp API Gateway designed for developers, digital marketers, and businesses who need total control over their messaging infrastructure. 

Unlike proprietary cloud API platforms that charge high per-message fees and enforce strict sandbox restrictions, OpenWA links directly to your existing WhatsApp numbers via QR code scan. It provides an HTTP REST API, real-time WebSocket events, a built-in React Web Dashboard, and native Model Context Protocol (MCP) support.

### The Problem We Solve
* **Excessive Costs:** SaaS messaging providers charge compounding fees as your contact list grows.
* **Vendor Lock-in:** Data and workflows are trapped within proprietary SaaS dashboards.
* **Complex Setup:** Official Meta Business APIs require complex Facebook Business verification, message template pre-approvals, and high billing minimums.
* **Privacy Concerns:** Customer message payloads travel through third-party servers.

### The OpenWA Advantage
* **Zero API Cost:** Pay only for your hosting server. Send unlimited messages.
* **Pluggable Architecture:** Swap database engines (**SQLite** / **PostgreSQL**), cache layers (**In-Memory** / **Redis + BullMQ**), and storage backends (**Local Filesystem** / **AWS S3 / MinIO**) using simple configuration flags without altering application code.
* **Developer First:** Built with NestJS 11, TypeScript 5, TypeORM, Swagger, and Docker multi-arch support (`amd64` / `arm64`).

---

## ✨ 3. FEATURES (Complete Platform Capabilities)

### 💬 Core Messaging & Media
* **Multi-Format Messaging:** Send & receive text, HD images, audio/voice notes, video files, PDFs/documents, location coordinates, and VCards.
* **Interactive Controls:** Emoji reactions, quote/reply-to message threads, `@mention` group members, and remote message deletion.
* **Live Chat Dashboard:** Embedded Web Interface for real-time customer conversations and human-in-the-loop support agent takeover.
* **Status Delivery Tracking:** Event triggers for real-time `SENT`, `DELIVERED`, `READ`, and `FAILED` receipts.

### 📢 Campaigns & Marketing Automation
* **Broadcast Campaigns:** Schedule and dispatch batch messages to segmented contact lists with automated anti-ban delay gaps.
* **Dynamic Personalization:** Inject dynamic variables (`{{name}}`, `{{company}}`, `{{custom_field}}`) into broadcast templates.
* **Audience Tagging & Segmentation:** Organize contacts into dynamic groups using tags, purchase history, or interaction recency.
* **Marketing Analytics:** Interactive conversion funnels, open rates, delivery success rates, and ROI metrics.
* **Template Management:** Create, store, and edit reusable message templates.

### 🤖 AI Agents & MCP Integration
* **Model Context Protocol (MCP) Transport:** Exposes 39+ curated tools via `POST /mcp` for AI models (Claude, Cursor, custom LLM agents).
* **Autonomous Support Bots:** AI agents can query session status, search contacts, read incoming messages, send automated answers, and trigger webhooks securely.
* **Least-Privilege Scoping:** AI keys can be restricted to read-only (`MCP_READONLY=true`) or scoped to specific WhatsApp sessions.

### ⚡ Webhooks & Integrations
* **Real-time Webhook Events:** Instant HTTP notifications with HMAC SHA-256 signature verification.
* **Smart Pre-Dispatch Filters:** Evaluate AND/OR logical conditions (sender, keywords, message type, media status) *before* sending payloads to reduce server overhead.
* **n8n & Workflow Builders:** Native integration nodes for n8n, Zapier, Make, and community IoT adapters (e.g. ioBroker).

### 🔒 Security & Operations
* **API Key Management:** Scoped access keys with expiration dates, IP CIDR whitelisting, and role permissions.
* **Multi-User RBAC:** Role hierarchy (`ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) for team collaboration.
* **Hardened Docker Security:** Non-root execution via `gosu openwa` and container socket protection via a dedicated `docker-socket-proxy` sidecar.
* **Container Monitoring Dashboard:** Built-in dashboard views for real-time container CPU/Memory usage, container lifecycle, and live streaming Docker logs.

---

## 🎯 4. SOLUTIONS (Use Cases & Industry Applications)

### 🛍️ Solution 1: E-Commerce & Retail Marketing
* **Use Case:** Automated abandoned cart recovery, flash sale broadcast campaigns, order tracking updates, and delivery notifications on WhatsApp.
* **Benefit:** Boost conversion rates up to 45% compared to email marketing, with zero message charges.

### 🎧 Solution 2: AI-Powered Customer Support
* **Use Case:** Connect Claude or custom LLMs via MCP to handle 24/7 customer FAQs, troubleshoot issues, and collect lead info automatically.
* **Benefit:** Seamless human agent handoff via the built-in Live Chat Dashboard when complex inquiries arise.

### 🏢 Solution 3: Multi-Brand & Agency Management
* **Use Case:** Agencies managing WhatsApp communication for multiple client brands or distinct regional phone numbers.
* **Benefit:** Multi-session isolation allows managing 10, 50, or 100+ WhatsApp numbers on a single unified OpenWA cluster with granular API keys per client.

### ⚡ Solution 4: Workflow & Systems Automation
* **Use Case:** Trigger WhatsApp alerts when CRM deals update, server monitors trip, web forms submit, or payment gateways succeed.
* **Benefit:** Instant n8n and Webhook integration with smart filtering ensures high signal-to-noise notification delivery.

### 💻 Solution 5: Developer API Gateway
* **Use Case:** Software teams looking to add WhatsApp capabilities to their web apps, mobile apps, or internal tools.
* **Benefit:** Standardized OpenAPI 3.0 (Swagger) endpoints, clear SDKs, predictable NestJS codebase, and zero third-party API dependencies.

---

## ❓ 5. FAQ (Frequently Asked Questions)

#### Q1: Is OpenWA completely free and open-source?
**A:** Yes! OpenWA is licensed under the permissive MIT License. You can use it for personal projects or commercial applications without paying license fees or per-message charges.

#### Q2: Do I need Meta Facebook Business Verification or Cloud API access?
**A:** No. OpenWA links directly to your existing WhatsApp numbers (personal or business) via a standard QR code scan. There is no waiting period, registration requirement, or Facebook approval process.

#### Q3: Can I run multiple WhatsApp accounts on a single server?
**A:** Absolutely. OpenWA is built from the ground up to be multi-session. You can run and monitor multiple distinct phone numbers concurrently.

#### Q4: How does OpenWA protect against WhatsApp number bans?
**A:** OpenWA includes built-in rate limiters, randomized delay intervals (e.g. 5-15s between messages), batch dispatching, and queue management powered by BullMQ to emulate natural human sending patterns.

#### Q5: How do AI models like Claude connect to WhatsApp through OpenWA?
**A:** OpenWA includes a native Model Context Protocol (MCP) server at `POST /mcp`. AI agents connect securely using an API key and gain access to 39+ tools to read, reply to, and orchestrate WhatsApp interactions.

#### Q6: Can I deploy OpenWA with PostgreSQL and Redis in production?
**A:** Yes. While OpenWA runs out-of-the-box with embedded SQLite and local storage for zero-config dev, you can enable PostgreSQL, Redis, and S3/MinIO in production using Docker Compose profiles (`docker compose --profile full up -d`).

---

## 📞 6. CONTACT (Support, Community & Links)

### Open Source Community & Docs
* **GitHub Repository:** [https://github.com/rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)
* **Interactive API Docs (Swagger):** `http://localhost:2785/api/docs`
* **Bug Reports & Issues:** [GitHub Issues Tracker](https://github.com/rmyndharis/OpenWA/issues)
* **Feature Requests:** [GitHub Discussions](https://github.com/rmyndharis/OpenWA/discussions)

### Quick Docker Setup Command
```bash
# Clone and spin up immediately
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d
```

### Commercial Support & Deployment Inquiries
Need custom feature development, enterprise SLA support, or assistance with high-throughput multi-node cluster deployment?

* **Project Lead & Maintainer:** Yudhi Armyndharis
* **License:** MIT License (Free & Commercial Ready)
* **Contact Form Blueprint:** Name | Email | Company | Messaging Volume | Request Details

---
*OpenWA — Free, Self-Hosted WhatsApp API Gateway & Automation Engine.*
