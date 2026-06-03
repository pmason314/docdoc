# Update test: edge cases with existing docstrings

from functools import wraps
from typing import Union


@wraps
@property
def decorated_simple(func):
    """_summary_.

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
        None: _description_
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


def with_custom_docstring_sections(value: str):
    """Process and analyse the value.

    Args:
        value (str): The input value to process.

    Returns:
        dict: The processed result.

    Note:
        This function has special behavior depending on the input.
        Always ensure inputs are validated before use.

    Examples:
        >>> with_custom_docstring_sections("test")
        {'result': 'test_processed'}
        >>> with_custom_docstring_sections("other")
        {'result': 'other_processed'}

    See Also:
        other_processor: Another related function.
        validate_input: Input validation helper.

    References:
        - https://example.com/docs
        - Algorithm based on paper XYZ
    """
    return {"result": f"{value}_processed"}
