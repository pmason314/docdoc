# Update test: docstrings with custom sections (Notes, Examples, etc.)

def documented_with_notes(a: int, b: str, c: bool) -> dict:
    """Main function.

    Args:
        a (int): First param
        b (str): _description_
        c (bool): _description_

    Returns:
        dict: Result dict

    Note:
        This is an important note about the function.
        It should be preserved during updates.

    Examples:
        >>> documented_with_notes(1, "test", True)
        {'key': 'value'}

    See Also:
        helper_function: A related function.

    References:
        - RFC 1234
    """
    return {"key": "value"}


def preserves_multiline_description(x: int) -> str:
    """Convert number to string.

    Args:
        x (int): The number to convert. This is a longer description
            that spans multiple lines and should be preserved
            when updating.

    Returns:
        str: The string representation

    Warning:
        Be careful with large numbers as they may cause
        overflow in older systems.
    """
    return str(x)
