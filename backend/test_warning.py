#!/usr/bin/env python3
"""Test if warning is suppressed"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.main import app

print("✅ App imported successfully!")
print(f"📋 App title: {app.title}")
print("🎉 No warnings should appear above!")
