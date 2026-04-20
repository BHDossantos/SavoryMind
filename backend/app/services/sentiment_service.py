from textblob import TextBlob


def analyze_sentiment(text: str) -> tuple[float, str]:
    blob = TextBlob(text)
    score = blob.sentiment.polarity  # -1.0 to 1.0

    if score > 0.1:
        label = "positive"
    elif score < -0.1:
        label = "negative"
    else:
        label = "neutral"

    return round(score, 3), label
