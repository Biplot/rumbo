import json,re
E=json.load(open('../prop3/etapas.json'))['svgs']
def clean(s): return re.sub(r' role="img" aria-label="[^"]*"','',re.sub(r' class="ele-svg[^"]*"','',s,1)).replace('<svg ','<svg width="100%" ',1)
s=open('landing.tpl.html').read()
s=s.replace('<div style="width:110px">{{ELE}}Cría</div><div style="width:170px">{{ELE}}Joven</div><div style="width:230px">{{ELE}}Sabio</div>',
 '<div>{{E0}}Cría</div><div>{{E1}}Joven</div><div>{{E3}}Sabio</div>')
s=s.replace('{{E0}}',clean(E[0])).replace('{{E1}}',clean(E[1])).replace('{{E3}}',clean(E[3])).replace('{{ELE}}',clean(E[2]))
open('/home/user/rumbo/conoce/index.html','w').write(s)
