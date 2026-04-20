from pydantic import BaseModel
from datetime import datetime


class ReviewBase(BaseModel):
    customer_name: str
    menu_item: str
    rating: int
    comment: str


class ReviewCreate(ReviewBase):
    pass


class ReviewResponse(ReviewBase):
    id: int
    sentiment_score: float
    sentiment_label: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SentimentSummary(BaseModel):
    total_reviews: int
    avg_sentiment: float
    positive_count: int
    neutral_count: int
    negative_count: int
    avg_rating: float
