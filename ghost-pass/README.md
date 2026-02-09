# GhostPass Wallet UI

A tactical, dark-themed React frontend for the GhostPass venue access system. Built with the "Abyssal Glass" design language featuring neon accents, glass morphism, and terminal-inspired aesthetics.

## 🎨 Design System

### Abyssal Glass Theme
- **Primary Background**: `#020617` (Abyss 950)
- **Glass Cards**: Translucent overlays with backdrop blur
- **Neon Accents**: Cyan (`#00ffff`), Green (`#00ff41`), Red (`#ff073a`)
- **Typography**: Inter (headers), JetBrains Mono (data/terminal)

## 🚀 Features

### Core Screens
- **Wallet Dashboard**: Balance display, Ghost Pass status, purchase options
- **QR Code View**: Secure pass display with real-time validation
- **Trust Center**: Multi-source wallet funding (Zelle, Venmo, Stripe)
- **Transaction History**: Complete ledger with CSV export

### Key Behaviors
- **Real-time Updates**: 30-second polling for pass status and balance
- **Security**: Expired passes are blurred, auth token management
- **Mobile-First**: Bottom tab navigation, responsive design
- **Animations**: Framer Motion for smooth transitions and feedback

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom Abyssal Glass theme
- **State**: TanStack Query for server state, React Context for auth
- **Animation**: Framer Motion
- **Auth**: Backend API (FastAPI + Supabase)
- **HTTP**: Axios with interceptors
- **QR Codes**: react-qr-code

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables
# Edit .env with your Supabase and API credentials
```

### Environment Variables

```env
# API Configuration  
VITE_API_URL=http://localhost:8000
```

## 🏃‍♂️ Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗 Project Structure

```
src/
├── components/           # React components
│   ├── AuthProvider.tsx     # Supabase auth context
│   ├── Layout.tsx           # Main layout with bottom nav
│   ├── LoginScreen.tsx      # Authentication UI
│   ├── WalletDashboard.tsx  # Main wallet view
│   ├── QRCodeView.tsx       # Pass display screen
│   ├── TrustCenter.tsx      # Funding interface
│   └── TransactionHistory.tsx # Transaction ledger
├── lib/                  # Utilities and configuration
│   └── api.ts              # API client with auth
├── types/               # TypeScript definitions
│   └── index.ts            # Core type definitions
├── App.tsx              # Main app component
├── main.tsx             # App entry point
└── index.css            # Tailwind + custom styles
```

## 🎯 API Integration

The frontend integrates with a FastAPI backend through these endpoints:

### Wallet API
- `GET /wallet/balance` - Current balance
- `POST /wallet/fund` - Add funds
- `GET /wallet/transactions` - Transaction history
- `GET /wallet/transactions/download` - CSV export

### GhostPass API  
- `GET /ghostpass/status` - Current pass status
- `POST /ghostpass/purchase` - Buy new pass
- `GET /funding/sources` - Available funding methods

### Authentication
- Uses backend API for authentication (FastAPI + Supabase)
- JWT token management with automatic refresh
- Secure API request interceptors

## 🔒 Security Features

- **Token Management**: Automatic JWT handling with Supabase
- **Pass Validation**: Real-time expiration checking
- **QR Security**: Codes blur when expired, unique per session
- **Input Validation**: Client-side validation with server verification

## 📱 Mobile-First Design

- **Bottom Navigation**: Thumb-friendly tab bar
- **Touch Targets**: Minimum 44px touch areas
- **Responsive**: Adapts from mobile to desktop
- **Performance**: Optimized animations and lazy loading

## 🎨 Custom Components

### Glass Cards
```tsx
<div className="glass-card">
  <!-- Translucent card with backdrop blur -->
</div>
```

### Neon Text
```tsx
<span className="neon-text">
  <!-- Glowing cyan text with shadow -->
</span>
```

### Terminal Input
```tsx
<input className="terminal-input" />
<!-- Styled like a terminal interface -->
```

## 🚨 Critical Behaviors

1. **No Client Math**: All pricing/fees calculated server-side
2. **Real-time Balance**: Updates immediately after funding
3. **Expiration Warnings**: Screen pulses red when < 1 hour remaining
4. **Offline Handling**: Graceful degradation when API unavailable

## 🔧 Customization

### Theme Colors
Edit `tailwind.config.js` to modify the Abyssal Glass color palette:

```js
colors: {
  abyss: { /* Dark backgrounds */ },
  neon: { /* Accent colors */ },
  glass: { /* Transparency levels */ }
}
```

### API Configuration
Update `src/lib/api.ts` to modify endpoints or add new API methods.

## 📈 Performance

- **Bundle Size**: Optimized with Vite tree-shaking
- **Caching**: TanStack Query with 30s stale time
- **Images**: Optimized SVG icons, no heavy assets
- **Animations**: Hardware-accelerated with Framer Motion

## 🧪 Testing

```bash
# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

## 🚀 Deployment

```bash
# Build production bundle
npm run build

# Deploy dist/ folder to your hosting platform
```

Optimized for deployment on Vercel, Netlify, or any static hosting service.

---

**GhostPass Wallet** - Secure, tactical, and beautiful venue access management.