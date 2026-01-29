# Skript - LMF Theater Tools

Digital script viewer for theater productions, built with Next.js 15 and TypeScript.

## Features

- Real-time script synchronization with director mode
- PWA support for offline access
- Multiple viewing modes (main, stage, actor)
- Category filtering (actors, instructions, technical, etc.)
- Dark/Light/Pink themes
- Mobile-responsive design

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

```bash
npm run build
npm run start
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

### Docker

```bash
docker build -t skript .
docker run -p 3000:3000 skript
```

## Project Structure

```
├── app/                  # Next.js App Router pages
│   ├── api/             # API routes
│   ├── actor/           # Actor view page
│   ├── stage/           # Stage view page
│   └── page.tsx         # Main script viewer
├── components/
│   ├── branding/        # LMF logo, footer, theme
│   ├── layout/          # NavBar, Sidebar, BottomNav
│   ├── script/          # Script viewer components
│   └── ui/              # Reusable UI components
├── lib/                 # Utilities, API, Socket.IO
├── stores/              # Zustand state management
├── types/               # TypeScript definitions
└── public/              # Static assets
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **State**: Zustand
- **Real-time**: Socket.IO
- **Testing**: Vitest + Playwright

## Branding

This app is part of the LMF (Logge Media Foundation) Theater Tools suite.

Primary color: `#FF6A00` (Orange)
Logo color: `#d90429` (Red)

## License

Private - Kolpingtheater Ramsen
