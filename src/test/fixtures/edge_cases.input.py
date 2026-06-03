# Generate test: basic edge cases without docstrings

from functools import wraps
from typing import Union


@wraps
@property
def decorated_simple(func):
    return func


@wraps(str)
@property(lambda x: x)
def decorated_with_args(x: int, y: str) -> bool:
    return True


def multiline_signature(
    a: int,
    b: str,
    c: Union[dict, list],
    *,
    d: bool = True,
) -> None:
    pass


class ComplexClass(
    BaseClass,
    Mixin1,
    Mixin2,
):
    pass


def nested_generics(x: dict[str, list[int]] = None) -> tuple[int, str]:
    return (1, "a")


def with_custom_docstring_sections(value: str) -> dict:
    return {"result": f"{value}_processed"}
