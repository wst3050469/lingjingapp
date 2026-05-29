import os
import sys
from pathlib import Path
import oss2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_config(key, default=None):
    value = os.getenv(key, default)
    if not value:
        print(f"Error: Configuration key '{key}' is missing.")
        sys.exit(1)
    return value

def upload_to_oss():
    # 1. Load Configuration
    access_key_id = get_config('OSS_ACCESS_KEY_ID')
    access_key_secret = get_config('OSS_ACCESS_KEY_SECRET')
    endpoint = get_config('OSS_ENDPOINT')
    bucket_name = get_config('OSS_BUCKET')
    
    local_dir_str = get_config('LOCAL_ARTIFACTS_DIR', '.')
    oss_prefix = get_config('OSS_REMOTE_PREFIX', 'downloads')

    local_dir = Path(local_dir_str)
    
    if not local_dir.exists():
        print(f"Error: Local directory '{local_dir}' does not exist.")
        sys.exit(1)

    print(f"Connecting to OSS: {endpoint}/{bucket_name}...")
    
    try:
        # 2. Initialize OSS Bucket
        auth = oss2.Auth(access_key_id, access_key_secret)
        bucket = oss2.Bucket(auth, endpoint, bucket_name)

        # 3. Iterate through local files and upload
        files_uploaded = 0
        files_skipped = 0
        
        print(f"Scanning local directory: {local_dir.absolute()}")
        
        # Supported extensions (can be expanded)
        supported_extensions = {'.exe', '.apk', '.AppImage', '.deb', '.yml', '.blockmap', '.json'}

        for file_path in local_dir.rglob('*'):
            if file_path.is_file():
                # Check if file extension is supported
                if file_path.suffix.lower() in supported_extensions or file_path.suffix == '':
                    # Construct OSS destination path
                    # relative_path = file_path.relative_to(local_dir)
                    # For simplicity, we use the filename and append to prefix
                    # But to preserve structure, we use relative path
                    relative_path = file_path.relative_to(local_dir)
                    oss_path = f"{oss_prefix.rstrip('/')}/{relative_path.as_posix()}"
                    
                    print(f"Uploading: {file_path.name} -> {oss_path}")
                    
                    # Perform upload
                    bucket.put_object_from_file(oss_path, str(file_path))
                    files_uploaded += 1
                else:
                    print(f"Skipping unsupported file: {file_path.name}")
                    files_skipped += 1

        print("\n--- Upload Summary ---")
        print(f"Successfully uploaded: {files_uploaded} files")
        if files_skipped > 0:
            print(f"Skipped: {files_skipped} files")
        print("----------------------")
        print("OSS Deployment completed successfully.")

    except oss2.exceptions.AccessKeyError:
        print("Error: Invalid OSS AccessKey or SecretKey.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred during OSS upload: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    upload_to_oss()
