import {SAVE_KEY,freshState,restoreState,transition,objective,vocabulary} from './game-state.js';

const $=selector=>document.querySelector(selector);
const room=$('#room'),player=$('#player'),dialogue=$('#dialogue'),panel=$('#panel'),designer=$('#designer');
let state;
try{state=restoreState(localStorage.getItem(SAVE_KEY));}catch{state=freshState();}
let storageAvailable=true,sound=false,translations=false,currentSpeaker='yu',currentLine=null,toastTimer;
let position={x:.55,y:.89},path=[],onArrive=null,lastFrame=0,stepTime=0;
const keys=new Set();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const people={yu:{name:'小雨',role:'喜欢画画的新朋友'},bo:{name:'阿柏',role:'正在搭建小摊位'},ale:{name:'阿乐',role:'材料整理小能手'},teacher:{name:'林老师',role:'社区活动组织者'},cat:{name:'小橘',role:'今天的特别帮手'},board:{name:'照片墙',role:'社区里的共同回忆'}};
const approach={yu:{x:.30,y:.94},bo:{x:.565,y:.69},ale:{x:.64,y:.89},teacher:{x:.76,y:.82},cat:{x:.65,y:.55},board:{x:.77,y:.84}};
const polygons=[
  [[.49,.985],[.81,.985],[.80,.82],[.75,.73],[.72,.63],[.68,.55],[.67,.505],[.62,.505],[.56,.61],[.52,.76]],
  [[.15,.985],[.53,.985],[.53,.88],[.43,.87],[.32,.90],[.18,.90]]
];
const navPoints=[{x:.52,y:.95},{x:.30,y:.94},{x:.20,y:.95},{x:.57,y:.84},{x:.565,y:.69},{x:.62,y:.60},{x:.65,y:.55},{x:.70,y:.68},{x:.76,y:.82},{x:.64,y:.89},{x:.77,y:.94}];
const distance=(a,b)=>Math.hypot((a.x-b.x)*1.777,a.y-b.y);
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>p.y)!==(yj>p.y))&&(p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi))hit=!hit;}return hit;}
function walkable(p){return polygons.some(poly=>inside(p,poly));}
function visible(a,b){const count=Math.ceil(distance(a,b)*100)+2;for(let i=0;i<=count;i++)if(!walkable({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count}))return false;return true;}
function nearestFloor(p){
  if(walkable(p))return p;
  let best=navPoints[0],bestD=Infinity;
  for(let y=.51;y<=.975;y+=.015)for(let x=.16;x<=.80;x+=.015){const q={x,y};if(walkable(q)&&distance(p,q)<bestD){best=q;bestD=distance(p,q);}}
  return best;
}
function findPath(from,to){
  const target=nearestFloor(to);
  if(visible(from,target))return [target];
  const nodes=[from,...navPoints,target],n=nodes.length,dist=new Array(n).fill(Infinity),prev=new Array(n).fill(-1),seen=new Set();dist[0]=0;
  while(seen.size<n){let u=-1;for(let i=0;i<n;i++)if(!seen.has(i)&&(u===-1||dist[i]<dist[u]))u=i;if(u===-1||!Number.isFinite(dist[u]))break;if(u===n-1)break;seen.add(u);for(let v=1;v<n;v++){if(seen.has(v)||!visible(nodes[u],nodes[v]))continue;const d=dist[u]+distance(nodes[u],nodes[v]);if(d<dist[v]){dist[v]=d;prev[v]=u;}}}
  if(!Number.isFinite(dist[n-1]))return [target];
  const route=[];let i=n-1;while(i>0){route.unshift(nodes[i]);i=prev[i];if(i<0)break;}return route;
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{if(storageAvailable){storageAvailable=false;toast('当前浏览器无法保存进度，这次游玩仍可继续。');}}}
function act(action){state=transition(state,action);save();render();}
function render(){
  $('#objective').textContent=objective(state);
  $('[data-step="meet"]').classList.toggle('done',state.metYu);
  $('[data-step="materials"]').classList.toggle('done',state.ribbon&&state.paint);
  $('[data-step="make"]').classList.toggle('done',state.completed);
  $('#word-count').textContent=state.words.length;
  $('#bag-count').textContent=state.completed?'已用好':`${Number(state.ribbon)+Number(state.paint)} / 2`;
  $('#ribbon-object').hidden=state.ribbon;
  $('#cat-hotspot').setAttribute('aria-label',state.ribbon?'和小橘打招呼':'查看小橘和蓝丝带');
  const sign=$('#finished-sign');sign.classList.toggle('visible',state.completed);
  if(state.completed)sign.innerHTML=signSVG(state.design);
}
function paintPlayer(){
  player.style.left=position.x*100+'%';player.style.top=position.y*100+'%';
  const scale=.64+(position.y-.50)*.80;
  player.style.transform=`translate(-50%,-100%) scale(${scale})`;
  player.style.zIndex=position.y>.79?'11':'6';
}
function walkTo(point,done=null){path=findPath(position,point);onArrive=done;$('#walk-marker').style.left=point.x*100+'%';$('#walk-marker').style.top=point.y*100+'%';$('#walk-marker').classList.remove('show');void $('#walk-marker').offsetWidth;$('#walk-marker').classList.add('show');}
function closeDialogue(){dialogue.hidden=true;document.querySelectorAll('.hotspot.active').forEach(el=>el.classList.remove('active'));if(window.speechSynthesis)window.speechSynthesis.cancel();}
function enterTarget(target){
  if(!state.started){toast('先推开门，走进活动室吧。');return;}
  closeDialogue();
  document.querySelector(`.hotspot[data-target="${target}"]`)?.classList.add('active');
  walkTo(approach[target],()=>interact(target));
}
function loop(time){
  const dt=Math.min((time-lastFrame)/1000,.045)||0;lastFrame=time;
  let moving=false;
  if(state.started&&!panel.open&&!designer.open&&dialogue.hidden){
    const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    if(dx||dy){path=[];onArrive=null;const mag=Math.hypot(dx,dy),speed=.20;const next={x:position.x+dx/mag*speed*dt/1.777,y:position.y+dy/mag*speed*dt};if(walkable(next)){position=next;moving=true;}if(dx)player.classList.toggle('facing-left',dx<0);}
  }
  if(path.length&&!panel.open&&!designer.open){
    const target=path[0],d=distance(position,target),speed=.44;
    if(d<speed*dt+.002){position={...target};path.shift();if(!path.length&&onArrive){const done=onArrive;onArrive=null;done();}}
    else{const ratio=speed*dt/d;player.classList.toggle('facing-left',target.x<position.x-.001);position={x:position.x+(target.x-position.x)*ratio,y:position.y+(target.y-position.y)*ratio};moving=true;}
  }
  player.classList.toggle('walking',moving&&!reducedMotion);paintPlayer();
  if(moving){stepTime+=dt;if(stepTime>.36){stepTime=0;/* movement remains quiet so speech stays clear */}}
  requestAnimationFrame(loop);
}
function speak(text){
  if(!('speechSynthesis'in window)){toast('当前浏览器不能播放语音，可以直接阅读对话。');return;}
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=.82;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('zh'));if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
}
function chime(){
  if(!sound)return;
  try{const Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx();for(const [i,freq]of [523.25,659.25,783.99].entries()){const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+i*.1;osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.025,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.7);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.75);}setTimeout(()=>ctx.close(),1200);}catch{}
}
function show(speaker,text,pinyin,english,choices=[],chat=true){
  currentSpeaker=speaker;currentLine={text,pinyin,english};
  const info=people[speaker];$('#speaker-name').textContent=info.name;$('#speaker-role').textContent=info.role;
  $('#dialogue-text').textContent=text;$('#dialogue-pinyin').textContent=pinyin||'';$('#dialogue-english').textContent=english||'';
  $('#dialogue-pinyin').hidden=!translations||!pinyin;$('#dialogue-english').hidden=!translations||!english;
  $('#chat-form').hidden=!chat;
  const choiceBox=$('#dialogue-choices');choiceBox.replaceChildren();
  for(const option of choices){const b=document.createElement('button');b.type='button';b.className='choice-button'+(option.secondary?' secondary':'');b.textContent=option.label;b.addEventListener('click',option.run);choiceBox.appendChild(b);}
  dialogue.hidden=false;if(sound)speak(text);
}
const leave=(label='我再去看看')=>({label,secondary:true,run:closeDialogue});
function yu(){
  if(state.completed){show('yu',`小禾，你来啦！你选的“${state.design.title}”真好看。下次的集市，我们还一起准备，好吗？`,'Xiǎo Hé, nǐ lái la! Nǐ xuǎn de zhāopai zhēn hǎokàn. Xià cì wǒmen hái yìqǐ zhǔnbèi, hǎo ma?','You are back! I love the sign you chose. Shall we help with the next market together?',[{label:'好呀，我们说好了！',run:()=>{toast('小雨记住了：下次还想和你一起准备集市');closeDialogue();}},leave('我去看看大家')]);return;}
  if(!state.metYu){show('yu','你好！我叫小雨。我们在给周末集市做招牌，你愿意一起帮忙吗？','Nǐ hǎo! Wǒ jiào Xiǎo Yǔ. Wǒmen zài gěi zhōumò jíshì zuò zhāopai, nǐ yuànyì yìqǐ bāngmáng ma?','Hi, I’m Xiaoyu. We are making a sign for the weekend market. Would you like to help?',[{label:'你好，我叫小禾。我来帮忙！',run:()=>{act({type:'MEET_YU'});show('yu','太好了！还差一条蓝丝带和一些颜料。你可以问问阿柏，再去找阿乐。','Tài hǎo le! Hái chà yì tiáo lán sīdài hé yìxiē yánliào. Nǐ kěyǐ wènwen Ā Bǎi, zài qù zhǎo Ā Lè.','Wonderful! We need a blue ribbon and some paint. Ask Abo about the ribbon, then find Ale.',[{label:'蓝丝带和颜料，交给我吧。',run:closeDialogue}]);}},leave('我想先逛一逛')]);return;}
  if(state.ribbon&&state.paint){show('yu','丝带和颜料都找到了！招牌该用什么颜色，画什么图案呢？这次听你的。','Sīdài hé yánliào dōu zhǎodào le! Zhāopai gāi yòng shénme yánsè, huà shénme tú’àn ne? Zhè cì tīng nǐ de.','You found everything! What color and picture shall we use? You get to choose.',[{label:'我们一起做招牌吧！',run:openDesigner},leave('让我再想想')]);return;}
  const missing=!state.ribbon&&!state.paint?'蓝丝带和颜料':!state.ribbon?'蓝丝带':'颜料';
  show('yu',`还差${missing}。别着急，阿柏和阿乐都在这里，可以问问他们。`,'Bié zháojí, Ā Bǎi hé Ā Lè dōu zài zhèlǐ, kěyǐ wènwen tāmen.','We still need a few things. Abo and Ale are here — you can ask them.',[{label:'我去问问。',run:closeDialogue}]);
}
function bo(){
  if(state.completed){show('bo','招牌做好了，我的小摊位也快搭好了！等集市开始，你想先逛哪一个摊位？','Zhāopai zuò hǎo le, wǒ de xiǎo tānwèi yě kuài dā hǎo le! Nǐ xiǎng xiān guàng nǎ yí ge tānwèi?','Our sign is ready, and my little stall is nearly finished! Which stall would you visit first?',[{label:'当然是你的摊位！',run:()=>{toast('阿柏开心地给你留了一个位置');closeDialogue();}},leave()]);return;}
  show('bo','你在找蓝丝带吗？刚才小橘叼着它跑到窗边了。跟它轻轻说话试试。','Nǐ zài zhǎo lán sīdài ma? Gāngcái Xiǎo Jú diāozhe tā pǎo dào chuāngbiān le. Gēn tā qīngqīng shuōhuà shìshi.','Looking for the blue ribbon? Xiaoju took it to the window. Try asking gently.',[{label:'蓝丝带在窗边，谢谢你！',run:()=>{act({type:'CAT_CLUE'});toast('新线索：去窗边找小橘');closeDialogue();}},leave('我先看看你做的小摊位')]);
}
function paintChoices(){return [{label:'我想借薄荷绿的颜料。',run:()=>takePaint('mint')},{label:'我想借蜜桃粉的颜料。',run:()=>takePaint('peach')},{label:'我想借暖阳黄的颜料。',run:()=>takePaint('sun')}];}
function takePaint(color){const names={mint:'薄荷绿',peach:'蜜桃粉',sun:'暖阳黄'};act({type:'GET_PAINT',color});chime();show('ale',`给你！${names[color]}看起来很温暖。做好后，记得给我看看哦。`,'Gěi nǐ! Zuò hǎo hòu, jìde gěi wǒ kànkan o.','Here you go! Remember to show me when you are done.',[{label:'谢谢！我会把它放好的。',run:()=>{closeDialogue();toast('颜料已放进小背包');}}]);}
function ale(){
  if(state.completed){show('ale','我看见你们做的招牌了！这几盒颜料有了一个特别好的去处。','Wǒ kànjiàn nǐmen zuò de zhāopai le! Zhè jǐ hé yánliào yǒu le yí ge tèbié hǎo de qùchù.','I saw your sign! I am glad our paints became part of something special.',[leave('多亏了你的颜料！')]);return;}
  if(state.paint){show('ale','颜料已经在你的背包里啦。颜色还可以在做招牌的时候调整。','Yánliào yǐjīng zài nǐ de bēibāo lǐ la. Yánsè hái kěyǐ zài zuò zhāopai de shíhou tiáozhěng.','The paint is in your bag. You can still choose another color when making the sign.',[leave('好，我去找小雨。')]);return;}
  show('ale','我正在整理材料。你想借哪一种颜色的颜料？','Wǒ zhèngzài zhěnglǐ cáiliào. Nǐ xiǎng jiè nǎ yì zhǒng yánsè de yánliào?','I am sorting our supplies. Which color paint would you like to borrow?',paintChoices());
}
function cat(){
  if(state.ribbon){show('cat','喵——小橘打了一个哈欠。蓝丝带已经在你的背包里了。','Miāo — Xiǎo Jú dǎ le yí ge hāqian. Lán sīdài yǐjīng zài nǐ de bēibāo lǐ le.','Meow! Xiaoju yawns. The blue ribbon is already in your bag.',[{label:'谢谢你，小橘。',run:closeDialogue}],false);return;}
  act({type:'CAT_CLUE'});show('cat','小橘正用爪子拨弄蓝丝带。它抬起头，等你开口。','Xiǎo Jú zhèng yòng zhuǎzi bōnong lán sīdài. Tā táiqǐ tóu, děng nǐ kāikǒu.','Xiaoju is playing with the blue ribbon. The little cat looks up at you.',[{label:'小橘，请把蓝丝带给我，好吗？',run:()=>{act({type:'GET_RIBBON'});chime();show('cat','喵！小橘松开了爪子，把丝带轻轻推到你面前。','Miāo! Xiǎo Jú sōngkāi le zhuǎzi, bǎ sīdài qīngqīng tuī dào nǐ miànqián.','Meow! Xiaoju lets go and gently pushes the ribbon toward you.',[{label:'拿起丝带，谢谢小橘！',run:()=>{closeDialogue();toast('获得蓝丝带 · 已放进小背包');}}],false);}},{label:'丝带快给我！',secondary:true,run:()=>show('cat','小橘往后缩了缩。也许温柔一点，它就愿意分享。','Xiǎo Jú wǎng hòu suō le suō. Yěxǔ wēnróu yìdiǎn, tā jiù yuànyì fēnxiǎng.','Xiaoju steps back a little. A gentler request might help.',[{label:'我再轻轻问一次。',run:cat}],false)}],false);
}
function teacher(){
  if(state.completed){show('teacher','你和大家一起完成了一块招牌。这张照片会留在我们的社区回忆里。欢迎你，小禾。','Nǐ hé dàjiā yìqǐ wánchéng le yí kuài zhāopai. Zhè zhāng zhàopiàn huì liú zài wǒmen de shèqū huíyì lǐ. Huānyíng nǐ, Xiǎo Hé.','You made something together. This moment belongs in our community memories. Welcome, Xiaohe.',[{label:'看看我们的第一段回忆。',run:()=>{closeDialogue();openMemories();}},leave()]);return;}
  show('teacher','欢迎来活动室！小雨在做招牌，阿乐在整理颜料。这里有你能帮忙的地方，也有你可以慢慢认识的朋友。','Huānyíng lái huódòngshì! Xiǎo Yǔ zài zuò zhāopai, Ā Lè zài zhěnglǐ yánliào. Zhèlǐ yǒu nǐ kěyǐ mànmàn rènshi de péngyou.','Welcome! Xiaoyu is making a sign and Ale is sorting paints. Take your time meeting everyone.',[{label:'我先去认识小雨。',run:()=>enterTarget('yu')},leave('我想自己逛逛。')]);
}
function interact(target){
  if(target==='yu')yu();else if(target==='bo')bo();else if(target==='ale')ale();else if(target==='cat')cat();else if(target==='teacher')teacher();else{openMemories();}
}
function localReply(input){
  const text=input.trim(),normalized=text.toLowerCase().replace(/\s/g,'');if(!text)return;
  if(currentSpeaker==='cat'){if(/请|好吗|please|谢谢/.test(normalized)&&!state.ribbon){act({type:'GET_RIBBON'});chime();show('cat','喵！小橘听见你温柔的请求，松开了蓝丝带。','Miāo! Xiǎo Jú tīngjiàn nǐ wēnróu de qǐngqiú, sōngkāi le lán sīdài.','Meow! Xiaoju hears your gentle request and lets go of the ribbon.',[{label:'谢谢小橘！',run:()=>{closeDialogue();toast('获得蓝丝带');}}],false);}else cat();return;}
  if(/丝带|ribbon|蓝色|blue|小橘|窗边/.test(normalized)){
    act({type:'CAT_CLUE'});show(currentSpeaker,state.ribbon?'蓝丝带已经在你的背包里啦。':'我看见小橘带着蓝丝带去了窗边。你可以轻轻问问它。',state.ribbon?'Lán sīdài yǐjīng zài nǐ de bēibāo lǐ la.':'Nǐ kěyǐ qīngqīng wènwen Xiǎo Jú.','The blue ribbon is '+(state.ribbon?'in your bag.':'with Xiaoju by the window.'),[{label:state.ribbon?'我知道啦。':'我去找小橘。',run:()=>state.ribbon?closeDialogue():enterTarget('cat')}]);return;
  }
  if(/颜料|paint|颜色|color|colour/.test(normalized)){if(currentSpeaker==='ale')ale();else show(currentSpeaker,'阿乐就在材料箱旁边，她整理了好多颜色。可以去问问她。','Ā Lè jiù zài cáiliàoxiāng pángbiān, kěyǐ qù wènwen tā.','Ale is beside the supply box. Ask her about the paints.',[{label:'我去问阿乐。',run:()=>enterTarget('ale')}]);return;}
  if(/你好|hello|名字|name|认识/.test(normalized)){
    if(currentSpeaker==='yu'&&!state.metYu){act({type:'MEET_YU'});yu();return;}
    show(currentSpeaker,`你好，小禾！我是${people[currentSpeaker].name}，很高兴认识你。`,'Nǐ hǎo, Xiǎo Hé! Hěn gāoxìng rènshi nǐ.','Hello, Xiaohe! It is lovely to meet you.',[{label:'我能帮什么忙？',run:()=>currentSpeaker==='ale'?ale():currentSpeaker==='yu'?yu():teacher()},leave()]);return;
  }
  if(/帮|help|招牌|集市|sign|market/.test(normalized)){if(currentSpeaker==='yu')yu();else show(currentSpeaker,'小雨正在做集市招牌。你可以和她一起准备。','Xiǎo Yǔ zhèngzài zuò jíshì zhāopai. Nǐ kěyǐ hé tā yìqǐ zhǔnbèi.','Xiaoyu is making the market sign. You can help her.',[{label:'我去找小雨。',run:()=>enterTarget('yu')}]);return;}
  if(/谢谢|thank/.test(normalized)){show(currentSpeaker,'不客气！和朋友一起做事情，很开心。','Bú kèqi! Hé péngyou yìqǐ zuò shìqing, hěn kāixīn.','You are welcome! It is fun doing things with friends.',[leave('我们一会儿见。')]);return;}
  show(currentSpeaker,'我还没完全听明白。你想问丝带在哪里，还是想一起做招牌？','Nǐ xiǎng wèn sīdài zài nǎlǐ, háishi xiǎng yìqǐ zuò zhāopai?','Would you like to ask about the ribbon, or help with the sign?',[{label:'蓝丝带在哪里？',run:()=>localReply('蓝丝带在哪里')},{label:'我想帮忙做招牌。',run:()=>localReply('帮忙做招牌')},leave()]);
}
function showPanel(eyebrow,title,html){closeDialogue();path=[];onArrive=null;$('#panel-eyebrow').textContent=eyebrow;$('#panel-title').textContent=title;$('#panel-content').innerHTML=html;panel.showModal();}
function openBag(){
  let html='';
  if(state.ribbon)html+='<div class="item-row"><span class="item-symbol" style="color:#5b8fb7">⋈</span><div><h3>蓝丝带</h3><p>从小橘那里取回来的。'+(state.completed?'已经系在招牌上。':'可以用来装饰招牌。')+'</p></div></div>';
  if(state.paint)html+='<div class="item-row"><span class="item-symbol">◒</span><div><h3>一盒颜料</h3><p>阿乐借给你的。'+(state.completed?'变成了招牌上的颜色。':'想一想，你最喜欢什么颜色？')+'</p></div></div>';
  if(!html)html='<p class="empty-note">背包里还空空的。<br>和新朋友聊聊，也许有人正需要帮助。</p>';
  showPanel('带着一点小小的心意','小禾的背包',html);
}
function openWords(){
  let html=state.words.length?'':'<p class="empty-note">和朋友交流、发现物品时，<br>遇见的词语会留在这里。</p>';
  for(const key of state.words){const v=vocabulary[key];html+=`<div class="word-row"><strong>${v.word}</strong><div><span>${v.pinyin}</span><small>${v.english}</small></div><button type="button" data-word="${key}" aria-label="听${v.word}的读音">♪</button></div>`;}
  showPanel('今天遇见的中文','我的词语本',html);panel.querySelectorAll('[data-word]').forEach(b=>b.addEventListener('click',()=>speak(vocabulary[b.dataset.word].word)));
}
function openMemories(){
  if(!state.completed){showPanel('属于你和这里的回忆','社区照片墙','<figure class="memory-photo"><img src="assets/activity-room.png" alt="大家一起为集市做准备"><figcaption>这里，正等着你的第一段故事。</figcaption></figure><p>小雨的招牌还没做完。等你们一起完成，第一段共同回忆就会留在这里。</p>');return;}
  const color={mint:'薄荷绿',peach:'蜜桃粉',sun:'暖阳黄'}[state.design.color],motif={cat:'小猫',flower:'花朵',star:'星星'}[state.design.motif];
  showPanel('社区回忆 01','第一次一起做招牌',`<div class="memory-sign">${signSVG(state.design)}</div><p class="memory-title">“${state.design.title}”</p><p>你和小雨选了${color}，画上${motif}，系好了从小橘那里取回的蓝丝带。阿乐的颜料，也成为了这块招牌的一部分。</p><p style="margin-top:14px">小雨记得：你是愿意一起帮忙的新朋友。</p>`);
}
function help(){showPanel('在这里慢慢探索','怎么玩',`<div class="help-list"><div><strong>走进房间</strong><p>点击空地，小禾会沿过道走过去。也可以用方向键或 W A S D 移动。</p></div><div><strong>认识新朋友</strong><p>点击人物头上的名字，走近后就能说话。E 键会与附近的人物互动。</p></div><div><strong>一起完成一件事</strong><p>认识小雨，找回蓝丝带、借到颜料，再回到她身边制作招牌。</p></div><div><strong>需要一点语言帮助？</strong><p>对话里的“拼音 / English”可以展开提示。“听一遍”播放当前句子。</p></div><div><strong>下次再来</strong><p>进度保存在当前浏览器。完成后，再和大家聊聊，会听见新的回应。</p></div></div><button class="reset-button" id="ask-reset" type="button">重新开始这段故事</button>`);$('#ask-reset').addEventListener('click',confirmReset);}
function confirmReset(){showPanel('重新体验','再认识一次大家？','<p>这会清除这个浏览器里的本次故事进度、词语和回忆。</p><div class="reset-confirm"><button id="confirm-reset" class="choice-button" type="button">确认重新开始</button><button id="cancel-reset" class="choice-button secondary" type="button">保留回忆</button></div>');$('#cancel-reset').addEventListener('click',()=>panel.close());$('#confirm-reset').addEventListener('click',()=>{state=freshState();save();panel.close();keys.clear();path=[];onArrive=null;position={x:.55,y:.89};room.classList.remove('started');$('#intro').classList.remove('closed');$('#start-button').firstChild.textContent='走进活动室 ';$('#resume-note').textContent='一段可以慢慢玩的社区小故事';render();paintPlayer();});}
function motifSVG(motif){
  if(motif==='flower')return '<g transform="translate(200 158)"><g fill="#d88765"><ellipse cy="-30" rx="17" ry="28"/><ellipse cy="-30" rx="17" ry="28" transform="rotate(72)"/><ellipse cy="-30" rx="17" ry="28" transform="rotate(144)"/><ellipse cy="-30" rx="17" ry="28" transform="rotate(216)"/><ellipse cy="-30" rx="17" ry="28" transform="rotate(288)"/></g><circle r="22" fill="#f4da89"/><path d="M0 22V84M0 58C-38 44-47 58 0 70M0 48C31 30 45 47 0 61" fill="none" stroke="#698564" stroke-width="7" stroke-linecap="round"/></g>';
  if(motif==='star')return '<g fill="#c99257"><path d="m200 105 20 43 47 6-35 34 9 48-41-23-42 23 9-48-35-34 48-6z"/><path d="m112 125 7 15 17 2-12 12 3 16-15-8-14 8 3-16-12-12 16-2zM284 180l7 15 17 2-12 12 3 16-15-8-14 8 3-16-12-12 16-2z"/></g>';
  return '<g transform="translate(200 170)"><path d="M-57-18-58-64-23-40Q0-49 23-40L58-64 57-18Q72 25 42 49Q0 74-42 49Q-72 25-57-18Z" fill="#e1ad73" stroke="#a7784c" stroke-width="4"/><path d="m-47-44 16 12-17 7M47-44 31-32l17 7" fill="#edb1a3"/><ellipse cx="-23" cy="5" rx="4" ry="6" fill="#536449"/><ellipse cx="23" cy="5" rx="4" ry="6" fill="#536449"/><path d="m-6 20 6 5 6-5M0 25v8m0 0q-9 11-16 1m16-1q9 11 16 1M-43 18l-25-5M-43 28l-25 6M43 18l25-5M43 28l25 6" fill="none" stroke="#8a6848" stroke-width="3" stroke-linecap="round"/></g>';
}
function signSVG(design){
  const color={mint:'#b7d4bd',peach:'#edc3ac',sun:'#ead28b'}[design.color]||'#b7d4bd';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 350" role="img" aria-label="集市招牌：${design.title}"><path d="M88 43Q200-26 312 43" fill="none" stroke="#8c7552" stroke-width="6"/><rect x="20" y="38" width="360" height="292" rx="14" fill="#c49b6c"/><rect x="29" y="45" width="342" height="276" rx="10" fill="#fff4d9"/><rect x="40" y="56" width="320" height="254" rx="6" fill="${color}"/><path d="M44 80Q118 127 196 79Q273 125 356 78" fill="none" stroke="#7c9775" stroke-width="3"/><path d="m62 91 18 26 13-19m25 3 19 25 13-28m75-1 15 27 17-24m27-1 19 23 11-31" fill="#e6b875"/>${motifSVG(design.motif)}<text x="200" y="281" text-anchor="middle" fill="#415d47" font-family="Songti SC,STSong,serif" font-size="33" font-weight="600" letter-spacing="4">${design.title}</text><g transform="translate(337 53) rotate(20)"><path d="M0 10Q-48-27-30 11Q-21 29 0 10M0 10Q48-27 30 11Q21 29 0 10" fill="#7badd0" stroke="#5485ae" stroke-width="4"/><path d="M-5 12-15 63 1 52 11 65 9 12" fill="#6299c2"/><circle cy="10" r="8" fill="#5386b0"/></g></svg>`;
}
function selectedDesign(){const f=new FormData($('#design-form'));return {color:f.get('color'),motif:f.get('motif'),title:f.get('title')};}
function openDesigner(){
  if(!(state.metYu&&state.ribbon&&state.paint)){toast('还需要丝带和颜料，先问问朋友们吧。');return;}
  closeDialogue();path=[];onArrive=null;$('#design-form').elements.color.value=state.paintColor;$('#sign-preview').innerHTML=signSVG(selectedDesign());designer.showModal();
}
function celebrate(){
  const layer=$('#celebration');layer.replaceChildren();if(reducedMotion)return;
  const colors=['#d7ba70','#7eaa8d','#e3b39a','#f2e5b1','#8eb6c8'];
  for(let i=0;i<40;i++){const bit=document.createElement('i');bit.className='confetti';bit.style.left=Math.random()*100+'%';bit.style.setProperty('--confetti',colors[i%colors.length]);bit.style.setProperty('--delay',Math.random()*.7+'s');bit.style.setProperty('--duration',(2.2+Math.random()*1.2)+'s');layer.appendChild(bit);}setTimeout(()=>layer.replaceChildren(),4500);
}
$('#design-form').addEventListener('change',()=>$('#sign-preview').innerHTML=signSVG(selectedDesign()));
$('#design-form').addEventListener('submit',event=>{event.preventDefault();if(state.completed)return;const before=state;act({type:'COMPLETE',design:selectedDesign()});if(!state.completed||state===before){toast('还需要准备好材料。');return;}designer.close();celebrate();chime();show('yu',`完成啦！“${state.design.title}”——这块招牌有我们每个人的一点心意。谢谢你，小禾！`,'Wánchéng la! Zhè kuài zhāopai yǒu wǒmen měi ge rén de yìdiǎn xīnyì. Xièxie nǐ, Xiǎo Hé!','We did it! Everyone added something to our sign. Thank you, Xiaohe!',[{label:'看看这段共同回忆。',run:()=>{closeDialogue();openMemories();}},{label:'我去告诉其他朋友！',run:()=>{closeDialogue();toast('小雨记住了：你帮大家完成了第一块招牌');}}]);});
$('#close-designer').addEventListener('click',()=>designer.close());$('#close-panel').addEventListener('click',()=>panel.close());
for(const modal of [panel,designer])modal.addEventListener('click',e=>{if(e.target===modal){const box=modal.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)modal.close();}});
$('#close-dialogue').addEventListener('click',closeDialogue);
$('#translation-button').addEventListener('click',()=>{translations=!translations;$('#translation-button').setAttribute('aria-pressed',String(translations));$('#dialogue-pinyin').hidden=!translations||!currentLine?.pinyin;$('#dialogue-english').hidden=!translations||!currentLine?.english;});
$('#speak-button').addEventListener('click',()=>currentLine&&speak(currentLine.text));
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#chat-input');localReply(input.value);input.value='';});
$('#bag-button').addEventListener('click',openBag);$('#mobile-bag-button').addEventListener('click',openBag);$('#words-button').addEventListener('click',openWords);$('#memory-button').addEventListener('click',openMemories);$('#help-button').addEventListener('click',help);
$('#sound-button').addEventListener('click',()=>{sound=!sound;$('#sound-button').setAttribute('aria-pressed',String(sound));$('#sound-button').setAttribute('aria-label',sound?'关闭声音':'开启声音');$('.sound-label').textContent=sound?'声音开':'声音关';if(sound){chime();toast('声音已开启 · 对话将自动朗读');}else window.speechSynthesis?.cancel();});
document.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();enterTarget(b.dataset.target);}));
room.addEventListener('click',event=>{if(!state.started||panel.open||designer.open||event.target.closest('button'))return;closeDialogue();const rect=room.getBoundingClientRect();const desired={x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};if(desired.y<.45){toast('试着点人物的名字，或沿地板过道走走。');return;}walkTo(nearestFloor(desired));});
$('#start-button').addEventListener('click',event=>{event.stopPropagation();act({type:'START'});room.classList.add('started');$('#intro').classList.add('closed');toast(state.completed?'欢迎回来，小雨还记得你们的招牌。':'先和举着招牌的小雨打个招呼吧。');});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeDialogue();path=[];onArrive=null;keys.clear();return;}
  if(event.target.matches('input,select,textarea')||panel.open||designer.open)return;
  const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&state.started){event.preventDefault();keys.add(key);}
  if(key==='e'&&state.started&&dialogue.hidden){event.preventDefault();let target=null,d=Infinity;for(const [id,point]of Object.entries(approach)){const value=distance(position,point);if(value<d){d=value;target=id;}}if(d<.19)enterTarget(target);else toast('再走近一点，就能和朋友说话了。');}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();window.speechSynthesis?.cancel();}});
$('#room-art').addEventListener('error',()=>{toast('场景图片暂时无法加载，请刷新后重试。');});
if(state.started){$('#start-button').firstChild.textContent='继续上次的故事 ';$('#resume-note').textContent=state.completed?'共同做过的事情，朋友们还记得。':'蓝丝带、颜料和朋友，都还在这里。';}
render();paintPlayer();requestAnimationFrame(loop);
