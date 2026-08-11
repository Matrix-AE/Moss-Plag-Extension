"""Synthetic fixture B for manual MOSS testing. Do not use as production code."""

from collections import Counter


def normalize_words(text):
    cleaned = []
    for raw_word in text.lower().split():
        word = raw_word.strip(".,!?;:\"'()[]{}")
        if word:
            cleaned.append(word)
    return cleaned


def count_words(text):
    """Count normalized words, then return an alphabetically stable result."""
    counts = Counter(normalize_words(text))
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


def unique_words(text):
    """Return the unique normalized vocabulary for this document."""
    return sorted(set(normalize_words(text)))


if __name__ == "__main__":
    sample = "Integrity improves inspection confidence."
    print(count_words(sample))
