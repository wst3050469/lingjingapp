import subprocess
import json
import os
import sys

# Configuration: All paths that must be kept in sync
# In a real production environment, these would be discovered or configured via env vars
TARGET_VERSIONS_PATHS = [
    '/var/www/lingjing/versions.json',
    '/var/www/html/downloads/versions.json',
    '/root/lingjing-update/data/versions.json',
    '/var/www/update-server/data/versions.json',
]

# The source of truth (where the script reads/writes first)
SOURCE_OF_TRUTH = '/var/www/html/downloads/versions.json'

# Directory where build artifacts are stored
DOWNLOAD_DIR = '/var/www/downloads'

class ReleaseManager:
    def __init__(self, version: str, release_notes: str):
        self.version = version
        self.release_name = release_notes
        self.release_date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
        self.platforms_data = {}

    def _calculate_sha512(self, filepath: str) -> str:
        if not os.path.exists(filepath):
            print(f"Warning: File not found for hashing: {filepath}")
            return ""
        h = hashlib.sha512()
        try:
            with open(filepath, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    h.update(chunk)
            return h.hexdigest()
        except Exception as e:
            print(f"Error hashing file {filepath}: {e}")
            return ""

    def add_platform_artifact(self, platform_key: str, filename: str):
        """Adds a platform artifact (e.g., 'win-x64', 'linux-x64') to the release."""
        filepath = os.path.join(DOWNLOAD_DIR, filename)
        if not os.path.exists(filepath):
            print(f"Error: Artifact not found: {filepath}")
            return False

        sha512 = self._calculate_sha512(filepath)
        if not sha512:
            return False
            
        size = os.path.getsize(phi_filepath := filepath) # Fixed typo from previous attempt
        size = os.path.getsize(filepath)

        self.platforms_data[platform_key] = {
            "url": filename,
            "sha512": sha512,
            "size": size
        }
        print(f"Added {platform_key}: {filename} ({size} bytes)")
        return True

    def run(self):
        print(f"Starting release process for v{self.version}...")
        
        # 1. Load existing data from Source of Truth
        if not os.path.exists(SOURCE_OF_TRUTH):
            print(f"Critical Error: Source of truth not found at {SOURCE_OF_TRUTH}")
            print("Attempting to initialize a new versions.json for testing...")
            data = {"versions": [], "latest": ""}
        else:
            try:
                with open(SOURCE_OF_TRUTH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                print(f"Error reading {SOURCE_OF_TRUTH}: {e}")
                data = {"versions": [], "latest": ""}

        # 2. Create new version entry
        new_entry = {
            "version": self.version,
            "releaseDate": self.release_date,
            "releaseNotes": self.release_name,
            "status": "published",
            "platforms": self.platforms_data,
            "files": self.platforms_data 
        }

        # 3. Update data structure
        data['versions'].insert(0, new_entry)
        data['latest'] = self.version

        # 4. Atomic Write to Source of Truth
        self._atomic_write(SOURCE_OF_TRUTH, data)

        # 5. Synchronize to all other paths
        for path in TARGET_VERSIONS_PATHS:
            if path == SOURCE_OF_TRUTH:
                continue
            try:
                dest_dir = os.path.dirname(path)
                if os.path.exists(dest_dir):
                    shutil.copy2(SOURCE_OF_TRUTH, path)
                    print(f"Successfully synced to {path}")
                else:
                    print(f"Warning: Directory {dest_dir} does not exist. Skipping {path}")
            except Exception as e:
                print(f"Error syncing to {path}: {e}")

        print("Release process completed successfully.")
        return True

    def _atomic_write(self, filepath: str, data: Dict[str, Any]):
        """Writes JSON data to a file atomically using a temporary file."""
        temp_file = filepath + ".tmp"
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(temp_file, filepath)
            print(f"Atomic write to {filepath} successful.")
        except Exception as e:
            if os.path.exists(temp_file):
                os.remove(temp_file)
            print(f"Critical Error during atomic write: {e}")
            raise

if __name__ == "__main__":
    import datetime
    import hashlib
    if len(sys.argv) < 3:
        print("Usage: python release_manager.py <version> <release_notes> [platform_key filename ...]")
        sys.exit(1)

    ver = sys.argv[1]
    notes = sys.argv[2]
    
    manager = ReleaseManager(ver, notes)
    
    args = sys.argv[3:]
    for i in range(0, len(args), 2):
        if i + 1 < len(args):
            manager.add_platform_artifact(args[i], args[i+1])
    
    if manager.run():
        sys.exit(0)
    else:
        sys.exit(1)
