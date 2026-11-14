"""Original CC0 ORLAR pixel art and deterministic 4096px sector world. Stdlib only."""
import json
import math
import random
from pathlib import Path
from pixel_art import Image

OUT = Path(__file__).resolve().parents[1] / 'public/assets/games/gas-station'
(OUT / 'sectors').mkdir(parents=True, exist_ok=True)
rng = random.Random(20261114)
INK, AMBER, TEAL, WHITE = '#243c42', '#efb851', '#48aa9a', '#f5edce'
def save(name, image): image.save(OUT / f'{name}.png')
def line(im,x,y,xx,yy,color,width=1):
    steps=max(abs(xx-x),abs(yy-y),1)
    for i in range(steps+1): im.rect(round(x+(xx-x)*i/steps),round(y+(yy-y)*i/steps),width,width,color)
def eagle(im,x,y,scale=1):
    for a,b,c in [(0,0,15),(2,1,13),(4,2,11),(6,3,9),(6,4,7),(5,5,6),(4,6,5)]:
        im.rect(x+a*scale,y+b*scale,c*scale,scale,AMBER)
    im.rect(x+9*scale,y-scale,4*scale,scale,WHITE)

# Tiles: meadow, pavement, asphalt, verge, floor, crop and water.
atlas=Image(256,16)
colors=['#738f58','#758f59','#718c56','#748f57','#9dada3','#465d61','#b7bf9f','#d5c8a4','#344d51','#45664e','#d2b573','#b99c62','#3c7276','#518c88','#6e8665','#e1d7b7']
for f,col in enumerate(colors):
    tile=Image(16,16,col)
    for i in range(8):
        c=tuple(max(0,min(255,v+rng.choice([-9,8]))) for v in tile.color(col)[:3])+(255,)
        tile.rect(rng.randrange(16),rng.randrange(16),2,1,c)
    if f==4:
        tile.rect(0,0,16,1,'#b0bdb0'); tile.rect(0,0,1,16,'#8c9e94')
    if f==7: tile.rect(0,0,16,1,'#b9aa8c');tile.rect(0,0,1,16,'#b9aa8c')
    if f in [10,11]:
        for x in [2,7,12]: tile.rect(x,0,1,16,'#e7c579');tile.rect(x+1,0,1,16,'#9d885c')
    if f in [12,13]: tile.rect(2,6,7,1,'#71a6a0');tile.rect(9,13,5,1,'#699c93')
    atlas.blit(tile,f*16,0)
save('tiles',atlas)

# Four paint finishes, eight directions. Nearest-neighbour rotation retains pixels.
cars=Image(1024,256)
truck=Image(1024,128)
def rotate(source,angle):
    im=Image(source.w,source.h); c=(source.w-1)/2
    co,si=math.cos(angle),math.sin(angle)
    for y in range(im.h):
        for x in range(im.w):
            xx=round((x-c)*co+(y-c)*si+c); yy=round(-(x-c)*si+(y-c)*co+c)
            if 0<=xx<source.w and 0<=yy<source.h: im.pixels[y*im.w+x]=source.pixels[yy*source.w+xx]
    return im
for n,paint in enumerate(['#df8256','#4fa9ad','#e2c75f','#d9dfd2']):
    car=Image(64,64)
    car.rect(19,15,29,41,'#3e5650');car.rect(18,17,5,10,INK);car.rect(42,17,5,10,INK);car.rect(18,40,5,10,INK);car.rect(42,40,5,10,INK)
    car.rect(22,10,20,44,INK);car.rect(20,14,24,36,paint);car.rect(23,11,18,42,paint)
    car.rect(23,13,18,3,WHITE);car.rect(22,22,20,10,'#537f85');car.rect(24,23,16,6,'#9fc5bf')
    car.rect(24,25,4,4,'#b5d2c7');car.rect(24,32,16,10,paint);car.rect(25,33,14,2,WHITE)
    car.rect(23,43,18,5,'#45676c');car.rect(25,44,14,2,'#7fa7a5');car.rect(22,49,4,3,'#dc654c');car.rect(38,49,4,3,'#dc654c')
    car.rect(27,52,10,2,'#c4cbbb');car.rect(21,30,2,10,'#3d7374');car.rect(42,30,2,10,'#3d7374')
    for d in range(8):
        for light in range(2):
            car.rect(22,49,4,3,'#f89b65' if light else '#dc654c');car.rect(38,49,4,3,'#f89b65' if light else '#dc654c')
            cars.blit(rotate(car,math.pi/2+d*math.pi/4),(d*2+light)*64,n*64)
save('cars',cars)
im=Image(128,128)
im.rect(44,19,46,91,'#3d574f')
for y in [28,80,96]:
    im.rect(42,y,7,10,INK);im.rect(79,y,7,10,INK)
im.rect(48,17,32,88,INK);im.rect(46,18,36,29,AMBER);im.rect(49,15,30,7,'#f3ce72')
im.rect(48,26,32,11,INK);im.rect(50,27,28,7,'#96c9c2');im.rect(48,20,6,3,WHITE);im.rect(74,20,6,3,WHITE)
im.rect(48,49,32,54,'#8caaa4');im.rect(51,47,26,60,'#d4ddcb');im.rect(56,47,14,60,WHITE)
for y in [53,77,98]: im.rect(50,y,28,3,'#9fb7ad')
im.rect(52,64,24,10,TEAL);eagle(im,56,65)
im.rect(48,105,6,3,'#c95945');im.rect(74,105,6,3,'#c95945')
for d in range(8): truck.blit(rotate(im,math.pi/2+d*math.pi/4),d*128,0)
save('truck',truck)

people=Image(512,128)
for role,coat in enumerate([TEAL,'#dd9e56','#d46e65','#8e9ec2']):
    for phase in range(4):
        for d in range(4):
            p=Image(32,32);p.rect(10,25,14,3,'#53684f')
            step=[0,2,0,-2][phase]
            p.rect(12,22,3,6-step,INK);p.rect(18,22,3,6+step,INK)
            p.rect(10,13,14,11,INK);p.rect(11,13,12,9,coat);p.rect(12,14,2,7,WHITE)
            p.rect(8,14+step,3,9,'#deb58b');p.rect(24,14-step,3,9,'#deb58b')
            p.rect(12,5,10,9,'#deb58b');p.rect(13,6,8,5,'#f0cda1');p.rect(11,4,12,4,INK)
            p.rect(11,6,12,2,TEAL if role==0 else '#8d6853');p.rect(19 if d==0 else 13,9,2,2,INK)
            if d==3:p.rect(12,6,10,7,INK)
            elif d==1:p.rect(13,9,2,2,INK);p.rect(19,9,2,2,INK)
            people.blit(p,(phase*4+d)*32,role*32)
save('people',people)

# Open shop section: roof at the rear, visible shelves, cashier and doors.
shop=Image(352,160)
shop.rect(4,24,344,134,'#496053');shop.rect(0,10,352,126,'#334c4c')
shop.rect(6,34,340,94,'#ddcda9');shop.rect(10,38,332,87,'#cbbd9d')
for y in range(38,125,16): shop.rect(10,y,332,1,'#b6aa90')
for x in range(10,344,16): shop.rect(x,38,1,87,'#b6aa90')
shop.rect(0,0,352,40,INK);shop.rect(0,0,352,5,'#526b6b');shop.rect(0,30,352,8,AMBER);shop.rect(8,8,336,2,'#617574')
eagle(shop,16,13,2)
# Shelves and refrigerator at the back.
for x in [18,62,106,258,302]:
    shop.rect(x,46,30,28,INK);shop.rect(x+2,48,26,22,'#667e76')
    for y in [50,60]:
        for xx in range(x+4,x+26,6):shop.rect(xx,y,4,7,[TEAL,AMBER,'#d67f57'][(xx+y)%3])
    shop.rect(x,70,30,4,WHITE)
shop.rect(224,81,46,21,INK);shop.rect(222,78,50,12,'#c79a5d');shop.rect(224,79,46,3,'#efcd8e')
shop.rect(230,69,13,12,INK);shop.rect(232,71,9,6,TEAL);shop.rect(251,71,7,8,WHITE)
for x,w in [(0,144),(272,80)]:
    shop.rect(x,108,w,25,INK);shop.rect(x+4,110,w-8,17,'#63928f');shop.rect(x+6,111,w-12,2,'#afd0be')
    for xx in range(x+10,x+w-6,26):shop.rect(xx,112,2,15,'#e9d9b4')
shop.rect(144,127,128,5,AMBER)
save('shop',shop)

pump=Image(256,64)
for frame in range(4):
    p=Image(64,64);p.rect(8,51,49,6,'#627267');p.rect(10,48,42,6,'#c6c4a6');p.rect(16,11,24,40,INK)
    p.rect(17,8,22,13,AMBER);p.rect(19,22,18,27,WHITE);p.rect(20,24,16,9,INK);p.rect(22,26,12,3,TEAL if frame else '#d5e49c')
    p.rect(23,36,10,8,TEAL);p.rect(20,47,17,3,'#9eb3a6');p.rect(39,23,3,20,INK);p.rect(41,39,7,3,INK);p.rect(46,23,3,17,INK);p.rect(42,21,7,4,INK)
    p.rect(19,4,20,4,TEAL);p.rect(24,36,4,2+frame*2,AMBER);eagle(p,22,10);pump.blit(p,frame*64,0)
save('pump',pump)

tree=Image(96,96)
tree.circle(52,75,29,'#597851');tree.rect(43,44,9,34,'#705f44');tree.rect(45,48,3,26,'#a08752')
for x,y,r in [(45,33,28),(25,39,18),(63,41,24),(43,16,18)]:
    tree.circle(x+2,y+5,r,'#365c49');tree.circle(x,y,r-2,'#4e7950');tree.circle(x-4,y-6,r-7,'#709453')
for x,y in [(21,32),(43,11),(61,34),(32,51)]:tree.rect(x,y,8,3,'#93ad62')
save('tree',tree)

def paved(x,y): return 153<=y<=166 or 96<=x<153 and 115<=y<155 or 136<=x<161 and 96<=y<160
def frame(x,y):
    if 112<=x<134 and 106<=y<114:return 7
    if 153<=y<=166:return 5
    if paved(x,y):return 4
    if 110<=x<136 and 104<=y<115:return 6
    lake=(x-204)**2/600+(y-83)**2/450
    if lake<1:return 12+(x+y)%2
    if lake<1.2:return 6
    if (14<x<87 and 74<y<139) or (168<x<231 and 179<y<222):return 10+(x//16)%2
    return (x*13+y*19)%4
def runs(values):
    out=[]
    for v in values:
        if out and out[-1][0]==v:out[-1][1]+=1
        else:out.append([v,1])
    return out
sectors=[]
for sy in range(8):
    for sx in range(8):
        id=f's{sx}-{sy}';sectors.append(dict(id=id,x=sx,y=sy,url=f'sectors/{id}.json'))
        data=dict(schemaVersion=1,id=id,revision='orlar-1',layers=[dict(name='ground',runs=runs([frame(sx*32+x,sy*32+y) for y in range(32) for x in range(32)]))])
        (OUT/f'sectors/{id}.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
world=dict(schemaVersion=2,id='orlar-krajowka',width=256,height=256,tileSize=16,rulesRevision='opening-1',scenario=dict(id='opening-slice',seed=20261114,duration=7200,goal=12),camera=dict(zoom=.5,minZoom=.5,maxZoom=2,center=dict(x=126,y=128)),terrain=dict(revision='orlar-1',sectorSize=32,texture='station-tiles',frames=16,fallbackColor=0x738f58,cacheSectors=48,sectors=sectors))
(OUT/'world.json').write_text(json.dumps(world,indent=2)+'\n')

# Catalog illustration composed from the same original pixels.
cover=Image(640,360,'#738f58')
for y in range(0,360,16):
    for x in range(0,640,16):
        tile=Image(16,16)
        for yy in range(16):
            for xx in range(16):tile.pixels[yy*16+xx]=atlas.pixels[yy*256+((x+y)//16%4)*16+xx]
        cover.blit(tile,x,y)
cover.rect(64,126,512,172,'#9dada3');cover.rect(0,288,640,72,'#465d61')
for x in range(0,640,40):cover.rect(x,320,24,3,'#ded5ab')
cover.blit(shop,145,31)
first_pump=Image(64,64)
for yy in range(64):
    for xx in range(64):first_pump.pixels[yy*64+xx]=pump.pixels[yy*256+xx]
for x in [213,337,461]:cover.blit(first_pump,x,185)
for x,y,n in [(294,196,0),(415,213,1),(85,297,2)]:
    c=Image(64,64)
    for yy in range(64):
        for xx in range(64):c.pixels[yy*64+xx]=cars.pixels[(n*64+yy)*1024+xx+12*64]
    cover.blit(c,x,y)
for x,y in [(10,14),(525,23),(18,174),(535,177)]:cover.blit(tree,x,y)
cover.rect(83,84,8,117,INK);cover.rect(65,60,52,63,INK);eagle(cover,70,69,2);cover.rect(72,98,37,3,AMBER);cover.rect(72,110,28,3,TEAL)
save('cover',cover)
print('Generated original ORLAR art, 64 sectors and world manifest.')
