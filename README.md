<div align="center">

# ML Stock Forecasting

A machine learning-powered stock forecasting platform for Indian equities (NSE),
built with a Hybrid LSTM-GRU model that predicts directional price movement
and generates actionable trading signals.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![CUDA](https://img.shields.io/badge/CUDA-76B900?style=for-the-badge&logo=nvidia&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)
![Pandas](https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white)

</div>

---
## Preview

### Home / Dashboard

<!-- PASTE SCREENSHOT OF HOME PAGE HERE -->
![Dashboard Preview](docs/screenshots/dashboard.png)

### Stock Search and Prediction

<!-- PASTE SCREENSHOT OF THE STOCK SEARCH / PREDICTION PAGE HERE -->
![Stock Search Preview](docs/screenshots/stock_search.png)

### Watchlist

<!-- PASTE SCREENSHOT OF THE WATCHLIST PAGE HERE -->
![Watchlist Preview](docs/screenshots/watchlist.png)

### Trading Signal Output

<!-- PASTE SCREENSHOT OF THE SIGNAL CARD (STRONG BUY / BUY / HOLD / SELL / STRONG SELL) HERE -->
![Signal Output Preview](docs/screenshots/signal_output.png)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Model Design](#model-design)
- [Technical Indicators](#technical-indicators)
- [Trading Signal Logic](#trading-signal-logic)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Running the Application](#running-the-application)
- [Evaluation Results](#evaluation-results)
- [Disclaimer](#disclaimer)

---

## Overview

This project builds an end-to-end stock forecasting pipeline covering data ingestion, feature engineering, model training, a REST API backend, and a React-based frontend. It covers over 2,200 NSE-listed equities sourced from Yahoo Finance and stored in a PostgreSQL database.

The core prediction task is framed as a **classification-informed regression problem**: the model predicts the next day's percentage return, and that predicted return is then mapped to a directional trading signal (Strong Buy, Buy, Hold, Sell, Strong Sell). This approach sidesteps the brittleness of direct price prediction and instead measures what actually matters for trading decisions - directional accuracy.

The model achieves a **directional accuracy of approximately 54.72%** on held-out test data, which is meaningfully above the 50% random baseline.

---

## Architecture

The system has three main layers:

1. **Data Layer** - A PostgreSQL database stores historical OHLCV data and precomputed technical indicators for all NSE stocks. An incremental updater fetches only missing rows from Yahoo Finance on each run.
2. **Backend** - A Python API (FastAPI/Flask) loads the trained model and exposes a `/predict` endpoint. A stale-data fallback uses live yfinance calls when the database is more than 2 days behind.
3. **Frontend** - A React + Vite application with light/dark theme support, a stock search page, and a watchlist feature that renders prediction cards with signal labels.

<img width="1440" height="1736" alt="image" src="https://github.com/user-attachments/assets/77c9231a-7f8a-46d8-986e-3c477b21e63c" />

---

## Model Design

The core model is a **Hybrid LSTM-GRU** architecture defined in `models/hybridlstmgru.py`.

| Parameter | Value |
|---|---|
| Input sequence length | 60 trading days |
| Hidden size | 128 |
| Number of layers | 2 |
| Dropout | 0.2 |
| Optimizer | Adam (lr = 0.001) |
| Batch size | 32 |
| Max epochs | 100 |
| Early stopping patience | 15 |
| Train / Val / Test split | 70% / 15% / 15% |

The model is trained using a **returns-based approach**. Rather than predicting raw prices (which vary wildly across stocks priced from Rs 10 to Rs 40,000), the model learns to predict the next day's percentage return. This makes the model applicable across all stocks regardless of price range. Inputs are normalized using `StandardScaler` fitted on the 60-day rolling window at inference time.

Training was performed on a selected set of NSE stocks with a minimum of 1,500 trading days of history. GPU acceleration via CUDA (RTX 3060) was used during training.

---

## Technical Indicators

The following 25+ features are computed during data ingestion and used as model inputs:

**Trend Indicators**
- SMA (5, 10, 20, 50 period)
- EMA (12, 26 period)
- MACD and MACD Signal Line
- PPO (Percentage Price Oscillator)
- TRIX, DPO, KST

**Momentum Indicators**
- RSI (14 period)
- Stochastic %K and %D
- CCI (Commodity Channel Index)
- Williams %R
- ROC (Rate of Change, 10 period)

**Volatility Indicators**
- Bollinger Bands (Upper, Middle, Lower)
- ATR (Average True Range, 14 period)

**Volume Indicators**
- OBV (On-Balance Volume)
- VWAP (approximated)
- MFI (Money Flow Index)
- CMF (Chaikin Money Flow)
- PVO (Percentage Volume Oscillator)
- ADX

---

## Trading Signal Logic

The predicted percentage return from the model is mapped to one of five trading signals on the frontend:

| Predicted Return | Signal |
|---|---|
| Greater than +5% | Strong Buy |
| +2% to +5% | Buy |
| -2% to +2% | Hold |
| -5% to -2% | Sell |
| Less than -5% | Strong Sell |

The watchlist page displays the current price, the 7-day predicted price, the expected percentage change, and the signal label for each tracked stock.

---

## Project Structure
```
ML_stock_forecasting/
│
├── config/ # Database configuration and engine setup
│ └── dbconfig.py
│
├── data/ # Data loading utilities
│ └── dataloader.py
│
├── models/ # Model architecture
│ └── hybridlstmgru.py
│
├── training/ # Training and evaluation scripts
│ ├── dataset.py
│ ├── train.py
│ ├── preprocessingreturnsbased.py
│ └── evaluatereturns.py
│
├── backend/ # API server
│ └── services/
│ └── predictionservice.py
│
├── frontend/ # React + Vite frontend
│ └── src/
│ └── components/
│ └── Watchlist.jsx
│
├── saved_models/ # Trained model weights and scalers
│ ├── returnsmodel.pth
│ └── returnsfeaturecols.pkl
│
├── experiments/ # Evaluation plots per stock
├── pricedownloads.py # Incremental stock data updater
└── README.md
```


---

## Setup and Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL
- CUDA-capable GPU (recommended; CPU fallback works)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/gokulsivas/ML_stock_forecasting.git
cd ML_stock_forecasting

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux / macOS

# Install dependencies
pip install -r requirements.txt
```

Configure your PostgreSQL connection string in `config/dbconfig.py`.

### Database Initialization

```bash
# Initial data download (run once)
python pricedownloads.py
```

For subsequent runs, the same script performs an incremental update, fetching only the rows missing since the last recorded date for each stock.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## Running the Application

```bash
# Start the backend API
python startbackend.py

# In a separate terminal, start the frontend
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000` by default.

---

## Evaluation Results

> **A note on accuracy:** Predicting the daily directional movement of individual stocks
> is one of the hardest problems in applied machine learning. Markets are noisy, and the
> Efficient Market Hypothesis argues that price movements are largely random. In peer-reviewed
> academic literature, LSTM models applied to individual stock direction prediction typically
> achieve **51% to 54% directional accuracy** - Fischer (2018), one of the most cited papers
> in quantitative finance, reported only **51.4%** on US equities over 23 years of data.
>
> A model consistently above **50% (the random baseline)** on unseen data is a meaningful
> result. This project achieves **54.72%**, which is on par with or above published academic
> benchmarks for the same task on individual equities.

| Metric | Value |
|---|---|
| Directional Accuracy | 54.72% |
| Random Baseline | 50.00% |
| Published LSTM Benchmark (Fischer 2018) | ~51.4% |
| RMSE (returns) | 0.0306 |
| MAE (returns) | 0.0216 |

---

## Disclaimer

This project is built for academic and educational purposes only. The predictions generated by this system are not financial advice. Stock markets carry inherent risk, and no model can reliably predict future prices. Do not make investment decisions based on the outputs of this application.
