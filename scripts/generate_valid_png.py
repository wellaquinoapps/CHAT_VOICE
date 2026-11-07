import zlib
import struct
import os

def create_png(width, height, r, g, b):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    # Width (4), Height (4), Bit depth (1), Color type (1=indexed, 2=RGB, 6=RGBA), Compression (1), Filter (1), Interlace (1)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # Raw image scanlines
    # Each row begins with a filter byte (0 = none), followed by width * 3 bytes (R, G, B)
    raw_row = b'\x00' + bytes([r, g, b]) * width
    raw_data = raw_row * height
    
    # IDAT chunk
    compressed_data = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    png += struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png

out_dir = os.path.join(os.getcwd(), 'public', 'icons')
os.makedirs(out_dir, exist_ok=True)

# Cor Índigo (#4F46E5) -> R: 79, G: 70, B: 229
png_192 = create_png(192, 192, 79, 70, 229)
with open(os.path.join(out_dir, 'icon-192.png'), 'wb') as f:
    f.write(png_192)

png_512 = create_png(512, 512, 79, 70, 229)
with open(os.path.join(out_dir, 'icon-512.png'), 'wb') as f:
    f.write(png_512)

print('Valid PNGs created: 192x192 (', len(png_192), 'bytes), 512x512 (', len(png_512), 'bytes)')

