# conftest.py — 确保项目根目录在 Python path 中
# 测试用 `from server.app.services...` 绝对导入，需要项目根在 path
import sys
from pathlib import Path

# 项目根: tests/ → server/ → lingjingapp/
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
