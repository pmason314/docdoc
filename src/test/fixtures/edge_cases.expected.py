# Generate test: basic edge cases without docstrings

from functools import wraps
from typing import Union


@wraps
@property
def decorated_simple(func):
    """_summary_.

    Args:
        func: _description_

    Returns:
        _description_
    """
    return func


@wraps(str)
@property(lambda x: x)
def decorated_with_args(x: int, y: str) -> bool:
    """_summary_.

    Args:
        x (int): _description_
        y (str): _description_

    Returns:
        bool: _description_
    """
    return True


def multiline_signature(
    a: int,
    b: str,
    c: Union[dict, list],
    *,
    d: bool = True,
) -> None:
    """_summary_.

    Args:
        a (int): _description_
        b (str): _description_
        c (Union[dict, list]): _description_
        d (bool): _description_. Defaults to True.

    Returns:
        None
    """
    pass


class ComplexClass(
    BaseClass,
    Mixin1,
    Mixin2,
):
    """_summary_."""
    pass


def nested_generics(x: dict[str, list[int]] = None) -> tuple[int, str]:
    """_summary_.

    Args:
        x (dict[str, list[int]]): _description_. Defaults to None.

    Returns:
        tuple[int, str]: _description_
    """
    return (1, "a")


def with_custom_docstring_sections(value: str) -> dict:
    """_summary_.

    Args:
        value (str): _description_

    Returns:
        dict: _description_
    """
    return {"result": f"{value}_processed"}
