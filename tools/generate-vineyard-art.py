"""Original Winobranie pixel art (CC0), Python 3 stdlib."""
from pathlib import Path
import json
import random
from pixel_art import Image
root=Path(__file__).resolve().parents[1]
out=root/'public/assets/games/winobranie'
level=json.loads((out/'world.json').read_text())
random.seed(49)
assets={}
def save(name,im): assets[name]=im;im.save(out/f'{name}.png')
background=Image(640,416,'#8b9c68')
for y in range(416):
    color=['#899c69','#8d9f6b','#91a16c','#94a66e'][(y//80)%4]
    background.rect(0,y,640,1,color)
for i in range(5000):
    x=random.randrange(640);y=random.randrange(416)
    background.rect(x,y,random.choice([1,2,3]),1,random.choice(['#9aac77','#839566','#a3af7c','#7e9361']))
for r in level['roads']:
    x,y,w,h=[r[k]*16 for k in ['x','y','width','height']]
    background.rect(x,y,w,h,'#bfb38b')
    for i in range(w*h//45):
        xx=random.randrange(x,x+w);yy=random.randrange(y,y+h)
        background.rect(xx,yy,random.choice([1,2,3]),1,random.choice(['#d2c59d','#ad9f7b','#c9bd96']))
background.rect(608,0,32,416,'#5b8990')
for y in range(0,416,9):
    background.rect(612+(y%5),y,random.randrange(6,18),1,'#91b8ad');background.rect(608,y+3,3,5,'#738b6d')
for x in range(0,608,16):
    for y in [16,410]:
        background.rect(x,y,14,2,'#7a7756');background.rect(x+2,y-3,2,8,'#d2c395')
for y in range(24,410,16):
    background.rect(8,y,2,13,'#7a7756');background.rect(5,y+3,7,2,'#d2c395')
for x,y in [(38,40),(66,46),(435,37),(470,40),(576,66),(32,308),(65,310),(560,37)]:
    background.rect(x-3,y+5,7,14,'#675f48')
    background.rect(x-14,y-7,28,18,'#5e8059');background.rect(x-10,y-14,21,22,'#72965f');background.rect(x-6,y-15,14,10,'#a0b278')
for source in [n for n in level['nodes'] if n['kind']=='source']:
    background.rect(source['x']*16-3,source['y']*16+12,166,6,'#71875b')
save('background',background)
# Vines: raised foliage and timber trellis, fruit drawn separately per unit.
im=Image(160,24)
im.rect(0,21,160,3,'#697b51');im.rect(2,11,156,2,'#b2a36d')
for x in range(8,160,16):
    im.rect(x-1,8,2,16,'#806f4e');im.rect(x-6,4,13,13,'#456c4b');im.rect(x-8,6,16,8,'#557c50');im.rect(x-4,1,10,8,'#7e9b61');im.rect(x-4,2,7,2,'#9eb574')
save('vine',im)
im=Image(12,14)
for x,y,r in [(4,4,3),(8,4,3),(3,8,2),(7,8,3),(5,11,2)]: im.circle(x,y,r,'#675174')
im.rect(4,1,1,4,'#a7b57d');im.rect(2,3,2,2,'#bd9bb5');im.rect(7,3,2,2,'#a887aa');im.rect(5,8,2,2,'#927699')
save('fruit',im)
im=Image(12,12)
im.rect(0,2,12,9,'#77583e');im.rect(1,3,10,7,'#b58b55');im.rect(2,4,8,3,'#775877')
for x in [1,9]: im.rect(x,1,2,11,'#d6b778')
im.rect(0,8,12,2,'#c39e64');im.rect(3,4,2,1,'#b4a1b6');save('cargo',im)
im=Image(32,32)
im.rect(1,25,30,7,'#75634b');im.rect(2,16,28,11,'#b59661')
for y in [17,21,25]: im.rect(2,y,28,2,'#dac58c')
im.rect(4,27,4,4,'#4f5943');im.rect(24,27,4,4,'#4f5943');save('depot',im)
im=Image(64,24)
for f in range(4):
    x=f*16;b=f%2
    im.rect(x+4,18,3,5-b,'#4e5c56');im.rect(x+9,18+b,3,5-b,'#4e5c56')
    im.rect(x+3,9+b,10,11-b,'#527f84');im.rect(x+5,10+b,6,8,'#82a39b')
    im.rect(x+3,12+b,2,6,'#d6aa7f');im.rect(x+12,12+b,2,6,'#d6aa7f')
    im.rect(x+5,3+b,7,8,'#e4bc8b');im.rect(x+11,6+b,1,2,'#4c544c')
    im.rect(x+4,1+b,8,4,'#dfcf98');im.rect(x+2,4+b,12,2,'#f0dfaa')
    if f==3: im.rect(x+12,8,3,5,'#e4bc8b')
save('worker',im)
im=Image(96,32)
for f in range(2):
    x=f*48
    im.rect(x+1,28,45,3,'#647752');im.rect(x+1,17,22,9,'#9c784d');im.rect(x+2,17,20,3,'#d7b77d');im.rect(x+4,21,17,2,'#c6a26b')
    im.circle(x+7,27,4,'#384b43');im.circle(x+7,27,2,'#b7b791');im.circle(x+18,27,4,'#384b43');im.circle(x+18,27,2,'#b7b791')
    im.rect(x+22,16,24,9,'#4d7964');im.rect(x+23,15,13,7,'#71977b');im.rect(x+35,17,11,5,'#8baa7e')
    im.rect(x+26,7,9,11,'#d4c79a');im.rect(x+28,8,5,7,'#759c9e');im.rect(x+24,5,13,3,'#f0d89c');im.rect(x+41,11,2,7,'#58695c')
    im.circle(x+28,25,6,'#35483f');im.circle(x+28,25,3,'#c9bd85');im.circle(x+43,27,4,'#35483f');im.circle(x+43,27,2,'#c9bd85')
    im.rect(x+27+f,23,1,4,'#657d61');im.rect(x+42,26+f,3,1,'#657d61')
save('vehicle',im)
im=Image(224,96)
for f in range(2):
    x=f*112
    im.rect(x+1,89,110,7,'#69795e');im.rect(x+8,46,96,44,'#ccbb8f');im.rect(x+11,49,90,36,'#e0cc9c')
    for y in [58,70,82]: im.rect(x+11,y,90,1,'#c6b28b')
    for y,w in [(6,30),(12,52),(18,70),(24,90),(30,108),(36,112)]: im.rect(x+(112-w)//2,y,w,8,'#8f6653')
    for y,w in [(8,28),(14,50),(20,68),(26,88),(32,106)]:
        im.rect(x+(112-w)//2,y,w,3,'#b78460')
        for xx in range((112-w)//2+4,(112+w)//2,12): im.rect(x+xx,y,2,4,'#c6986b')
    im.rect(x+5,43,102,4,'#e7d39d');im.rect(x+14,54,19,18,'#6b8d87');im.rect(x+16,56,15,5,'#a5bbb0')
    im.rect(x+21,54,2,18,'#d4bf8b');im.rect(x+14,61,19,2,'#d4bf8b')
    im.rect(x+42,55,24,34,'#6e6952');im.rect(x+45,59,18,30,'#4b5b4b');im.rect(x+43,87,23,4,'#b6a277')
    im.rect(x+76,57+f*2,18,23,'#8f7855');im.rect(x+74,54,22,4,'#6a6850');im.rect(x+75,77,20,3,'#c1a477')
    im.rect(x+84,46,3,29,'#536c61');im.rect(x+78,46+f,15,3,'#91a190');im.circle(x+95,68,6,'#5c796c');im.circle(x+95,68,3,'#b7b58b')
    im.rect(x+91+f*3,67,8-f*3,2,'#d4c492');im.rect(x+83,12,11,20,'#b1a182');im.rect(x+81,10,15,4,'#6c6b57')
save('press',im)
im=Image(32,64)
im.rect(5,54,23,10,'#6f7d6d');im.rect(3,14,26,42,'#82998c');im.rect(5,12,22,43,'#c7ceb0');im.rect(7,15,18,36,'#9bb2a5')
im.rect(4,9,24,6,'#a7b7a1');im.rect(8,5,16,5,'#d9d7ac');im.rect(14,1,4,6,'#7c9585')
im.rect(6,52,20,3,'#e3d8ad');im.rect(2,57,28,3,'#9da98b');im.rect(10,56,3,8,'#526f61');im.rect(23,55,3,9,'#526f61')
for y in range(18,48,6): im.rect(25,y,3,1,'#697e71')
save('tank',im)
im=Image(18,36,'#b77968')
for y in range(0,36,6): im.rect(0,y,18,1,'#d5ab7d')
im.rect(2,0,2,36,'#e1c28d');save('juice',im)
# Cover built from the same original source buffers at half size.
scene=Image(640,416);scene.pixels=background.pixels[:]
for n in sorted(level['nodes'],key=lambda n:n['y']+n['height']):
    source=assets[n['texture']]
    if n['texture']=='press':
        frame=Image(112,96)
        for yy in range(96): frame.pixels[yy*112:(yy+1)*112]=source.pixels[yy*224:yy*224+112]
        source=frame
    cx=int((n['x']+n['width']/2)*16);bottom=int((n['y']+n['height'])*16)
    scene.blit(source,cx-source.w//2,bottom-source.h)
    if n['kind']=='source':
        for slot in n['stockVisual']['slots']:
            fruit=assets['fruit'];scene.blit(fruit,int(cx+slot['x']*16-fruit.w/2),int(bottom+slot['y']*16-fruit.h))
cover=Image(320,180)
for y in range(180):
    for x in range(320): cover.pixels[y*320+x]=scene.pixels[(y*2+44)*640+x*2]
save('cover',cover)
