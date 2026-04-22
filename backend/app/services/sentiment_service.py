from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> tuple[float, str]:
    scores = _analyzer.polarity_scores(text)
    compound = round(scores["compound"], 3)  # -1.0 to 1.0

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return compound, label
