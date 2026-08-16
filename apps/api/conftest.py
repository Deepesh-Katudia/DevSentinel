"""Root conftest: CLI options only.

pytest_addoption is honoured only in an *initial* conftest — one pytest loads
before it parses the command line, which means the rootdir's. Registering
--eval-update-baseline down in tests/evals/conftest.py instead makes pytest
reject the flag as an unrecognized argument, because that conftest is not
imported until collection has already started.
"""


def pytest_addoption(parser):
    parser.addoption(
        "--eval-update-baseline",
        action="store_true",
        default=False,
        help="Overwrite tests/evals/baseline.json with this run's metrics.",
    )
