"""The mean over the head band did NOT catch the green hair — measured: before
   the fix the hair was visibly green and the head-band mean hue read 45.7,
   comfortably inside the 0-60 band, because the face is four times the area
   and drags the average back. A metric that averages over a region cannot see
   a thing that happens to a PART of that region.

   So split the region by what separates hair from skin in the unfoiled frame:
   brightness. Hair is the dark warm, skin is the light warm."""
import sys, json, colorsys
exec(open(sys.argv[0].rsplit('/',1)[0] + '/foildiff.py').read().split("on_p, off_p")[0])
on_p, off_p, meta_p = sys.argv[1], sys.argv[2], sys.argv[3]
meta=json.load(open(meta_p)); sc=meta['scale']
w,h,c1,A=read_png(on_p); _,_,c2,B=read_png(off_p)

def part(card, vlo, vhi):
    x0=int(card['x']*sc); y0=int((card['y']+card['h']*0.18)*sc)
    x1=x0+int(card['w']*sc); y1=int((card['y']+card['h']*0.32)*sc)
    n=0; sb=[0,0,0]; sa=[0,0,0]; worst=0; greenish=0
    for y in range(y0,y1):
        rb=y*w*c2; ra=y*w*c1
        for x in range(x0,x1):
            pb=rb+x*c2
            hh,ss,vv=colorsys.rgb_to_hsv(B[pb]/255,B[pb+1]/255,B[pb+2]/255)
            if not (hh*360<=60 and ss>0.25 and vlo<=vv<vhi): continue
            pa=ra+x*c1; n+=1
            for k in range(3): sb[k]+=B[pb+k]; sa[k]+=A[pa+k]
            ha=colorsys.rgb_to_hsv(A[pa]/255,A[pa+1]/255,A[pa+2]/255)[0]*360
            # 90-210 is the ruled forbidden arc: the complement of warm. The
            # band came from four real cards — magenta and purple hair were
            # looked at and passed, green and cyan were looked at and refused
            # — so it encodes a judgement that was actually made rather than
            # one derived from where the warm colours happen to live.
            if 90 <= ha <= 210: greenish+=1
    if not n: return None
    mb=[v/n/255 for v in sb]; ma=[v/n/255 for v in sa]
    hexf=lambda m:'#%02X%02X%02X'%tuple(min(255,max(0,round(v*255))) for v in m)
    return n, colorsys.rgb_to_hsv(*mb)[0]*360, colorsys.rgb_to_hsv(*ma)[0]*360, greenish/n, hexf(mb), hexf(ma)

for label, lo, hi in [('HAIR  (dark warm)', 0.15, 0.42), ('SKIN  (light warm)', 0.42, 1.01)]:
    print(f"\n-- {label}, head band 18-32% --")
    print(f"{'rarity':8} {'px':>7} {'hue before':>11} {'hue after':>10} {'px in 90-210':>14}  colour")
    for card in meta['cards']:
        r=part(card, lo, hi)
        if not r: print(f"{card['rarity']:8}  (none)"); continue
        n,hb,ha,g,cb,ca=r
        print(f"{card['rarity']:8} {n:>7} {hb:10.1f}° {ha:9.1f}° {g*100:13.1f}%  {cb} -> {ca}")
