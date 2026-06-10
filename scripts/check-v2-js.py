with open('/root/cloud-server/web-platform/public/versions-v2.js') as f:
    first_line = f.readline().strip()
print(f'API_BASE: {first_line}')

# Also verify the file size
import os
size = os.path.getsize('/root/cloud-server/web-platform/public/versions-v2.js')
print(f'Size: {size} bytes')
