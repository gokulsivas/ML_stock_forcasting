from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import stocks, prediction

app = FastAPI(
    title="Stock Price Prediction API",
    description="Deep Learning based NSE stock price forecasting using PyTorch LSTM-GRU",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],  # Use 3001 for React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stocks.router)
app.include_router(prediction.router)


@app.get("/")
async def root():
    return {
        "message": "Stock Price Prediction API",
        "docs": "/docs",
        "health": "/api/predict/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)  # Changed to 8001

