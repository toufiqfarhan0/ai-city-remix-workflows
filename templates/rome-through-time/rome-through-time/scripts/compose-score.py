"""Rome, Enduring — original score and sample-free deterministic orchestral synthesis.
Requires numpy. No external recordings, soundfonts, loops, models or paid services.
"""
from pathlib import Path
import argparse
ap=argparse.ArgumentParser();ap.add_argument("--out",required=True);ap.add_argument("--overwrite",action="store_true");args=ap.parse_args()
output_dir=Path(args.out).resolve()
skill_root=Path(__file__).resolve().parents[1]
if output_dir==skill_root or skill_root in output_dir.parents:ap.error("Output must be outside the installed skill.")
output_dir.mkdir(parents=True,exist_ok=True)
import numpy as np, wave, json
SR=48000; DURATION=25; N=SR*DURATION
rng=np.random.default_rng(20261021)
master=np.zeros((N,2),np.float64); events=[]

def note(start,duration,midi,amp,kind='strings',pan=0,release=.4):
 end=min(DURATION,start+duration+release); count=int((end-start)*SR)
 if count<=0:return
 t=np.arange(count)/SR; freq=440*2**((midi-69)/12)
 attack={'strings':.09,'cello':.065,'brass':.055,'choir':.18,'bell':.008}.get(kind,.06)
 env=np.minimum(1,t/attack)**.8
 env*=np.where(t<duration,.86+.14*np.exp(-t*3),np.maximum(0,1-(t-duration)/release)**2)
 sig=np.zeros((count,2)); voices=5 if kind in ['strings','cello'] else 3
 for voice in range(voices):
  detune=(voice-(voices-1)/2)*(.0015 if kind=='brass' else .0025)
  vibrato=.0025*freq/5.3*(1-np.cos(2*np.pi*5.3*t))
  phase=2*np.pi*freq*(1+detune)*t+vibrato+rng.uniform(0,2*np.pi)
  mono=np.zeros(count)
  for k in range(1,17 if kind=='cello' else 13):
   if freq*k>SR*.44:break
   if kind=='brass':weight=np.exp(-k/6)/k**.65*(1+.35*np.exp(-((freq*k-900)/650)**2))
   elif kind=='choir':weight=(.12+np.exp(-((freq*k-700)/180)**2)+.65*np.exp(-((freq*k-1200)/220)**2))/k
   elif kind=='bell':weight=np.exp(-k*.5)/k
   else:weight=(1+.65*np.exp(-((freq*k-520)/350)**2))/k**1.24
   mono+=weight*np.sin(k*phase)
  loc=np.clip(pan+(voice-(voices-1)/2)*.17,-.95,.95)
  sig[:,0]+=mono*np.sqrt((1-loc)/2)/voices;sig[:,1]+=mono*np.sqrt((1+loc)/2)/voices
 sig*=env[:,None]*amp
 i=int(start*SR);master[i:i+count]+=sig
 events.append(dict(start=round(start,4),duration=duration,midi=midi,instrument=kind,amplitude=amp,release=release))

def drum(start,amp=.12):
 duration=1.3;t=np.arange(int(duration*SR))/SR
 phase=2*np.pi*(57*t+26*.07*(1-np.exp(-t/.07)))
 x=(np.sin(phase)+.35*np.sin(1.51*phase)+.18*np.sin(2.13*phase))*np.exp(-t*5)
 x+=rng.normal(0,.07,len(t))*np.exp(-t*35)
 x*=np.minimum(1,t/.005)*amp
 i=int(start*SR);n=min(len(x),N-i)
 if n>0:master[i:i+n]+=x[:n,None]*np.array([.72,.68])
 events.append(dict(start=start,instrument='synthesized timpani',amplitude=amp))

# Ten harmonic fields; the last F-major resolution gives the historic arc a hopeful close.
chords=[(0,2.5,41,[53,56,60]),(2.5,2.5,37,[49,53,56]),(5,2.5,39,[51,55,58]),(7.5,2.5,36,[48,51,55]),(10,2.5,44,[56,60,63]),(12.5,2.5,37,[49,53,56]),(15,2.5,41,[53,56,60]),(17.5,2.5,39,[51,55,58]),(20,2,36,[48,52,55]),(22,1.45,41,[53,57,60,65])]
for start,dur,bass,chord in chords:
 intensity=.65+.35*min(1,start/19)
 note(start,dur-.06,bass,.15*intensity,'cello',-.16,release=.45 if start<22 else 1.45)
 note(start,dur-.08,bass-12,.055,'cello',.12,release=.35 if start<22 else 1.45)
 for j,pitch in enumerate(chord):
  note(start+j*.028,dur-.12,pitch,.068*intensity,'strings',-.40+j*.28,release=.38 if start<22 else 1.45)
  if start>=7.5:note(start+.05+j*.02,dur-.18,pitch+12,.034*intensity,'strings',.38-j*.20,release=.4 if start<22 else 1.45)
  if start>=15:note(start+.08,dur-.22,pitch,.035 if start<22 else .06,'brass',-.25+j*.22,release=.35 if start<22 else 1.45)
  if start>=17.5:note(start+.12,dur-.3,pitch+12,.016,'choir',.2-j*.17,release=.5 if start<22 else 1.45)
# Immediate original motif: fifth, minor third, neighbor, tonic. No ambient prelude.
for t,d,p in [(0,.50,65),(.55,.45,72),(1.05,.40,68),(1.50,.36,67),(1.90,.58,65)]:note(t,d,p,.115,'cello',-.12,release=.22)
# Lower-string pulses through decline, then rising melodic strings at rebirth.
for start,dur,bass,chord in chords[1:9]:
 for j in range(4 if start<15 else 6):
  at=start+j*(.625 if start<15 else .3125)
  if at<start+dur-.15:note(at,.26 if start<15 else .17,chord[j%len(chord)],.040 if start<15 else .048,'cello',-.3,release=.10)
melody=[(8,.7,67),(8.75,.5,68),(9.35,.55,70),(10,.9,72),(11,.55,75),(11.65,.55,73),(12.3,.7,72),(13.1,.5,70),(13.75,.8,72),(14.6,.38,73)]
for t,d,p in melody:note(t,d,p,.08,'strings',.22,release=.25)
for t,d,p in [(15,1,65),(16.15,.7,68),(17,.8,72),(18,1,75),(19.15,.7,74),(20,.7,72),(20.8,.65,67),(21.45,.4,64),(22,1.35,69)]:
 note(t,d,p,.085 if t<22 else .11,'brass',.10,release=.35 if t<22 else 1.5)
 if t>=18:note(t+.04,d,p+12,.032,'strings',-.25,release=.4 if t<22 else 1.45)
for t,a in [(2.5,.055),(5,.07),(7.5,.065),(10,.07),(12.5,.08),(15,.10),(17.5,.10),(19.4,.075),(20,.115),(21.25,.09),(22,.14)]:drum(t,a)
# Algorithmic chamber reflections, made from the original dry signal only.
dry=master.copy()
for delay,gain in [(.071,.12),(.137,.16),(.211,.13),(.293,.11),(.379,.085),(.463,.065),(.613,.045),(.811,.03)]:
 shift=int(delay*SR);master[shift:]+=dry[:-shift,::-1]*gain
# Gentle saturation and ample headroom, with only the final reverb tail tapered.
master=np.tanh(master*.9)
fade=int(.22*SR);master[-fade:]*=np.linspace(1,0,fade)[:,None]**1.5
master*=10**(-3/20)/np.max(np.abs(master))
output=output_dir/'rome-enduring-original-score.wav'
if output.exists() and not args.overwrite:ap.error('Score exists; use a new directory or --overwrite.')
with wave.open(str(output),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((master*32767).astype('<i2').tobytes())
meta={'title':'Rome, Enduring','duration':DURATION,'sample_rate':SR,'channels':2,'seed':20261021,'composition':'Original F-minor historical arc resolving to F major; 96 BPM pulse; strings, cello, restrained brass, synthesized timpani and vowel-like pads.','source':'Locally composed notes and additive synthesis; no third-party audio, loops, samples, soundfonts, paid API or composer imitation.','peak_dbfs':float(20*np.log10(np.max(np.abs(master)))),'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(master**2)))),'events':events}
(output.parent/'score-details.json').write_text(json.dumps(meta,indent=2))
print(output);print('peak',meta['peak_dbfs'],'rms',meta['rms_dbfs'],'events',len(events))
