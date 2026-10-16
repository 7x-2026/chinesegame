export const SAVE_KEY='rongshuli.room.v1';
export function freshState(){return {version:1,started:false,metYu:false,knowCat:false,ribbon:false,paint:false,paintColor:'mint',completed:false,design:{color:'mint',motif:'cat',title:'欢迎来玩'},words:[],visits:0};}
export const vocabulary={
  help:{word:'帮忙',pinyin:'bāng máng',english:'to help'},
  sign:{word:'招牌',pinyin:'zhāo pai',english:'a sign'},
  ribbon:{word:'丝带',pinyin:'sī dài',english:'ribbon'},
  blue:{word:'蓝色',pinyin:'lán sè',english:'blue'},
  paint:{word:'颜料',pinyin:'yán liào',english:'paint'},
  welcome:{word:'欢迎',pinyin:'huān yíng',english:'welcome'}
};
export function transition(previous,action){
  const s={...previous,design:{...previous.design},words:[...previous.words]};
  const learn=(...keys)=>{s.words=[...new Set([...s.words,...keys])];};
  switch(action.type){
    case 'START':s.started=true;s.visits++;break;
    case 'MEET_YU':s.metYu=true;learn('help','sign');break;
    case 'CAT_CLUE':s.knowCat=true;learn('blue','ribbon');break;
    case 'GET_RIBBON':if(s.started){s.ribbon=true;s.knowCat=true;learn('ribbon','blue');}break;
    case 'GET_PAINT':if(s.started&&['mint','peach','sun'].includes(action.color)){s.paint=true;s.paintColor=action.color;s.design.color=action.color;learn('paint');}break;
    case 'COMPLETE':
      if(!s.metYu||!s.ribbon||!s.paint||s.completed)return previous;
      s.completed=true;
      s.design={color:['mint','peach','sun'].includes(action.design?.color)?action.design.color:s.paintColor,motif:['cat','flower','star'].includes(action.design?.motif)?action.design.motif:'cat',title:['欢迎来玩','一起逛集市','我们的周末'].includes(action.design?.title)?action.design.title:'欢迎来玩'};
      learn('welcome');break;
    default:return previous;
  }
  return s;
}
export function restoreState(raw){
  const f=freshState();
  try{
    const v=JSON.parse(raw);
    if(!v||v.version!==1)return f;
    for(const k of ['started','metYu','knowCat','ribbon','paint'])f[k]=v[k]===true;
    f.visits=Number.isInteger(v.visits)&&v.visits>=0?Math.min(v.visits,10000):0;
    f.paintColor=['mint','peach','sun'].includes(v.paintColor)?v.paintColor:'mint';
    f.completed=v.completed===true&&f.metYu&&f.ribbon&&f.paint;
    f.words=Array.isArray(v.words)?[...new Set(v.words.filter(k=>Object.hasOwn(vocabulary,k)))]:[];
    f.design={color:['mint','peach','sun'].includes(v.design?.color)?v.design.color:f.paintColor,motif:['cat','flower','star'].includes(v.design?.motif)?v.design.motif:'cat',title:['欢迎来玩','一起逛集市','我们的周末'].includes(v.design?.title)?v.design.title:'欢迎来玩'};
    return f;
  }catch{return f;}
}
export function objective(s){
  if(s.completed)return '招牌做好了！再和朋友聊聊吧。';
  if(!s.metYu)return '和举着招牌的小雨打个招呼';
  if(!s.ribbon&&!s.paint)return '找到蓝丝带，再向阿乐借颜料';
  if(!s.ribbon)return '找到窗边的小橘，取回蓝丝带';
  if(!s.paint)return '找正在整理材料的阿乐借颜料';
  return '回到小雨身边，一起完成招牌';
}
