# Functions with existing but stale docstrings for testing the update command


def added_param(a: int, b: str) -> bool:
    """Check something.

    Args:
        a (int): the number
        b (str): _description_

    Returns:
        bool: the result
    """
    return bool(a)


def removed_param(x: int) -> str:
    """Convert x.

    Args:
        x (int): the value

    Returns:
        str: the string
    """
    return str(x)


def changed_return(x: int) -> bool:
    """Check x.

    Args:
        x (int): the value

    Returns:
        bool: old return type description
    """
    return x > 0


def no_return_now(x: int) -> None:
    """Do something.

    Args:
        x (int): the value

    Returns:
        None
    """
    print(x)


def one_liner_gains_param(a: int) -> None:
    """Do the thing.

    Args:
        a (int): _description_

    Returns:
        None
    """
    print(a)


def preserves_unknown_section(x: int) -> str:
    """Process x.

    Args:
        x (int): the value

    Returns:
        str: the result

    Note:
        This is a custom section that should be preserved.
    """
    return str(x)


class MyClass:
    """A class."""

    def method(self, a: int, b: str) -> bool:
        """Do work.

        Args:
            a (int): first
            b (str): _description_

        Returns:
            bool: the result
        """
        return bool(a)
