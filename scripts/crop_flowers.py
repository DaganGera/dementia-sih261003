import sys
import os

try:
    from PIL import Image
    print("PIL is available!")
    
    img = Image.open('public/images/siroi-bg.jpg').convert('RGBA')
    width, height = img.size
    print(f"Loaded image: {width}x{height}")
    
    # Let's inspect background color at a blank area, e.g., (200, 200)
    bg_sample = img.getpixel((200, 200))
    print(f"Background sample at (200, 200): {bg_sample}")
    
    # Helper to make background transparent
    def make_transparent(cropped_img, bg_rgb, tolerance=22):
        data = cropped_img.getdata()
        new_data = []
        br, bg, bb = bg_rgb[:3]
        for item in data:
            r, g, b, a = item
            # Euclidean color distance to background
            dist = ((r - br)**2 + (g - bg)**2 + (b - bb)**2) ** 0.5
            if dist < tolerance:
                # Fully transparent
                new_data.append((r, g, b, 0))
            elif dist < tolerance + 20:
                # Smooth alpha transition
                alpha_factor = (dist - tolerance) / 20.0
                new_data.append((r, g, b, int(255 * alpha_factor)))
            else:
                new_data.append((r, g, b, 255))
        cropped_img.putdata(new_data)
        return cropped_img

    # 1. Top Right Flower
    # Looking at 1024x572:
    # Top right starts around x=820 to 1024, y=40 to 450
    box_tr = (830, 40, 1024, 450)
    img_tr = img.crop(box_tr)
    img_tr = make_transparent(img_tr, bg_sample)
    img_tr.save('public/images/flower_top_right.png')
    print("Saved public/images/flower_top_right.png")

    # 2. Bottom Left Flower
    # Starts around x=0 to 180, y=360 to 572
    box_bl = (0, 360, 180, 572)
    img_bl = img.crop(box_bl)
    img_bl = make_transparent(img_bl, bg_sample)
    img_bl.save('public/images/flower_bottom_left.png')
    print("Saved public/images/flower_bottom_left.png")

    # 3. Bottom Right Flower
    # Starts around x=860 to 1024, y=380 to 572
    box_br = (860, 380, 1024, 572)
    img_br = img.crop(box_br)
    img_br = make_transparent(img_br, bg_sample)
    img_br.save('public/images/flower_bottom_right.png')
    print("Saved public/images/flower_bottom_right.png")

    # 4. Siroi Logo Flower (above the title "Siroi")
    # Around center x=512. Width ~ 70. x from 480 to 545, y from 60 to 125
    box_logo = (485, 60, 545, 125)
    img_logo = img.crop(box_logo)
    img_logo = make_transparent(img_logo, bg_sample)
    img_logo.save('public/images/flower_logo.png')
    print("Saved public/images/flower_logo.png")

except Exception as e:
    print("Error:", e, file=sys.stderr)
