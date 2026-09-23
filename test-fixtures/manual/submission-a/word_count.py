"""Synthetic fixture A for manual MOSS testing. Do not use as production code."""

from collections import Counter


def normalize_words(text):
    cleaned = []
    for raw_word in text.lower().split():
        word = raw_word.strip(".,!?;:\"'()[]{}")
        if word:
            cleaned.append(word)
    return cleaned


def count_words(text):
    """Count normalized words and return the most common words first."""
    counts = Counter(normalize_words(text))
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


if __name__ == "__main__":
    sample = "Integrity matters. Integrity makes inspection useful."
    print(count_words(sample))
