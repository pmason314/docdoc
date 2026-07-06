# Various Python objects without docstrings for testing autodocstring extension

from dataclasses import dataclass
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable


def func_no_params():
    """_summary_.

    Returns:
        _description_
    """
    return 42


def func_with_params(a, b=2, *args, **kwargs) -> int:
    """_summary_.

    Args:
        a: _description_
        b: _description_. Defaults to 2.
        *args: _description_
        **kwargs: _description_

    Returns:
        int: _description_

    Raises:
        ValueError: _description_
    """
    if kwargs.get("error"):
        raise ValueError("bad")
    return a + b


def func_with_annotations(x: int, y: str) -> str:
    """_summary_.

    Args:
        x (int): _description_
        y (str): _description_

    Returns:
        str: _description_
    """
    return f"{x}-{y}"


async def async_func(x):
    """_summary_.

    Args:
        x: _description_

    Returns:
        _description_
    """
    return x


def generator_func(n):
    """_summary_.

    Args:
        n: _description_

    Yields:
        _description_
    """
    for i in range(n):
        yield i


def raises_func():
    """_summary_.

    Raises:
        RuntimeError: _description_
    """
    raise RuntimeError("oops")


def kw_only(a, *, b, c=3):
    """_summary_.

    Args:
        a: _description_
        b: _description_
        c: _description_. Defaults to 3.

    Returns:
        _description_
    """
    return a + b + c


def nested_example(a):
    """_summary_.

    Args:
        a: _description_

    Returns:
        _description_
    """
    def inner(b):
        """_summary_.

        Args:
            b: _description_

        Returns:
            _description_
        """
        return a + b

    return inner


def complex_typing(x: int | None) -> str | None:
    """_summary_.

    Args:
        x (int | None): _description_

    Returns:
        str | None: _description_
    """
    if x is None:
        return None
    return str(x)


def returns_tuple() -> tuple[int, str]:
    """_summary_.

    Returns:
        tuple[int, str]: _description_
    """
    return (1, "a")


class SimpleClass:
    """_summary_."""
    def __init__(self, x, y=1):
        """_summary_.

        Args:
            x: _description_
            y: _description_. Defaults to 1.
        """
        self.x = x
        self.y = y

    def method(self, z):
        """_summary_.

        Args:
            z: _description_

        Returns:
            _description_
        """
        return self.x + z


class ClassWithClassMethod:
    """_summary_."""
    @classmethod
    def cm(cls, v):
        """_summary_.

        Args:
            v: _description_

        Returns:
            _description_
        """
        return v

    @staticmethod
    def sm(v):
        """_summary_.

        Args:
            v: _description_

        Returns:
            _description_
        """
        return v * 2


class WithProperty:
    """_summary_."""
    def __init__(self, val):
        """_summary_.

        Args:
            val: _description_
        """
        self._v = val

    @property
    def value(self):
        """_summary_.

        Returns:
            _description_
        """
        return self._v

    @value.setter
    def value(self, v):
        """_summary_.

        Args:
            v: _description_
        """
        self._v = v


class ContextManager:
    """_summary_."""
    def __enter__(self):
        """_summary_.

        Returns:
            _description_
        """
        return self

    def __exit__(self, exc_type, exc, tb):
        """_summary_.

        Args:
            exc_type: _description_
            exc: _description_
            tb: _description_

        Returns:
            _description_
        """
        return False


@dataclass
class DC:
    """_summary_."""
    x: int
    y: str = ""

    def method(self):
        """_summary_.

        Returns:
            _description_
        """
        return self.x


def decorator(func: Callable):
    """_summary_.

    Args:
        func (Callable): _description_

    Returns:
        _description_
    """
    def wrapper(*args, **kwargs):
        """_summary_.

        Args:
            *args: _description_
            **kwargs: _description_

        Returns:
            _description_
        """
        return func(*args, **kwargs)

    return wrapper


@decorator
def decorated(a, b):
    """_summary_.

    Args:
        a: _description_
        b: _description_

    Returns:
        _description_
    """
    return a + b


def try_except_reraise():
    """_summary_."""
    try:
        1 / 0
    except ZeroDivisionError:
        raise


# Fully-typed function for testing
def fully_typed(a: int, b: str, c: list[int]) -> dict[str, int | None]:
    """_summary_.

    Args:
        a (int): _description_
        b (str): _description_
        c (list[int]): _description_

    Returns:
        dict[str, int | None]: _description_
    """
    total: int = a + sum(c)
    if total == 0:
        return {b: None}
    return {b: total}


# Generic identity function
T = TypeVar("T")


def identity(x: T) -> T:
    """_summary_.

    Args:
        x (T): _description_

    Returns:
        T: _description_
    """
    return x


def sum_all(*numbers: float) -> float:
    """_summary_.

    Args:
        *numbers (float): _description_

    Returns:
        float: _description_
    """
    return sum(numbers)


def join_strings(separator: str, *parts: str) -> str:
    """_summary_.

    Args:
        separator (str): _description_
        *parts (str): _description_

    Returns:
        str: _description_
    """
    return separator.join(parts)


def log_message(level: str, **entries: str) -> dict[str, str]:
    """_summary_.

    Args:
        level (str): _description_
        **entries (str): _description_

    Returns:
        dict[str, str]: _description_
    """
    return {level: entries}
