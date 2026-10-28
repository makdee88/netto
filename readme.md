# Netto 🛡️💰

**Privacy-First, Zero-Knowledge Encrypted Personal Wealth Tracker & Investment Portfolio Manager**

Netto is a local-first, privacy-focused financial dashboard that runs entirely in your browser using WebAssembly SQLite (`sql.js`). Your financial data never touches an external server. It features military-grade client-side **AES-256-GCM encryption**, incremental CSV ledger syncing for international brokers (Avanza, Nordnet, Zerodha, Upstox, Interactive Brokers), multi-currency consolidation, and a historical portfolio growth time-machine.

---

## 🚀 Key Features

* **Client-Side Zero-Knowledge Encryption:** Your entire database is encrypted in your browser using Web Crypto AES-256-GCM. Your decryption passphrase never leaves your device.
* **In-Browser SQLite (`sql.js`):** Runs a full relational SQL database locally in memory, allowing robust transaction ledgers, holdings calculations, and asset aggregation without a backend server.
* **Smart Incremental CSV Importer:** Supports multi-broker statement imports (Avanza, Nordnet, Zerodha, Upstox, IBKR) with deterministic transaction hashing (`tx_hash`) to safely append new trades and prevent duplicates on re-upload.
* **Portfolio Growth Time Machine:** Reconstructs your complete historical investment trajectory from your earliest transaction up to today, complete with interactive buy/sell transaction markers and monthly/yearly frequency toggles.
* **Global Privacy Mode Toggle:** Instantly mask all sensitive financial figures, totals, and percentages behind asterisks (`••••••`) with a single click in the header to protect your screen from shoulder surfers.
* **Multi-Currency & Asset Class Support:** Consolidates Equities, Mutual Funds, Fixed Deposits with compound interest, Real Estate properties, and Liabilities/Mortgages across SEK, INR, USD, and EUR.
* **Optional Cloud Sync:** Securely back up and synchronize your encrypted vault blob directly to your own personal Google Drive app data folder (`drive.appdata`).

---

## 🔒 Security Architecture

1. **Zero Telemetry:** Netto has no backend database or analytics tracking. User login through supabase is required for session management.
2. **Local Storage:** The encrypted SQLite binary blob (`.sqlite.enc`) is stored locally in your browser's `localStorage`.
3. **Bring-Your-Own-Passphrase:** Decryption requires your secret passphrase. If lost, data cannot be recovered by anyone, ensuring complete sovereignty over your financial records.

---

## 🛠️ Getting Started & Local Setup

### Prerequisites
* Node.js (v18+ recommended)
* npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/netto.git

# Navigate into project directory
cd netto

# Install dependencies
npm install

# Start the local development server
npm run dev
```

Open `http://localhost:5173` in your browser to create your encrypted vault.

---

## 📄 License & Source-Available Protection

Netto is licensed under the **Business Source License (BSL 1.1)**. 

### Why BSL 1.1?
We believe in radical transparency and auditability. Making the repository public allows any user, security researcher, or developer to inspect the source code, verify zero-knowledge encryption claims, and audit the cryptographic implementation. However, to protect the project from being commercialized or repackaged into competing proprietary financial SaaS products, commercial use and hosted service offerings are restricted.

### Summary of Terms
* **Personal & Educational Use:** You are free to view, fork, audit, and run Netto for your personal wealth tracking.
* **Restrictions:** You may not use Netto to provide commercial wealth management services or host it as a competing SaaS product.
* **Change License:** This code will automatically convert to the permissive **MIT License** on **January 1, 2031**.

See the full [LICENSE](LICENSE) file for legal details.