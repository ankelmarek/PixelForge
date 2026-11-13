"""Original PixelForge art. Python 3 stdlib only; deterministic PNG assets."""
import math
import random
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public/assets/games/forest-demo'
random.seed(18)

class Image:
    def __init__(self, w, h, color=(0, 0, 0, 0)):
        self.w, self.h = w, h
        self.pixels = [self.color(color)] * (w * h)
    def color(self, color):
        if isinstance(color, str):
            return tuple(bytes.fromhex(color.lstrip('#'))) + (255,)
        return color
    def rect(self, x, y, w, h, color):
        color = self.color(color)
        for yy in range(max(0, int(y)), min(self.h, int(y + h))):
            for xx in range(max(0, int(x)), min(self.w, int(x + w))):
                self.pixels[yy * self.w + xx] = color
    def circle(self, x, y, r, color):
        for yy in range(int(y-r), int(y+r+1)):
            dx = int(math.sqrt(max(0, r*r-(yy-y)**2)))
            self.rect(x-dx, yy, 2*dx+1, 1, color)
    def save(self, name):
        def chunk(kind, data):
            return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
        data = b''.join(b'\0' + bytes(v for p in self.pixels[y*self.w:(y+1)*self.w] for v in p) for y in range(self.h))
        (OUT / name).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', self.w, self.h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(data, 9)) + chunk(b'IEND', b''))

im = Image(320, 180, '#152e38')
for y in range(180):
    t = y/180
    im.rect(0,y,320,1,(int(20+17*t),int(43+29*t),int(54+22*t),255))
im.circle(248, 35, 19, '#35575b'); im.circle(248,35,14,'#a4bca0'); im.circle(253,31,12,'#c4d4ac')
for x,y in [(24,23),(85,42),(164,18),(202,50),(296,19),(127,31)]:
    im.rect(x,y,1,1,'#86a899')
for layer, count, trunk, leaf, base in [(0,15,'#203c42','#25464a',148),(1,10,'#1c383c','#294d49',170),(2,5,'#142f32','#21483e',180)]:
    for i in range(count):
        x = int(i*320/count)+random.randrange(-12,12); top=random.randrange(38,90) if layer < 2 else random.randrange(-25,30)
        w = [4,6,10][layer]
        im.rect(x,top,w,base-top,trunk)
        im.rect(x+w-2,top,2,base-top,'#31534b')
        for h in range(3):
            yy=top+h*15
            im.rect(x-12-h*3,yy+5,30+h*6,7,leaf)
            im.rect(x-7-h*3,yy,20+h*6,10,leaf)
        im.rect(x-7,base-4,20,4,trunk)
for i in range(65):
    x=random.randrange(320); y=random.randrange(146,180)
    im.rect(x,y,random.randrange(2,8),1,random.choice(['#2e5649','#365d4a','#456b50']))
for x,y in [(42,117),(183,135),(286,102),(116,82),(67,65)]:
    im.rect(x,y,1,2,'#b5c779')
im.save('background.png')
original = im.pixels[:]
for name, shift in [('dawn.png', (25, 9, -13)), ('ruins.png', (5, -5, 12))]:
    im.pixels = [tuple(max(0, min(255, p[i]+shift[i])) for i in range(3))+(p[3],) for p in original]
    im.save(name)
im.pixels = original

im=Image(32,24,'#3b3d39')
im.rect(0,0,32,3,'#a4bd72'); im.rect(0,3,32,3,'#607f4b'); im.rect(0,6,32,3,'#405941')
for x in range(0,32,4):
    im.rect(x,0,2,1,'#d3d9a1'); im.rect(x+1,5,2,random.randrange(2,6),'#65804a')
for x,y,w in [(2,12,6),(13,10,8),(25,14,5),(6,20,9),(20,21,8)]:
    im.rect(x,y,w,2,'#505144'); im.rect(x+1,y,2,1,'#6e6b51')
im.save('terrain.png')

im=Image(112,24)
for frame in range(7):
    x=frame*16; bob=1 if frame in [2,5] else 0
    # boots and asymmetrical walking legs
    im.rect(x+4,19,3,4,'#263b3e'); im.rect(x+9,19,3,4,'#263b3e')
    if frame in [1,3]:
        im.rect(x+3 if frame==1 else x+5,21,4,2,'#c2b182'); im.rect(x+9,20,4,2,'#c2b182')
    else:
        im.rect(x+4,22,3,1,'#c2b182'); im.rect(x+9,22,3,1,'#c2b182')
    im.rect(x+3,10+bob,10,10-bob,'#3b6961'); im.rect(x+4,11+bob,7,7,'#61958a')
    im.rect(x+2,12+bob,3,6,'#294c49'); im.rect(x+2,17+bob,3,2,'#e7bf8c')
    im.rect(x+5,2+bob,8,10,'#283c3c'); im.rect(x+6,5+bob,7,6,'#e7bf8c')
    im.rect(x+4,1+bob,8,5,'#b5c780'); im.rect(x+3,4+bob,11,2,'#d2dba0')
    im.rect(x+11,7+bob,1,2,'#263c3e'); im.rect(x+10,10+bob,3,1,'#bb865f')
    im.rect(x+5,11+bob,8,2,'#d8a65d'); im.rect(x+3,12+bob,3,5,'#ba7447')
    im.rect(x+12,14+bob,2,4,'#e7bf8c')
# Seventh frame: recoil pose, kept inside the same sheet contract.
im.rect(96+2,17,3,3,'#e7bf8c'); im.rect(96+12,11,3,3,'#e7bf8c')
im.save('player.png')

im=Image(24,32)
im.rect(5,28,14,4,'#526659'); im.rect(8,25,8,4,'#819177'); im.rect(10,11,4,15,'#59746c')
im.rect(5,4,14,13,'#324c4a'); im.rect(7,5,10,10,'#c6db88'); im.rect(9,6,6,8,'#f7edb0'); im.rect(11,7,2,6,'#fff7d6')
im.rect(4,3,16,2,'#a8b382'); im.rect(7,0,10,3,'#6f927d'); im.rect(4,16,16,2,'#8d9f73')
im.save('beacon.png')

im=Image(32,48)
im.rect(2,43,28,5,'#61766a'); im.rect(4,12,7,32,'#667d70'); im.rect(21,12,7,32,'#667d70')
im.rect(7,5,18,8,'#849882'); im.rect(11,1,10,6,'#a4b38d'); im.rect(9,11,14,31,'#346865')
for y in range(13,42,4):
    im.rect(12+(y%3),y,8,1,'#89c1a2')
im.rect(6,13,2,28,'#a7b596'); im.rect(23,13,2,28,'#a7b596'); im.rect(14,6,4,4,'#e6d99a')
im.save('portal.png')

# Additional original sprites for the full three-map demonstration.
im=Image(12,14)
for y,w in [(0,2),(1,6),(3,10),(5,12),(9,8),(12,2)]:
    im.rect((12-w)//2,y,w,2,'#92cfc2')
im.rect(4,3,3,7,'#d9f6ce'); im.rect(7,6,3,4,'#5c9bb2'); im.save('gem.png')
im=Image(48,16)
for f in range(3):
    x=f*16
    im.rect(x+2,10,12,5,'#485943'); im.rect(x+3,6,10,7,'#77925a'); im.rect(x+5,4,6,4,'#a4b869')
    im.rect(x+3,9,2,2,'#e8d697'); im.rect(x+11,9,2,2,'#e8d697'); im.rect(x+4,10,1,1,'#273b35'); im.rect(x+12,10,1,1,'#273b35')
    im.rect(x+(2 if f==0 else 4),14,4,2,'#283e35'); im.rect(x+10,14,4,2,'#283e35')
    if f==2: im.rect(x+4,7,8,2,'#d49a72')
im.save('enemy.png')
im=Image(16,28)
im.rect(6,3,3,25,'#536e5e'); im.rect(7,4,8,7,'#d7b473'); im.rect(8,5,6,3,'#eddda0'); im.rect(3,25,10,3,'#8e9c74'); im.save('checkpoint.png')
im=Image(20,12)
for x in [0,5,10,15]:
    im.rect(x+1,2,2,9,'#6b7357'); im.rect(x+2,0,1,9,'#c3b18b'); im.rect(x,9,5,3,'#464f42')
im.save('hazard.png')
im=Image(12,14)
im.rect(2,5,8,9,'#b9b595'); im.rect(3,1,6,2,'#d9cd9a'); im.rect(2,3,2,4,'#d9cd9a'); im.rect(8,3,2,4,'#d9cd9a'); im.rect(5,8,2,4,'#49534a'); im.save('lock.png')
for name, color in [('flowers.png','#d5bc82'),('ferns.png','#80a586'),('stones.png','#879c97')]:
    im=Image(24,24)
    for x in [3,10,18]:
        height=random.randrange(5,12)
        im.rect(x,24-height,1,height,'#507760'); im.rect(x-2,25-height,5,3,color)
        im.rect(x+1,20,3,1,'#6a9066')
    if name=='stones.png':
        im.rect(3,19,9,5,color); im.rect(6,17,6,4,color); im.rect(17,20,5,4,'#a5b0a1')
    im.save(name)
