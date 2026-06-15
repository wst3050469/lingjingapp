import re, os

fpath = r'D:\lingjing-ide\desktop\electron\scripts\build-main.mjs'
print(f"Reading: {fpath}")
print(f"Exists: {os.path.exists(fpath)}")
with open(fpath, 'rb') as f:
    content = f.read()
print(f"Size: {len(content)} bytes")

start_marker = b"const SAFE_REQUIRE_PREAMBLE = ["
start_idx = content.find(start_marker)
print(f"START_IDX: {start_idx}")
if start_idx < 0:
    print("NOT FOUND")
    exit(1)

end_marker = b"].join("
end_idx = content.find(end_marker, start_idx)
print(f"END_IDX: {end_idx}")
if end_idx < 0:
    print("end_marker not found")
    print(content[start_idx:start_idx+3000].decode('utf-8', errors='replace')[-1000:])
    exit(1)

print(f"Preamble: bytes {start_idx} to {end_idx}")
