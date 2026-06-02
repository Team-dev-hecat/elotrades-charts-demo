# EloTrades — Professional Trading Analytics Platform

> A full-stack SaaS platform for serious traders — built with Next.js, TradingView Lightweight Charts, and real market data.

🌐 **Live**: [elotrades.com](https://elotrades.com)

---

## Overview

EloTrades is a professional trading journal and backtesting platform designed for independent traders and prop firm candidates. It combines real-time chart replay, AI-powered market analysis, and detailed performance tracking in a single interface.

---

## Features

### 📊 Backtest & Replay Engine
- Candle-by-candle replay on 29 instruments (Forex, Indices, Metals, Crypto)
- Multi-timeframe display (M1 → Weekly) with real Dukascopy tick data
- Dual-chart layout for confluence analysis
- Virtual order placement with SL/TP price lines
- Automatic Win/Loss detection, R:R calculation, P&L tracking
- Screenshot capture per timeframe for trade documentation

### 📓 Trading Journal
- Full trade history with entry, SL, TP, result, R:R, notes, tags
- Screenshot attachments (HTF/ITF/LTF analysis)
- Advanced filtering and sorting
- Performance stats: win rate, avg R:R, total P&L

### 📅 Economic Calendar
- Forex Factory data with AI-generated pre/post announcement analysis
- High/Medium/Low impact filtering
- Automatic daily refresh via cron jobs

### 📈 Dashboard Analytics
- Session performance overview
- Equity curve, win rate, drawdown metrics

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Charts | **TradingView Lightweight Charts v5** |
| Backend | Next.js API Routes |
| Database | Back4App (Parse Server) |
| Auth | NextAuth.js v5 (Google OAuth) |
| Payments | Stripe (subscriptions + webhooks) |
| Storage | Vercel Blob |
| Deployment | Vercel |
| Market Data | Dukascopy (via dukascopy-node) |

---

## TradingView Lightweight Charts Usage

The charting engine is built entirely on **TradingView Lightweight Charts**:

- Candlestick series with custom up/down colors
- Dynamic price lines for Entry, SL, TP levels
- Crosshair with price/time labels
- Real-time candle updates during replay
- Dual synchronized charts for multi-instrument analysis
- ResizeObserver for responsive layout
- Custom aggregation engine (M1 data → any timeframe)

---

## Live Demo

🌐 [elotrades.com](https://elotrades.com)

> Full platform available — subscription required for complete access.
