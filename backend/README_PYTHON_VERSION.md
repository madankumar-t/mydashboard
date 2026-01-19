# Python Version Compatibility

## Current Version: Python 3.12

This project is configured to use **Python 3.12** (latest stable version supported by AWS Lambda) and is forward-compatible with Python 3.14+.

## Why Python 3.12?

- **AWS Lambda Support**: Python 3.12 is the latest stable version supported by AWS Lambda
- **Performance**: Improved performance over 3.11
- **Type Hints**: Better type hint support
- **Future-Proof**: Code is written to be compatible with Python 3.14+

## Forward Compatibility Features

### 1. Deferred Evaluation of Annotations (PEP 563)

All modules use `from __future__ import annotations` to enable deferred evaluation of type annotations. This makes the code compatible with Python 3.14's default behavior.

```python
from __future__ import annotations  # PEP 563

def example(param: str) -> Dict[str, Any]:
    ...
```

### 2. Modern Type Hints

The code uses modern type hint syntax that works across Python 3.12-3.14:

- `Dict[str, Any]` instead of `dict`
- `List[str]` instead of `list` (for older compatibility)
- `Optional[T]` for nullable types

### 3. No Deprecated Features

The code avoids:
- ❌ `async`/`await` without proper context (not needed here)
- ❌ Old-style string formatting (`%` operator)
- ❌ `print` statements (uses function form)
- ❌ Old-style exception handling

### 4. Compatible Dependencies

All dependencies are pinned to versions that support Python 3.12+:
- `boto3>=1.34.0` - Supports Python 3.12+
- `botocore>=1.34.0` - Supports Python 3.12+

## Upgrading to Python 3.14

When AWS Lambda supports Python 3.14, you can upgrade by:

1. **Update SAM Template**:
   ```yaml
   Runtime: python3.14
   ```

2. **Update Layer Script**:
   ```bash
   PYTHON_VERSION=3.14 ./setup_layer.sh
   ```

3. **Update pyproject.toml**:
   ```toml
   requires-python = ">=3.14"
   ```

4. **Test**:
   ```bash
   sam build
   sam local invoke
   ```

## Python 3.14 Features (When Available)

When Python 3.14 is available on AWS Lambda, you can leverage:

### 1. Free-Threaded Python (GIL Removal)
- Better multi-threading performance
- Our `ThreadPoolExecutor` will benefit automatically

### 2. Template String Literals (t-strings)
- PEP 750 introduces t-strings
- Can be used for custom string processing

### 3. Improved Type Hints
- Better type inference
- Enhanced type checking

## Local Development

### Using pyenv (Recommended)

```bash
# Install Python 3.12
pyenv install 3.12.0
pyenv local 3.12.0

# Verify
python --version  # Should show 3.12.x
```

### Using Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
```

## Testing Compatibility

To test with different Python versions:

```bash
# Python 3.12
python3.12 -m pytest

# Python 3.13 (if installed)
python3.13 -m pytest

# Python 3.14 (when available)
python3.14 -m pytest
```

## CI/CD Integration

Add Python version matrix to your CI:

```yaml
strategy:
  matrix:
    python-version: ['3.12', '3.13', '3.14']
steps:
  - uses: actions/setup-python@v4
    with:
      python-version: ${{ matrix.python-version }}
```

## Notes

- **AWS Lambda**: Currently supports up to Python 3.12
- **Future Versions**: Code is ready for 3.14 when Lambda supports it
- **Backward Compatibility**: Code works with Python 3.11+ but optimized for 3.12+

## References

- [Python 3.12 Release Notes](https://docs.python.org/3.12/whatsnew/3.12.html)
- [Python 3.14 Release Notes](https://docs.python.org/3.14/whatsnew/3.14.html)
- [AWS Lambda Python Runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [PEP 563 - Postponed Evaluation of Annotations](https://peps.python.org/pep-0563/)
- [PEP 649 - Deferred Evaluation of Annotations](https://peps.python.org/pep-0649/)

