#backend/app/core/resources.py
from __future__ import annotations

import spacy
from spacy.language import Language
import logging

logger = logging.getLogger(__name__)

class ResourceManager:
    """
    Loads and caches expensive resources like SpaCy models to avoid reloading them multiple times.

    This class acts like a singleton cache for resources. It ensures that each resource is loaded only once and reused across the application.
    """

    _spacy_models: dict[str, Language] = {}

    _custom_stopwords: dict[str, set[str]] = {}

    @classmethod
    def get_spacy_model(cls, model_name: str = "en_core_web_sm") -> Language:
        """
        Get a SpaCy model by name. If the model is not already loaded, it will be loaded and cached.
        """
        if model_name not in cls._spacy_models:
            logger.info("Loading spaCy model '%s'", model_name)
            cls._spacy_models[model_name] = spacy.load(model_name, exclude=["ner", "parser"])

        return cls._spacy_models[model_name]
    
    @classmethod
    def get_stopwords(cls, path: str):

        if path not in cls._custom_stopwords:

            words = set()

            with open(path) as f:

                for line in f:

                    line = line.strip()

                    if line:

                        words.add(line)

            cls._custom_stopwords[path] = words

        return cls._custom_stopwords[path]