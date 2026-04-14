import os
import glob
from PIL import Image, ImageOps

src_dir = 'img/fotos-originais'
out_dir = 'img'

for ext in ('*.jpg', '*.jpeg', '*.JPG', '*.JPEG', '*.png'):
    for path in glob.glob(os.path.join(src_dir, '**', ext), recursive=True):
        try:
            with Image.open(path) as img:
                img = ImageOps.exif_transpose(img)
                width, height = img.size
                if width > 2400:
                    new_width = 2400
                    new_height = int(height * (new_width / width))
                    print(f"Resizing {path} from {width}x{height} to {new_width}x{new_height}")
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # convert to RGB just in case
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                filename = os.path.basename(path)
                basename = os.path.splitext(filename)[0]
                webp_name = f"{basename}.webp"
                webp_path = os.path.join(out_dir, webp_name)
                
                print(f"Saving {webp_path} ...")
                img.save(webp_path, 'WEBP', quality=90, method=6)
        except Exception as e:
            print(f"Failed to process {path}: {e}")
