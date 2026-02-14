from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional


class StockInfo(BaseModel):
    symbol: str
    ysymbol: str


class HistoricalPrice(BaseModel):
    trade_date: date
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int


class PredictionRequest(BaseModel):
    symbol: str
    days_ahead: int = Field(default=5, ge=1, le=365)


class PredictionResponse(BaseModel):
    symbol: str
    current_price: float
    current_date: str
    predictions: List[dict]
