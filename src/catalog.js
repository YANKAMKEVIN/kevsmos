// @ts-check
/** Catalogue : étoiles nommées, constellations, objets de Messier, noms français. Sans DOM. */
import { A, TXT, esc } from './util.js';
import { altAz, colorName, dirName, eqVec, fmtDay, nf, phaseName, riseSet, simDate, wv } from './astro.js';
import { etat } from './state.js';

/* ---------- Données ---------- */
const FR_STAR={Vega:'Véga',Betelgeuse:'Bételgeuse',Aldebaran:'Aldébaran',Altair:'Altaïr',Antares:'Antarès',Polaris:'Étoile polaire',Regulus:'Régulus',Spica:'Spica (l’Épi)',Deneb:'Déneb','Rigil Kentaurus':'Alpha du Centaure',Toliman:'Alpha du Centaure B',Hadar:'Hadar'};
export const MES_FR={M31:'Galaxie d’Andromède',M42:'Nébuleuse d’Orion',M45:'Les Pléiades',M44:'La Crèche',M13:'Amas d’Hercule',M8:'Nébuleuse de la Lagune',M7:'Amas de Ptolémée',M6:'Amas du Papillon',M22:'Amas du Sagittaire',M24:'Nuage du Sagittaire',M41:'Amas de Sirius',M33:'Galaxie du Triangle',M81:'Galaxie de Bode'};
export const DSO_T={gc:'Amas globulaire',oc:'Amas ouvert',pn:'Nébuleuse planétaire',bn:'Nébuleuse',en:'Nébuleuse',rn:'Nébuleuse',dn:'Nébuleuse obscure',snr:'Reste de supernova',sfr:'Région de formation d’étoiles'};
export const consName=id=>etat.consById[id]?etat.consById[id].fr.replace(/ /g,' '):id;
const GREEK={'α':'Alpha','β':'Bêta','γ':'Gamma','δ':'Delta','ε':'Epsilon','ζ':'Zêta','η':'Êta','θ':'Thêta','ι':'Iota','κ':'Kappa','λ':'Lambda','μ':'Mu','ν':'Nu','ξ':'Xi','ο':'Omicron','π':'Pi','ρ':'Rhô','σ':'Sigma','τ':'Tau','υ':'Upsilon','φ':'Phi','χ':'Khi','ψ':'Psi','ω':'Oméga'};
export function parseCatalog(){
  etat.DATA.stars.forEach(s=>{const nm=etat.DATA.names[s[4]];
    if(s[2]<4.6){const o={type:'star',hip:s[4],ra:s[0],dec:s[1],mag:s[2],bv:s[3],eq:eqVec(s[0],s[1])};
      if(nm){o.proper=nm[0];o.c=nm[1];o.bayer=nm[2]}
      o.name=o.proper?(FR_STAR[o.proper]||o.proper):'';
      etat.starObjs.push(o)}});
  etat.DATA.cons.forEach(c=>{etat.consById[c.id]={...c,eq:eqVec(c.c[0],c.c[1])}});
  etat.starObjs.forEach(o=>{if(!o.c){const ci=A.Constellation(o.ra/15,o.dec);o.c=ci.symbol}
    if(!o.proper&&o.bayer){const l=o.bayer.replace(/\d/g,''),n=o.bayer.replace(/\D/g,'');o.name=(GREEK[l]||l)+n+' '+gen(o.c)}});
  etat.messier=etat.DATA.messier.map(m=>({type:'dso',id:m[0],alt_en:m[1],t:m[2],mag:m[3],ra:m[4],dec:m[5],eq:eqVec(m[4],m[5]),name:MES_FR[m[0]]||m[0]}));
}
const GEN={And:'d’Andromède',Ori:'d’Orion',UMa:'de la Grande Ourse',UMi:'de la Petite Ourse',Cas:'de Cassiopée',Cyg:'du Cygne',Lyr:'de la Lyre',Aql:'de l’Aigle',Sco:'du Scorpion',Sgr:'du Sagittaire',Leo:'du Lion',Tau:'du Taureau',Gem:'des Gémeaux',CMa:'du Grand Chien',Cru:'de la Croix du Sud',Cen:'du Centaure',Peg:'de Pégase',Per:'de Persée',Aur:'du Cocher',Boo:'du Bouvier',Vir:'de la Vierge',Her:'d’Hercule',Dra:'du Dragon',Cep:'de Céphée'};
function gen(c){return GEN[c]||('· '+consName(c))}
export function objWorld(o){if(o.type==='body'||o.type==='sat')return o.world;if(o.type==='cons')return wv(o.eq).clone();return wv(o.eq).clone()}
function fact(i,b){return`<div class="fact"><i>${esc(i)}</i><b>${esc(b)}</b></div>`}
export function describe(o){const w=objWorld(o),aa=altAz(w);let title='',kind='',text='',facts='';
  const pos=aa.alt>0?fact('Où',`${nf(aa.alt)}° de haut, ${dirName(aa.az)}`):fact('Où','sous l’horizon');
  if(o.type==='body'){title=o.fr;const T=A.MakeTime(simDate());const rs=o.id==='Sun'||o.id==='Moon'||o.alt<5?riseSet(o.id):null;
    if(o.id==='Sun'){kind='Notre étoile';text=TXT.bodies.Sun;facts=pos+(rs?fact('Lever',fmtDay(rs.r))+fact('Coucher',fmtDay(rs.s)):'')}
    else if(o.id==='Moon'){const ph=A.MoonPhase(T),il=A.Illumination('Moon',T);let full=null;try{full=A.SearchMoonPhase(180,T,40).date}catch(e){}
      kind=phaseName(ph);text=TXT.bodies.Moon;facts=pos+fact('Éclairée',nf(il.phase_fraction*100)+' %')+fact('Distance',nf(Math.round(o.dist*149597.8707)*1000)+' km')+(rs?fact('Lever',fmtDay(rs.r))+fact('Coucher',fmtDay(rs.s)):'')+(full?fact('Prochaine pleine lune',full.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})):'')}
    else{kind='Planète';text=TXT.bodies[o.id]||'';const km=o.dist*149597870.7,lt=o.dist*499/60;
      facts=pos+fact('Éclat',(o.mag<0?'−':'')+nf(Math.abs(o.mag),1))+fact('Distance',km>1e9?nf(km/1e9,2)+' milliard de km':nf(km/1e6)+' millions de km')+fact('Sa lumière met',lt>60?nf(lt/60,1)+' h':nf(lt)+' min')+fact('Dans',consName(A.Constellation(o.ra/15,o.dec).symbol))+(rs?fact('Lever',fmtDay(rs.r))+fact('Coucher',fmtDay(rs.s)):'')}
    if(o.id==='Sun'&&o.alt>-2)text+=' Le jour, les étoiles sont toujours là, simplement noyées dans la lumière du ciel.'}
  else if(o.type==='star'){title=o.name||('Étoile de magnitude '+nf(o.mag,1));kind=`Étoile ${colorName(o.bv)} · ${consName(o.c)}`;text=TXT.stars[o.proper]||`Une étoile ${colorName(o.bv)} de la constellation ${consName(o.c)}.`+(o.bv>1.3?' Sa couleur trahit une surface plus froide que celle du Soleil.':o.bv<.1?' Sa couleur bleutée trahit une étoile bien plus chaude que le Soleil.':'');
    facts=pos+fact('Éclat',(o.mag<0?'−':'')+nf(Math.abs(o.mag),2))}
  else if(o.type==='cons'){title=consName(o.id);kind='Constellation · '+o.la;text=TXT.cons[o.id]||`Une des 88 constellations officielles du ciel. Son nom latin est ${o.la}.`;
    const br=etat.starObjs.filter(s=>s.c===o.id).sort((a,b)=>a.mag-b.mag)[0];facts=pos+(br&&br.name?fact('Plus brillante',br.name):'')}
  else if(o.type==='dso'){title=o.name;kind=(DSO_T[o.t]||'Galaxie')+' · '+o.id+' · '+consName(A.Constellation(o.ra/15,o.dec).symbol);text=TXT.dso[o.id]||'Un objet du catalogue de Charles Messier, astronome français du XVIIIe siècle. Il le notait pour ne pas le confondre avec une comète.';facts=pos+fact('Éclat',nf(o.mag,1))}
  else if(o.type==='sat'){title=o.fr||o.short;kind='Satellite';text=o.key==='iss'?TXT.iss:o.key==='css'?TXT.css:'Un satellite visible à l’œil nu, éclairé par le Soleil alors que le sol est déjà dans la nuit.';
    facts=pos+fact('Altitude',nf(o.h||0)+' km')+fact('Vitesse','≈ 27 600 km/h')+(o.lit?fact('État','éclairé par le Soleil'):fact('État','dans l’ombre de la Terre'));
    if(o.key==='iss'&&etat.satPass)facts+=fact('Prochain passage visible',fmtDay(etat.satPass.t)+', '+etat.satPass.dir)}
  return{title,kind,text,facts}}
