from PIL import Image

def remove_black_background(input_path, output_path):
    print("Opening image...")
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    newData = []
    
    print("Processing pixels...")
    for item in datas:
        # If the pixel is very dark (close to black)
        # The background in the screenshot is exactly (0,0,0). Let's use a small threshold.
        if item[0] < 20 and item[1] < 20 and item[2] < 20:
            newData.append((255, 255, 255, 0)) # transparent
        else:
            newData.append(item)
            
    print("Saving image...")
    img.putdata(newData)
    img.save(output_path, "PNG")
    print("Done!")

if __name__ == '__main__':
    remove_black_background("public/jardinagem-worker.jpg", "public/jardinagem-worker.png")
