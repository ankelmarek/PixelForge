"""Original Winobranie map data. Python 3 standard library."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
out=root/'public/assets/games/winobranie'
out.mkdir(parents=True,exist_ok=True)
nodes=[]
for side,x in enumerate([3,22]):
    for i,y in enumerate([6,8,10,12,14,16]):
        nodes.append(dict(id=f'row-{side*6+i+1}',kind='source',x=x,y=y,width=10,height=1,access=dict(x=x+1,y=y+1),texture='vine',stock={'grapes':8},harvestResource='grapes',harvestSeconds=4.5,workPoints=[dict(x=x+1+j,y=y+1) for j in range(8)],stockVisual=dict(texture='fruit',unitSize=1,scale=1,slots=[dict(x=-3.5+j,y=-.5) for j in range(8)])))
slots=[dict(x=(i%3-1)*.6,y=-.15-(i//3)*.45) for i in range(24)]
nodes.append(dict(id='yard',kind='depot',x=13,y=20,width=2,height=2,access=dict(x=16,y=21),texture='depot',stock={},stockVisual=dict(texture='cargo',unitSize=4,scale=.65,slots=slots)))
nodes.append(dict(id='mill',kind='processor',x=29,y=19,width=7,height=4,access=dict(x=31,y=24),texture='press',stock={},recipe=dict(input='grapes',output='juice',inputAmount=4,outputAmount=4,seconds=4,destination='cistern'),stockVisual=dict(texture='cargo',unitSize=4,scale=.65,slots=[dict(x=-2.5+(i%3)*.6,y=-.2-(i//3)*.45) for i in range(24)])))
nodes.append(dict(id='cistern',kind='storage',x=36,y=19,width=2,height=4,access=dict(x=36,y=24),texture='tank',stock={},fillTexture='juice',fillOffset=dict(x=0,y=-14),capacity=96))
actors=[dict(id=f'picker-{i+1}',kind='worker',x=x,y=y,texture='worker',cargoTexture='cargo',capacity=4,speed=2,depot='yard',loadSeconds=.4,unloadSeconds=.5) for i,(x,y) in enumerate([(17,20),(19,21),(17,22)])]
actors.append(dict(id='carrier',kind='vehicle',x=18,y=24,texture='vehicle',cargoTexture='cargo',capacity=16,speed=3,depot='yard',loadSeconds=.4,unloadSeconds=.35))
level=dict(schemaVersion=1,id='vineyard',title='Winobranie',width=40,height=26,tileSize=16,roads=[dict(x=15,y=4,width=6,height=22),dict(x=1,y=22,width=37,height=4),dict(x=1,y=4,width=37,height=2)],blockers=[dict(x=38,y=0,width=2,height=26),dict(x=0,y=0,width=1,height=26),dict(x=1,y=1,width=3,height=2),dict(x=26,y=1,width=4,height=2)],resources=[dict(id='grapes',unitValue=1,icon='fruit'),dict(id='juice',unitValue=1,icon='juice')],nodes=nodes,actors=actors,goal=dict(storage='cistern',resource='juice',amount=96),camera=dict(zoom=.5,minZoom=.5,maxZoom=2,center=dict(x=20,y=14)))
(out/'world.json').write_text(json.dumps(level,indent=2)+'\n')
