# backend/routers/prediction.py

from fastapi import APIRouter, HTTPException
from backend.services.prediction_service import get_predictor
from backend.services.ensemble_service import get_ensemble_predictor
from backend.schemas.stock_schemas import PredictionRequest, PredictionResponse


router = APIRouter(prefix="/api/predict", tags=["prediction"])


@router.post("/", response_model=PredictionResponse)
async def predict_stock_price(request: PredictionRequest):
    """Predict future stock prices"""
    try:
        predictor = get_predictor()
        result = predictor.predict(request.symbol, request.days_ahead)

        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Insufficient data for {request.symbol}"
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def model_health():
    """Check if LSTM model is loaded"""
    try:
        predictor = get_predictor()
        return {
            "status": "healthy",
            "device": str(predictor.device),
            "model_loaded": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.post("/xgb")
async def predict_xgb_signal(request: PredictionRequest):
    """XGBoost + LightGBM ensemble signal — UP / SIDEWAYS / DOWN"""
    try:
        predictor = get_ensemble_predictor()
        result    = predictor.predict(request.symbol)
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for {request.symbol}"
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/xgb/health")
async def xgb_health():
    """Check if ensemble models are loaded"""
    try:
        predictor = get_ensemble_predictor()
        return {
            "status": "healthy",
            "models": ["XGBoost", "LightGBM"]
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }