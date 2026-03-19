<div align="center">
  <h1>🚀 NasDash</h1>
  <p><strong>The Information-Dense, Glance-Inspired Personal Server Dashboard</strong></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

  <br />
</div>

NasDash is a high-performance, unapologetically information-dense web dashboard designed for homelab enthusiasts and sysadmins. Inspired by the renowned *Glances* UI, NasDash brings all your services, server hardware statistics, and VPN networks into a single, beautiful command-center layout.

## ✨ Features

- **📊 Hardware Telemetry**: Track real-time CPU, RAM, Disk, and GPU statistics across multiple remote machines simultaneously using zero-configuration auto-fetching.
  - Supports **Glances**, **Home Assistant**, and **Proxmox VE** (Nodes, QEMU VMs, LXC Containers).
- **🚦 Dynamic Service Grid**: Organize your homelab web services into drag-and-drop slots. Each service tracks its own local network URL and Tailscale VPN URL.
- **🔒 Stealth Secret Mode**: Features an invisible toggle switch hidden in the UI to instantly reveal heavily-guarded, confidential application categories (e.g., NSFW or sensitive data).
- **🌐 Native Tailscale Map**: See exactly who and what is connected to your private VPN mesh network in real-time right from the right sidebar.
- **🎨 Dark/Light Cyberpunk UI**: A handcrafted, dependency-free CSS design system offering both a deep-space dark mode and a crisp, clean light mode.
- **⚡ Zero-Latency Editing**: Add categories, upload custom app logos, and inject new server nodes straight through the browser UI—modifications instantly sync to disk without rebooting.

---

## 🛠️ Tech Stack

| Category         | Technologies Used                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| **Frontend Core**| Next.js 14+ (App Router), React 18, TypeScript                                    |
| **Styling**      | Custom Vanilla CSS (Design System `nd-*`), Lucide React (Icons)                   |
| **State & Data** | SWR (Data Fetching), Dynamic local memory caching, `dnd-kit` (Drag & Drop)        |
| **Backend API**  | Next.js Route Handlers (REST Proxies, Glances payloads, Tailscale execution)      |
| **Deployment**   | Docker (Multi-stage standalone build)                                             |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and [npm](https://www.npmjs.com/) installed on your machine.
If deploying via containers, ensure [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) are available.

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lucas-lepajollec/NasDash.git
   cd NasDash
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   *The application will be running at `http://localhost:2499`.*

---

## 🐳 Docker Deployment

The project includes a strongly-optimized, multi-stage Docker build producing a lightweight Next.js standalone container.

**1. Create a `docker-compose.yml` file:**

```yaml
services:
  nasdash:
    image: ghcr.io/lucas-lepajollec/nasdash:latest
    container_name: nasdash
    ports:
      - "2504:2504"
    volumes:
      - ./data:/app/data  # Persistent JSON configuration + user custom logos
    pid: "host"           # Required for reading exact host processes if deploying on root
    restart: unless-stopped
```

**2. Start the container:**

```bash
docker compose up -d
```

The application will be available at **http://localhost:2504**.

---

## 📂 Project Structure

```text
NasDash/
├── data/                   # Persistent config (config.json) & User uploaded logos
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router (Pages, API Routes, Layouts)
│   ├── components/         # Pure React UI building blocks (Modals, Sidebars, Cards)
│   ├── hooks/              # Custom React Hooks (SWR Fetchers, Config state sync)
│   ├── lib/                # TypeScript Interfaces, utilities, server-side config parsers
│   └── globals.css         # The core styling matrix
├── .env                    # Global system variables (e.g. NEXT_PUBLIC_DASHBOARD_TITLE)
├── Dockerfile              # Multi-stage production standalone build
└── docker-compose.yml      # Suggested Docker Compose layout
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🔒 Proxmox API Guide

If you wish to monitor a Proxmox server or its virtual machines through NasDash, you need to generate an API Token:

1. Log in to your **Proxmox Web UI**.
2. Go to **Datacenter** > **Permissions** > **API Tokens**.
3. Click **Add** and select your user (usually `root@pam`). Give your token an ID (ex: `nasdash`).
4. ⚠️ **Uncheck "Privilege Separation"** (or apply the *PVEAuditor* role to your token ID).
5. Click Add. Proxmox will yield a **Token ID** (e.g., `root@pam!nasdash`) and a **Secret** UUID.
6. Enter these exactly as shown directly into the NasDash web UI (when clicking the edit pencil on a device slot). NasDash automatically bypasses self-signed TLS certificates for local IPs.

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ using Next.js & React

</div>
