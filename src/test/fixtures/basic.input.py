# Various Python objects without docstrings for testing autodocstring extension

from dataclasses import dataclass
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable


def func_no_params():
    return 42


def func_with_params(a, b=2, *args, **kwargs) -> int:
    if kwargs.get("error"):
        raise ValueError("bad")
    return a + b


def func_with_annotations(x: int, y: str) -> str:
    return f"{x}-{y}"


async def async_func(x):
    return x


def generator_func(n):
    for i in range(n):
        yield i


def raises_func():
    raise RuntimeError("oops")


def kw_only(a, *, b, c=3):
    return a + b + c


def nested_example(a):
    def inner(b):
        return a + b

    return inner


def complex_typing(x: int | None) -> str | None:
    if x is None:
        return None
    return str(x)


def returns_tuple() -> tuple[int, str]:
    return (1, "a")


class SimpleClass:
    def __init__(self, x, y=1):
        self.x = x
        self.y = y

    def method(self, z):
        return self.x + z


class ClassWithClassMethod:
    @classmethod
    def cm(cls, v):
        return v

    @staticmethod
    def sm(v):
        return v * 2


class WithProperty:
    def __init__(self, val):
        self._v = val

    @property
    def value(self):
        return self._v

    @value.setter
    def value(self, v):
        self._v = v


class ContextManager:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


@dataclass
class DC:
    x: int
    y: str = ""

    def method(self):
        return self.x


def decorator(func: Callable):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    return wrapper


@decorator
def decorated(a, b):
    return a + b


def try_except_reraise():
    try:
        1 / 0
    except ZeroDivisionError:
        raise


# Fully-typed function for testing
def fully_typed(a: int, b: str, c: list[int]) -> dict[str, int | None]:
    total: int = a + sum(c)
    if total == 0:
        return {b: None}
    return {b: total}


# Generic identity function
T = TypeVar("T")


def identity(x: T) -> T:
    return x


def sum_all(*numbers: float) -> float:
    return sum(numbers)


def join_strings(separator: str, *parts: str) -> str:
    return separator.join(parts)


def log_message(level: str, **entries: str) -> dict[str, str]:
    return {level: entries}
