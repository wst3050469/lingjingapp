#!/usr/bin/env python3
"""Patch AndroidManifest.xml binary (AXML) to change versionCode and versionName.
Works directly on the APK zip without needing apktool."""

import struct
import zipfile
import io
import shutil
import sys
from pathlib import Path

# AXML chunk types
CHUNK_XML = 0x00080003
CHUNK_STRING_POOL = 0x001C0001
CHUNK_RESOURCE_MAP = 0x00080180

# XML node types
XML_START_ELEMENT = 0x00100102
XML_END_ELEMENT = 0x00100103
XML_START_NAMESPACE = 0x00100100
XML_END_NAMESPACE = 0x00100101

# Attribute value types
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_BOOLEAN = 0x12
TYPE_REFERENCE = 0x01

# Android resource IDs
ANDROID_VERSION_CODE = 0x0101021B
ANDROID_VERSION_NAME = 0x0101021C


def read_le32(data, offset):
    return struct.unpack_from('<I', data, offset)[0]


def read_le16(data, offset):
    return struct.unpack_from('<H', data, offset)[0]


def write_le32(data, offset, value):
    struct.pack_into('<I', data, offset, value)


def write_le16(data, offset, value):
    struct.pack_into('<H', data, offset, value)


def parse_axml(data):
    """Simple AXML dump for debugging - prints detected strings"""
    if len(data) < 8:
        return None
    
    chunk_type = read_le16(data, 0)
    if chunk_type != 0x0003:
        return None
    
    string_pool_offset = None
    string_count = 0
    strings = []
    
    # Walk through chunks
    offset = 8  # Skip XML header (8 bytes)
    while offset < len(data) - 8:
        chunk_type = read_le16(data, offset)
        chunk_size = read_le32(data, offset + 4)
        
        if chunk_type == 0x0001:  # String Pool
            string_count = read_le32(data, offset + 8)
            strings_start = read_le32(data, offset + 24)
            string_pool_offset = offset
            
            # Parse strings for modification later
            for i in range(string_count):
                str_offset_in_pool = read_le32(data, offset + 28 + i * 4)
                if str_offset_in_pool == 0xFFFFFFFF:
                    # Some entries are null references
                    continue
                str_start = offset + strings_start + str_offset_in_pool
                # UTF-16 string: 2-byte length prefix, then UTF-16LE chars, null-terminated
                if str_start + 2 <= len(data):
                    char_len = read_le16(data, str_start)
                    str_data = data[str_start + 2 : str_start + 2 + char_len * 2]
                    try:
                        decoded = str_data.decode('utf-16-le')
                        strings.append((str_start, char_len, decoded))
                    except:
                        pass
            
            break  # String pool is typically the first chunk after header
        
        offset += chunk_size
        # Align to 4-byte boundary
        if offset % 4 != 0:
            offset += 4 - (offset % 4)
    
    return data, string_pool_offset, strings


def patch_version_name(manifest_data, old_name, new_name):
    """Replace old versionName string with new one of same length in the string pool."""
    byte_data = bytearray(manifest_data)
    modified = False
    
    # Search for UTF-16 encoded old_name
    utf16_old = old_name.encode('utf-16-le')
    utf16_new = new_name.encode('utf-16-le')
    
    if len(utf16_old) != len(utf16_new):
        print(f"ERROR: old and new version names must have same byte length! "
              f"'{old_name}'={len(utf16_old)} vs '{new_name}'={len(utf16_new)}")
        return manifest_data, False
    
    pos = 0
    while True:
        pos = byte_data.find(utf16_old, pos)
        if pos == -1:
            break
        # Check if this is preceded by a valid length prefix
        if pos >= 2:
            prefix_len = struct.unpack_from('<H', byte_data, pos - 2)[0]
            if prefix_len == len(old_name):
                print(f"  Replacing '{old_name}' → '{new_name}' at offset {pos}")
                byte_data[pos:pos + len(utf16_old)] = utf16_new
                modified = True
        pos += 1
    
    return bytes(byte_data), modified


def patch_version_code(manifest_data, old_code, new_code):
    """Find and replace versionCode attribute value in AXML."""
    byte_data = bytearray(manifest_data)
    modified = False
    
    # In AXML binary, the versionCode attribute has:
    # - resource ID 0x0101021B stored as little-endian
    # - followed by the value structure: size=8, reserved=0, type=TYPE_INT_DEC(0x10), data=versionCode
    
    # Search for the pattern: 1B 02 01 01 (resource ID for versionCode)
    res_id = struct.pack('<I', ANDROID_VERSION_CODE)  # 0x0101021B → 1B 02 01 01
    
    pos = 0
    while True:
        pos = byte_data.find(res_id, pos)
        if pos == -1:
            break
        
        # After resource ID, there are more fields in the attribute structure
        # Attribute structure:
        # - namespaceUri: uint32 (string pool index)
        # - name: uint32 (string pool index)  <-- res_id is here
        # - valueString: uint32 (string pool index)
        # - valueSize: uint16
        # - valueReserved: uint8 (0x00)
        # - valueType: uint8
        # - valueData: uint32
        
        # So the value data is at pos + 4 + 4 + 4 + 2 + 1 + 1 = pos + 16
        # Let's verify the structure around this position
        if pos >= 4 and pos + 16 < len(byte_data):
            value_size = read_le16(byte_data, pos + 12)
            value_type = byte_data[pos + 15]
            value_data = read_le32(byte_data, pos + 16)
            
            if value_type == TYPE_INT_DEC and value_data == old_code:
                print(f"  Replacing versionCode {old_code} → {new_code} at offset {pos + 16}")
                write_le32(byte_data, pos + 16, new_code)
                modified = True
                break  # Only need to change one
        
        pos += 1
    
    # Also try searching for raw int pattern near version_name context
    # Search for exact byte pattern of size=8, reserved=0, type=0x10, data=old_code
    if not modified:
        pattern = struct.pack('<HBBI', 8, 0, TYPE_INT_DEC, old_code)
        pos = 0
        while True:
            pos = byte_data.find(pattern, pos)
            if pos == -1:
                break
            print(f"  Replacing versionCode {old_code} → {new_code} at offset {pos + 4} (raw pattern)")
            write_le32(byte_data, pos + 4, new_code)
            modified = True
            break
    
    return bytes(byte_data), modified


def patch_apk(input_apk, output_apk, old_version_code, new_version_code, old_version_name, new_version_name):
    """Main function: patch versionCode and versionName in APK."""
    print(f"\nPatching APK: {input_apk}")
    print(f"  versionCode: {old_version_code} → {new_version_code}")
    print(f"  versionName: {old_version_name} → {new_version_name}")
    
    # Read original APK
    with zipfile.ZipFile(input_apk, 'r') as zin:
        all_items = [(item.filename, zin.read(item.filename)) for item in zin.infolist()]
    
    # Find and modify AndroidManifest.xml
    manifest_data = None
    manifest_modified = False
    
    for filename, data in all_items:
        if filename == 'AndroidManifest.xml':
            manifest_data = bytearray(data)
            break
    
    if manifest_data is None:
        print("ERROR: AndroidManifest.xml not found in APK!")
        return False
    
    print(f"  Manifest size: {len(manifest_data)} bytes")
    
    # Patch versionName (string pool)
    manifest_data, mod1 = patch_version_name(bytes(manifest_data), old_version_name, new_version_name)
    manifest_data = bytearray(manifest_data)
    
    # Patch versionCode (attribute value)
    manifest_data, mod2 = patch_version_code(bytes(manifest_data), old_version_code, new_version_code)
    manifest_data = bytes(manifest_data)
    
    if not mod1 and not mod2:
        print("ERROR: Could not find versionCode or versionName in manifest!")
        # Try more aggressive search
        print("  Attempting raw byte search...")
        
        # Direct string replace in entire file (same length)
        utf16_old = old_version_name.encode('utf-16-le')
        utf16_new = new_version_name.encode('utf-16-le')
        raw_data = bytearray(manifest_data)
        pos = raw_data.find(utf16_old)
        while pos != -1:
            raw_data[pos:pos+len(utf16_old)] = utf16_new
            print(f"  Force-replaced '{old_version_name}' at offset {pos}")
            mod1 = True
            pos = raw_data.find(utf16_old, pos + 1)
        
        # Raw search for versionCode integer
        for offset in range(8, len(raw_data) - 4):
            # Look for value structure: 08 00 00 10 XX XX XX XX
            if (raw_data[offset:offset+2] == b'\x08\x00' and 
                raw_data[offset+2:offset+4] == b'\x00\x10'):
                val = read_le32(raw_data, offset + 4)
                if val == old_version_code:
                    write_le32(raw_data, offset + 4, new_version_code)
                    print(f"  Force-replaced versionCode at attribute offset {offset + 4}")
                    mod2 = True
                    break
        
        manifest_data = bytes(raw_data)
    
    manifest_modified = mod1 or mod2
    
    if not manifest_modified:
        print("ERROR: Failed to modify manifest!")
        return False
    
    print(f"  Manifest modified: versionName={'OK' if mod1 else 'FAIL'}, versionCode={'OK' if mod2 else 'FAIL'}")
    
    # Write output APK
    output_apk = Path(output_apk)
    with zipfile.ZipFile(output_apk, 'w', zipfile.ZIP_DEFLATED) as zout:
        for filename, data in all_items:
            if filename == 'AndroidManifest.xml':
                zout.writestr(zipfile.ZipInfo(filename), manifest_data)
            else:
                zout.writestr(zipfile.ZipInfo(filename), data)
    
    output_size = output_apk.stat().st_size
    print(f"\n  Output APK: {output_apk} ({output_size:,} bytes)")
    return True


if __name__ == '__main__':
    if len(sys.argv) >= 6:
        input_apk = sys.argv[1]
        output_apk = sys.argv[2]
        old_vc = int(sys.argv[3])
        new_vc = int(sys.argv[4])
        old_vn = sys.argv[5]
        new_vn = sys.argv[6]
    else:
        input_apk = '/home/liuhui/lingjing-v1.71.0.apk'
        output_apk = '/home/liuhui/lingjing-1.71.1-patched.apk'
        old_vc = 36
        new_vc = 37
        old_vn = '1.71.0'
        new_vn = '1.71.1'
    
    success = patch_apk(input_apk, output_apk, old_vc, new_vc, old_vn, new_vn)
    sys.exit(0 if success else 1)
