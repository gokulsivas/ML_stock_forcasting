from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import stocks, prediction
from backend.routers import auth, watchlist_user       # ← NEW


app = FastAPI(
    title="Stock Price Prediction API",
    description="Deep Learning based NSE stock price forecasting using PyTorch LSTM-GRU",
    version="2.0.0"
)


# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(stocks.router)
app.include_router(prediction.router)
app.include_router(auth.router)              # ← NEW
app.include_router(watchlist_user.router)    # ← NEW


@app.get("/")
async def root():
    return {
        "message": "Stock Price Prediction API",
        "docs": "/docs",
        "health": "/api/predict/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)