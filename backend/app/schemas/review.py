from pydantic import BaseModel, Field
from datetime import datetime


class ReviewBase(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100)
    menu_item: str = Field(min_length=1, max_length=100)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=2000)


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
