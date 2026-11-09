import os
import sys
from pathlib import Path

# Make `import app` work when pytest is run from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Never let a test touch the developer's real briefing database.
os.environ.setdefault("NEWSFORME_DB", ":memory:")
