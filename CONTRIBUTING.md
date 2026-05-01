# Contributing to NasDash 📊

Welcome to the NasDash project! We'd love your help to make this the ultimate homelab dashboard.

## 🛠️ Local Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/lucas-lepajollec/nasdash.git
   cd nasdash
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up your environment**:
   Copy the example environment file.
   ```bash
   cp .env.example .env
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
   NasDash will be running at `http://localhost:2499`.

### Note on Testing Docker Features
If you are developing features related to the Docker integration, we highly recommend spinning up a local `docker-socket-proxy` container as described in the README, rather than exposing your own host's Docker socket directly to the dev environment.

## 📦 Pull Request Process

1. Create a new branch for your feature (`git checkout -b feature/amazing-feature`).
2. Commit your changes using conventional commit messages (`git commit -m 'feat: add amazing feature'`).
3. Push to the branch (`git push origin feature/amazing-feature`).
4. Open a Pull Request against the `main` branch.