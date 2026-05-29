import sys
import os

# Add the scripts directory to sys.path
sys.path.append(r'D:\lingjing\lingjing\scripts')

try:
    import deploy_v1601
    print("Successfully imported deploy_v1601")
    deploy_v1601.deploy()
except Exception as e:
    print(f"Error during deployment execution: {e}")
    sys.exit(1)
