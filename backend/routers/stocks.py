from fastapi import APIRouter, HTTPException
from backend.services.data_service import DataService
from backend.schemas.stock_schemas import StockInfo, HistoricalPrice
from typing import List

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/", response_model=List[StockInfo])
async def get_all_stocks():
    """Get list of all available stocks"""
    try:
        stocks = DataService.get_all_stocks()
        return stocks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/historical")
async def get_historical_data(symbol: str, limit: int = 90):
    """Get historical price data for a stock"""
    try:
        data = DataService.get_historical_prices(symbol, limit)
        if not data:
            raise HTTPException(status_code=404, detail="Stock not found")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/latest")
async def get_latest_price(symbol: str):
    """Get latest price for a stock"""
    try:
        data = DataService.get_latest_price(symbol)
        if not data:
            raise HTTPException(status_code=404, detail="Stock not found")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
