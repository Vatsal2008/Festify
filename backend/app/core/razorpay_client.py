from functools import lru_cache

import razorpay

from app.core.config import settings


@lru_cache
def get_razorpay() -> razorpay.Client:
    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    return client
