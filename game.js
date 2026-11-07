const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),$=id=>document.getElementById(id);
const googleButton=$("googleButton"),profile=$("profile"),profilePicture=$("profilePicture"),profileName=$("profileName"),signOutBtn=$("signOutBtn"),loginStatus=$("loginStatus");
const GOOGLE_CLIENT_ID="377837397220-b7neat97v0ju4jku1m6gv4csvuq1rltg.apps.googleusercontent.com";
function showLoginStatus(text){loginStatus.textContent=text;loginStatus.classList.remove("hidden")}
function handleGoogleCredential(response){
 try{
  const payload=response.credential.split(".")[1];
  if(!payload)throw new Error("Google 로그인 정보를 읽을 수 없습니다.");
  const base64=payload.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(base64.padEnd(Math.ceil(base64.length/4)*4,"="));
  const claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));
  if(typeof claims.name!=="string")throw new Error("Google 프로필 정보가 올바르지 않습니다.");
  const picture=typeof claims.picture==="string"&&/^https:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\//i.test(claims.picture)?claims.picture:"";
  profileName.textContent=claims.name;
  if(picture)profilePicture.src=picture;else profilePicture.removeAttribute("src");
  profilePicture.classList.toggle("hidden",!picture);
  googleButton.classList.add("hidden");profile.classList.remove("hidden");signOutBtn.classList.remove("hidden");loginStatus.classList.add("hidden");
 }catch(error){showLoginStatus(error.message)}
}
function initializeGoogleSignIn(){
 if(!window.google?.accounts?.id){showLoginStatus("Google 로그인 서비스를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");return}
 window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleGoogleCredential});
 window.google.accounts.id.renderButton(googleButton,{type:"standard",theme:"outline",size:"large",text:"signin_with",shape:"rectangular",width:240,locale:"ko"});
}
const googleScript=document.createElement("script");
googleScript.src="https://accounts.google.com/gsi/client";googleScript.async=true;googleScript.defer=true;
googleScript.onload=initializeGoogleSignIn;
googleScript.onerror=()=>showLoginStatus("Google 로그인 서비스를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.");
document.head.appendChild(googleScript);
signOutBtn.addEventListener("click",()=>{
 window.google?.accounts?.id?.disableAutoSelect();profilePicture.removeAttribute("src");profile.classList.add("hidden");signOutBtn.classList.add("hidden");googleButton.classList.remove("hidden");showLoginStatus("로그아웃되었습니다.");
});
let W,H,groundY,lastTime=0,running=false,paused=false,gameOver=false;
let frame=0,score=0,present=0,level=1,speed=5,spawnTimer=0;
let obstacles=[],gifts=[],particles=[],snow=[],items=[];
let jumpHeld=false,jumpHoldFrames=0,combo=0,comboTimer=0,doubleGift=0,magnet=0;
let missionDone=[],runCoins=0,runItems=0,effectText="",effectTimer=0;
let menuActive=false,menuLaunching=false,menuLaunchFrame=0,villageFrame=0;
const START_SPEED=5,MAX_SPEED=10,MAX_HOLD_FRAMES=22;
const stageData=[
{name:"CHRISTMAS TOWN",desc:"THE FIRST DELIVERY",unlock:0,obstacles:["chimney","snow"]},
{name:"FROZEN FOREST",desc:"THE FROZEN PATH",unlock:100,obstacles:["snow","ice","chimney"]},
{name:"NORTH POLE",desc:"THE FINAL FRONTIER",unlock:300,obstacles:["ice","chimney","snow"]},
{name:"SKY DELIVERY",desc:"ABOVE THE CLOUDS",unlock:600,obstacles:["bird","chimney","ice"]}
];
const missionData=[
{id:"deliver5",name:"FIRST DELIVERY",desc:"선물 5개 배달하기",goal:5,type:"present",reward:30},
{id:"score100",name:"SCORE HUNTER",desc:"점수 100점 달성하기",goal:100,type:"score",reward:30},
{id:"survive30",name:"SURVIVOR",desc:"30초 생존하기",goal:30,type:"time",reward:40},
{id:"collect3",name:"ITEM COLLECTOR",desc:"아이템 3개 획득하기",goal:3,type:"items",reward:40}
];
const achievementData=[
{id:"first",name:"FIRST DELIVERY",desc:"첫 선물 배달",test:d=>d.totalPresent>=1,reward:20},
{id:"ten",name:"BUSY SANTA",desc:"누적 배달 10개",test:d=>d.totalPresent>=10,reward:50},
{id:"fifty",name:"MASTER SANTA",desc:"누적 배달 50개",test:d=>d.totalPresent>=50,reward:100},
{id:"combo5",name:"COMBO MASTER",desc:"5콤보 달성",test:d=>d.bestCombo>=5,reward:50},
{id:"score500",name:"HIGH SCORE",desc:"최고 점수 500점",test:d=>d.best>=500,reward:75},
{id:"allstages",name:"WORLD TOUR",desc:"4개 스테이지 모두 해금",test:d=>d.best>=600,reward:100},
{id:"items10",name:"TOOL BOX",desc:"아이템 누적 10개 획득",test:d=>d.totalItems>=10,reward:60}
];
const defaultData={best:0,coins:0,totalPresent:0,totalItems:0,bestCombo:0,unlocked:0,upgrades:{jump:0,gift:0,magnet:0},achievements:[],records:[]};
function loadData(){try{const s=JSON.parse(localStorage.getItem("santaV3Data")||"null");return {...defaultData,...s,upgrades:{...defaultData.upgrades,...(s?.upgrades||{})},achievements:s?.achievements||[],records:s?.records||[]}}catch(e){return {...defaultData,upgrades:{...defaultData.upgrades}}}}
let data=loadData(),currentStage=0,previousStage=0,stageTransition=0;
const TRANSITION_DURATION=55,santa={x:90,y:0,vy:0,w:42,h:52};
function resize(){const dpr=devicePixelRatio||1;W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0);groundY=H*.78;if(!running)santa.y=groundY-santa.h}
addEventListener("resize",resize);resize();
function makeSnow(){snow=[];for(let i=0;i<75;i++)snow.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()<.7?2:3,v:.5+Math.random()*1.5})}makeSnow();
function saveData(){localStorage.setItem("santaV3Data",JSON.stringify(data));$("best").textContent=data.best;$("coins").textContent=running?runCoins:data.coins}
function hideGameUI(){["hud","stageLabel","pauseBtn","touchLabels","hint","comboLabel","effectLabel","missionHUD"].forEach(id=>$(id).classList.add("hidden"))}
function showPanel(title,body){menuActive=false;$("message").innerHTML=`<h1>${title}</h1><div class="panel">${body}</div><button id="backMenu" class="secondary">BACK TO MENU</button>`;$("backMenu").onclick=showMenu;$("message").classList.remove("hidden")}
function showRecords(){let h=`<p>BEST SCORE: <b>${data.best}</b></p><p>TOTAL DELIVERIES: ${data.totalPresent}</p><p>TOTAL ITEMS: ${data.totalItems}</p><p>BEST COMBO: ${data.bestCombo}</p><h3>TOP 10 RECORDS</h3>`;if(!data.records.length)h+="<p>아직 기록이 없습니다.</p>";data.records.slice(0,10).forEach((r,i)=>h+=`<div class="entry"><span>${i+1}. ${r.stage}</span><b>${r.score} PTS</b></div>`);showPanel("RECORDS",h)}
function showShop(){let h=`<p>보유 코인: <b>${data.coins}</b></p>`,names={jump:["JUMP ENGINE","점프 높이 증가"],gift:["GIFT LAUNCHER","선물 발사 강화"],magnet:["MAGNET POWER","자석 지속시간 증가"]};for(const k of Object.keys(names)){const lv=data.upgrades[k]||0,cost=50*(lv+1);h+=`<div class="entry"><div><b>${names[k][0]}</b><br>${names[k][1]}<br>LEVEL ${lv}/5</div><button class="small" onclick="buyUpgrade('${k}')" ${lv>=5||data.coins<cost?"disabled":""}>${lv>=5?"MAX":cost+" COINS"}</button></div>`}showPanel("SLEIGH SHOP",h)}
window.buyUpgrade=function(k){if(!["jump","gift","magnet"].includes(k))return;const lv=data.upgrades[k]||0,cost=50*(lv+1);if(lv>=5||data.coins<cost)return;data.coins-=cost;data.upgrades[k]=lv+1;saveData();showShop()};
function showMissions(){let h="<p>이번 게임에서 달성할 수 있는 미션</p>";missionData.forEach(m=>h+=`<div class="entry"><div><b>${m.name}</b><br>${m.desc}</div><b>+${m.reward} COINS</b></div>`);showPanel("MISSIONS",h)}
function showAchievements(){let h=`<p>달성: ${data.achievements.length}/${achievementData.length}</p>`;achievementData.forEach(a=>h+=`<div class="entry"><div><b>${a.name}</b><br>${a.desc}</div><b>${data.achievements.includes(a.id)?"✓ DONE":"+"+a.reward}</b></div>`);showPanel("ACHIEVEMENTS",h)}
function showMenu(){running=false;paused=false;gameOver=false;menuActive=true;menuLaunching=false;menuLaunchFrame=0;hideGameUI();$("account").classList.remove("hidden");santa.x=W*.27;santa.y=groundY-santa.h;santa.vy=0;santa.jumping=false;$("message").innerHTML=`<section class="menu-card" aria-label="산타 런 메인 메뉴"><header class="menu-topline"><span class="menu-location">NORTH POLE · SANTA VILLAGE</span><span class="menu-edition">WINTER EDITION&nbsp; / &nbsp;01</span></header><div class="menu-layout"><div class="menu-copy"><div class="menu-kicker">SANTA DELIVERY SERVICE</div><h1><span>SANTA</span><strong>RUN</strong></h1><div class="menu-subtitle">THE CHRISTMAS DELIVERY PROJECT</div><p class="menu-description">산타와 루돌프의 선물 배달 작전이 시작됩니다.<br>장애물을 피하고 마을 곳곳에 선물을 전해주세요.</p><button id="startBtn"><span>▶</span><span>출발하기<small>START DELIVERY</small></span><b>↗</b></button></div><aside class="menu-info"><div class="dispatch-card"><div class="dispatch-stamp">DISPATCH&nbsp; / &nbsp;001</div><div class="dispatch-title">DELIVERY<br>TONIGHT</div><div class="dispatch-copy">NEXT STOP: EVERY HOME<br>ROUTE: NORTH POLE → WORLD</div><div class="dispatch-route">READY FOR TAKEOFF</div></div><div class="menu-stats"><div class="menu-stat"><span>BEST SCORE</span><strong>${data.best}</strong></div><div class="menu-stat"><span>COINS</span><strong>${data.coins}</strong></div></div></aside></div><nav id="menuActions" aria-label="게임 메뉴"><button class="secondary" id="recordsBtn">RECORDS</button><button class="secondary" id="shopBtn">SLEIGH SHOP</button><button class="secondary" id="missionsBtn">MISSIONS</button><button class="secondary" id="achievementsBtn">ACHIEVEMENTS</button></nav><footer class="menu-footer"><span>SANTA VILLAGE · NORTH POLE</span><span>EST. CHRISTMAS EVE</span></footer></section>`;$("startBtn").onclick=launchFromVillage;$("recordsBtn").onclick=showRecords;$("shopBtn").onclick=showShop;$("missionsBtn").onclick=showMissions;$("achievementsBtn").onclick=showAchievements;$("message").classList.remove("hidden");villageFrame=0;menuLoop()}
function launchFromVillage(){if(menuLaunching)return;menuLaunching=true;menuLaunchFrame=0;$("startBtn").disabled=true;$("startBtn").textContent="출발 준비 중..."}
function resetGame(){frame=0;score=0;present=0;level=1;speed=START_SPEED;spawnTimer=0;obstacles=[];gifts=[];particles=[];items=[];santa.x=90;santa.y=groundY-santa.h;santa.vy=0;santa.jumping=false;jumpHeld=false;jumpHoldFrames=0;combo=0;comboTimer=0;doubleGift=0;magnet=0;runCoins=0;runItems=0;missionDone=[];effectText="";effectTimer=0;stageTransition=0;previousStage=0;$("score").textContent=0;$("present").textContent=0;$("level").textContent=1;$("coins").textContent=0;updateComboUI();updateMissionUI()}
function startGame(){menuActive=false;menuLaunching=false;resetGame();currentStage=0;previousStage=0;running=true;paused=false;gameOver=false;$("message").classList.add("hidden");$("account").classList.add("hidden");$("loginStatus").classList.add("hidden");["hud","stageLabel","pauseBtn","touchLabels","hint","comboLabel","effectLabel","missionHUD"].forEach(id=>$(id).classList.remove("hidden"));$("stageLabel").textContent=stageData[0].name;lastTime=performance.now();loop()}
function pauseGame(){if(!running)return;paused=true;jumpHeld=false;$("message").innerHTML=`<h1>PAUSED</h1><p>MISSION TEMPORARILY SUSPENDED</p><button id="resumeBtn">RESUME</button><button id="retryBtn" class="secondary">RESTART</button><button id="menuBtn" class="secondary">MAIN MENU</button>`;$("resumeBtn").onclick=()=>{paused=false;$("message").classList.add("hidden");lastTime=performance.now();loop()};$("retryBtn").onclick=startGame;$("menuBtn").onclick=showMenu;$("message").classList.remove("hidden")}
function endGame(){if(!running)return;running=false;gameOver=true;jumpHeld=false;data.coins+=runCoins;data.best=Math.max(data.best,score);data.totalPresent+=present;data.totalItems+=runItems;data.bestCombo=Math.max(data.bestCombo,combo);data.unlocked=Math.max(data.unlocked,stageData.reduce((n,s,i)=>data.best>=s.unlock?i:n,0));data.records.push({score,stage:stageData[currentStage].name,present,date:new Date().toLocaleDateString()});data.records.sort((a,b)=>b.score-a.score);data.records=data.records.slice(0,10);checkAchievements();saveData();$("message").innerHTML=`<h1>MISSION FAILED</h1><h2>SCORE: ${score}</h2><p>PRESENT DELIVERED: ${present}<br>COMBO RECORD: ${combo}<br>COINS EARNED: ${runCoins}<br>BEST SCORE: ${data.best}<br>FINAL STAGE: ${stageData[currentStage].name}</p><button id="retryBtn">RETRY</button><button id="menuBtn" class="secondary">MAIN MENU</button>`;$("retryBtn").onclick=startGame;$("menuBtn").onclick=showMenu;$("message").classList.remove("hidden")}
function checkAchievements(){for(const a of achievementData)if(!data.achievements.includes(a.id)&&a.test(data)){data.achievements.push(a.id);data.coins+=a.reward}}
function jumpStart(){if(!running||paused)return;if(!santa.jumping){santa.vy=-(10+data.upgrades.jump*.7);santa.jumping=true;jumpHeld=true;jumpHoldFrames=0}}
function jumpRelease(){jumpHeld=false}
function throwGift(){if(!running||paused)return;const count=doubleGift>0?2:1;for(let i=0;i<count;i++)gifts.push({x:santa.x+43,y:santa.y+20+i*7,vx:9+data.upgrades.gift*.4,vy:-2.8,rot:0,size:18,hit:false});if(doubleGift>0)doubleGift=0}
canvas.addEventListener("pointerdown",e=>{e.preventDefault();if(!running||paused)return;if(e.clientX<W/2)throwGift();else jumpStart()});
canvas.addEventListener("pointerup",jumpRelease);canvas.addEventListener("pointercancel",jumpRelease);canvas.addEventListener("pointerleave",jumpRelease);
document.addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();if(!e.repeat)jumpStart()}if(e.code==="KeyZ"&&!e.repeat)throwGift();if(e.code==="KeyP"&&!e.repeat&&running)pauseGame()});
document.addEventListener("keyup",e=>{if(e.code==="Space"||e.code==="ArrowUp")jumpRelease()});$("pauseBtn").onclick=pauseGame;
function px(x,y,w,h,c="#111"){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function drawGround(){px(0,groundY,W,3);for(let x=0;x<W;x+=28)px(x,groundY+8,12,2,"#bbb")}
function drawSleigh(){const x=santa.x-18,y=santa.y+27;px(x,y,64,8);px(x+8,y-8,43,8);px(x+3,y+8,4,3);px(x+52,y+8,4,3);px(x+59,y-4,7,4);px(x+64,y-8,4,4);px(x+58,y+8,10,3);px(santa.x+8,santa.y+15,23,24);px(santa.x+4,santa.y+18,7,17);px(santa.x+13,santa.y+4,20,17,"#fff");px(santa.x+17,santa.y+9,3,3);px(santa.x+27,santa.y+9,3,3);px(santa.x+12,santa.y+17,22,7);px(santa.x+16,santa.y+24,15,5);px(santa.x+20,santa.y+29,8,4);px(santa.x+9,santa.y,25,5);px(santa.x+15,santa.y-8,15,8);px(santa.x+25,santa.y-13,8,7);px(santa.x+6,santa.y-1,7,5);px(santa.x+31,santa.y-14,5,5)}
function drawRudolph(){const x=santa.x+52,y=santa.y+27,bob=Math.sin(frame*.15)*2;ctx.save();ctx.translate(x,y+bob);px(0,0,25,13);px(4,-4,17,5);px(4,12,4,8);px(18,12,4,8);px(20,-5,7,8);px(23,-12,13,12);px(34,-7,5,5,"#fff");px(30,-9,2,2,"#fff");px(23,-13,4,4);px(34,-13,4,4);px(26,-18,3,7);px(23,-21,3,4);px(23,-24,7,3);px(35,-18,3,7);px(38,-21,3,4);px(36,-24,7,3);px(20,-1,8,3,"#fff");ctx.restore()}

/* 조명 애니메이션 */
function drawTwinkle(x,y,phase=0,size=4){const glow=(Math.sin(villageFrame*.09+phase)+1)/2;ctx.save();ctx.globalAlpha=.35+glow*.65;px(x-size,y-size,size*3,size*3,"#fff");px(x,y,size,size,"#777");px(x+1,y+1,Math.max(1,size-2),Math.max(1,size-2),"#fff");ctx.restore()}
function drawWarmWindow(x,y){const glow=(Math.sin(villageFrame*.035+x*.02)+1)/2;ctx.save();ctx.globalAlpha=.45+glow*.55;px(x,y,17,20,"#333");px(x+2,y+2,13,16,"#fff");px(x+7,y+2,3,16,"#bbb");px(x+2,y+9,13,3,"#bbb");ctx.restore()}
function drawVillageHouse(x,y,w,h){px(x+5,y+15,w-10,h-15,"#777");px(x+9,y+19,w-18,h-19,"#eee");px(x-8,y+10,w+16,8,"#333");px(x,y,w,12,"#555");px(x+7,y-7,w-14,10,"#777");px(x-8,y+7,w+16,4,"#fff");px(x+5,y-2,w-10,4,"#fff");px(x+18,y-8,w-36,3,"#fff");px(x+w-24,y-20,10,25,"#555");px(x+w-27,y-22,16,4,"#222");px(x+w-24,y-25,10,3,"#fff");const wy=y+35;drawWarmWindow(x+15,wy);drawWarmWindow(x+w-33,wy);px(x+w/2-9,y+h-34,18,34,"#333");px(x+w/2-6,y+h-30,12,30,"#aaa");px(x+w/2+2,y+h-17,2,2,"#fff");px(x+w/2-8,y+h-39,16,4,"#555");px(x+w/2-3,y+h-43,7,4,"#777");px(x+7,y+28,5,5,"#555");px(x+w-12,y+28,5,5,"#555")}
function drawVillageTree(x,y,size){px(x+size*.44,y+size*.65,size*.13,size*.35,"#333");px(x+size*.30,y+size*.40,size*.40,size*.25,"#777");px(x+size*.22,y+size*.24,size*.56,size*.25,"#888");px(x+size*.32,y+size*.08,size*.36,size*.25,"#666");px(x+size*.32,y+size*.39,size*.36,4,"#fff");px(x+size*.24,y+size*.23,size*.52,4,"#fff");px(x+size*.34,y+size*.07,size*.32,4,"#fff");const starGlow=(Math.sin(villageFrame*.08)+1)/2;ctx.save();ctx.globalAlpha=.5+starGlow*.5;px(x+size*.43,y-8,size*.14,8,"#222");px(x+size*.35,y-4,size*.30,3,"#222");ctx.restore();drawTwinkle(x+size*.40,y+size*.19,0,5);drawTwinkle(x+size*.58,y+size*.31,1.5,5);drawTwinkle(x+size*.32,y+size*.43,3,5);drawTwinkle(x+size*.62,y+size*.52,4.5,5);drawTwinkle(x+size*.46,y+size*.56,6,5);px(x+size*.53,y+size*.38,6,6,"#333");px(x+size*.38,y+size*.51,6,6,"#333")}
function drawVillageSnowman(x,y){px(x+7,y+20,22,22,"#aaa");px(x+3,y+31,30,18,"#888");px(x+9,y+24,18,15,"#fff");px(x+11,y+5,14,16,"#fff");px(x+10,y+4,16,4,"#333");px(x+12,y+1,12,4,"#555");px(x+14,y+11,3,3,"#222");px(x+21,y+11,3,3,"#222");px(x+18,y+15,5,3,"#555");px(x+24,y+14,7,3,"#777");px(x+17,y+29,3,3,"#333");px(x+17,y+37,3,3,"#333");px(x,y+26,9,3,"#555");px(x-3,y+21,3,7,"#555");px(x+27,y+26,10,3,"#555");px(x+36,y+21,3,7,"#555")}
function drawVillageGift(x,y,size){px(x,y+5,size,size*.7,"#555");px(x+3,y+8,size-6,size*.7-6,"#fff");px(x+size*.43,y+5,5,size*.7,"#333");px(x,y+size*.35,size,4,"#333");px(x+size*.28,y,size*.2,6,"#555");px(x+size*.52,y,size*.2,6,"#555");px(x+size*.43,y-2,5,6,"#333")}
function drawVillageLamp(x,y){const glow=(Math.sin(villageFrame*.07+x*.1)+1)/2;px(x+7,y,4,65,"#333");px(x,y-5,18,7,"#222");px(x+3,y-15,12,12,"#777");ctx.save();ctx.globalAlpha=.45+glow*.55;px(x+5,y-13,8,8,"#fff");ctx.restore();ctx.save();ctx.globalAlpha=.08+glow*.12;ctx.fillStyle="#aaa";ctx.beginPath();ctx.moveTo(x+9,y-3);ctx.lineTo(x-18,y+35);ctx.lineTo(x+36,y+35);ctx.closePath();ctx.fill();ctx.restore();px(x+3,y+62,10,4,"#333")}
function drawVillageSign(x,y){px(x+7,y,5,75,"#333");px(x+112,y,5,75,"#333");px(x,y,124,31,"#333");px(x+4,y+4,116,23,"#fff");ctx.save();ctx.fillStyle="#222";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("SANTA VILLAGE",x+62,y+16);ctx.restore()}
function drawVillageSparkles(){for(let i=0;i<12;i++){const x=(i*83+40)%W,y=groundY-30-(i*37%170),glow=(Math.sin(villageFrame*.06+i*1.7)+1)/2;if(glow>.65){ctx.save();ctx.globalAlpha=(glow-.65)*2.5;px(x,y,3,3,"#555");px(x-2,y+1,7,1,"#fff");px(x+1,y-2,1,7,"#fff");ctx.restore()}}}
function drawVillageScene(){
 ctx.fillStyle="#f4f4f4";ctx.fillRect(0,0,W,H);px(0,0,W,groundY,"#f7f7f7");
 for(let i=0;i<7;i++){const x=i*W/5-60;px(x,groundY-230,100,70,"#eee");px(x+20,groundY-250,60,25,"#eee");px(x+35,groundY-265,30,20,"#fff")}
 ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(W*.84,groundY*.17,25,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#bbb";ctx.lineWidth=2;ctx.stroke();
 for(let i=0;i<18;i++){const x=(i*113+37)%W,y=(i*47+19)%(groundY*.4);px(x,y,3,3,"#aaa")}
 drawVillageHouse(W*.02,groundY-115,78,115);drawVillageHouse(W*.79,groundY-125,90,125);drawVillageHouse(W*.91,groundY-95,75,95);
 drawVillageTree(W*.43,groundY-235,120);drawVillageTree(W*.22,groundY-150,65);drawVillageTree(W*.70,groundY-155,70);
 drawVillageSign(W*.07,groundY-175);
 px(0,groundY,W,H-groundY,"#eee");px(0,groundY,W,4,"#555");px(W*.28,groundY+18,W*.46,5,"#fff");px(W*.31,groundY+34,W*.40,3,"#ccc");
 drawVillageLamp(W*.12,groundY-65);drawVillageLamp(W*.83,groundY-65);drawVillageSnowman(W*.18,groundY-60);
 drawVillageGift(W*.30,groundY-28,25);drawVillageGift(W*.34,groundY-38,30);drawVillageGift(W*.38,groundY-25,23);drawVillageGift(W*.75,groundY-30,27);drawVillageGift(W*.79,groundY-45,32);
 px(W*.49,groundY+12,3,3,"#777");px(W*.52,groundY+24,3,3,"#777");px(W*.57,groundY+15,3,3,"#777");
 drawSleigh();drawRudolph();drawVillageSparkles();
 for(const s of snow)px(s.x,s.y,s.s,s.s,"#bbb");
}
function menuLoop(){if(!menuActive)return;villageFrame++;frame++;if(menuLaunching){menuLaunchFrame++;santa.x+=5;if(menuLaunchFrame>=55){menuActive=false;startGame();return}}for(const s of snow){s.x-=s.v*.35;s.y+=s.v*.7;if(s.y>groundY+30){s.y=-5;s.x=Math.random()*W}if(s.x<0)s.x=W}drawVillageScene();requestAnimationFrame(menuLoop)}
function drawGift(x,y,size=18,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);const s=size;px(-s/2+2,s/2+2,s,s/3,"#bbb");px(-s/2,-s/2,s,s,"#111");px(-s/2+2,-s/2+2,s-4,s-4,"#fff");px(-s/2,-2,s,4,"#111");px(-2,-s/2,4,s,"#111");px(-6,-s/2-5,5,4);px(2,-s/2-5,5,4);px(-5,-s/2-3,3,3,"#fff");px(3,-s/2-3,3,3,"#fff");px(-2,-s/2-2,4,4);ctx.restore()}
function drawChimney(o){px(o.x,o.y,28,o.h);px(o.x+5,o.y+5,18,o.h-5,"#fff");px(o.x-4,o.y-7,36,8);px(o.x+1,o.y-4,26,3,"#fff");for(let y=o.y+12;y<o.y+o.h;y+=13)px(o.x+2,y,24,2)}
function spawnObstacle(){const types=stageData[currentStage].obstacles,type=types[Math.floor(Math.random()*types.length)];let o={type,x:W+20,w:28,h:30,passed:false};if(type==="chimney"){o.y=groundY-54;o.h=54}if(type==="snow"){o.y=groundY-20;o.w=24;o.h=20}if(type==="ice"){o.y=groundY-34;o.w=30;o.h=34}if(type==="bird"){o.y=groundY-105-Math.random()*45;o.w=30;o.h=20}obstacles.push(o)}
function drawObstacle(o){if(o.type==="chimney"){drawChimney(o);return}if(o.type==="snow"){px(o.x,o.y+8,24,12);px(o.x+4,o.y+3,16,8);px(o.x+7,o.y,10,5);px(o.x+5,o.y+5,5,3,"#fff")}if(o.type==="ice"){px(o.x+5,o.y,20,34);px(o.x,o.y+14,30,20);px(o.x+9,o.y+5,4,12,"#fff");px(o.x+19,o.y+17,5,8,"#fff")}if(o.type==="bird"){px(o.x+8,o.y+7,15,8);px(o.x+2,o.y+2,10,5);px(o.x+18,o.y,8,7);px(o.x+20,o.y+7,4,3,"#fff")}}
function drawStageBackground(stage,alpha=1){ctx.save();ctx.globalAlpha=alpha;if(stage===0){for(let i=0;i<6;i++){let x=((i*155-frame*.35)%(W+160)+W+160)%(W+160)-80;px(x,groundY-85,65,85,"#f4f4f4");px(x+10,groundY-105,45,20,"#eee");px(x+25,groundY-125,15,20,"#eee");px(x+27,groundY-70,10,20,"#ccc")}}if(stage===1){for(let i=0;i<8;i++){let x=((i*130-frame*.55)%(W+150)+W+150)%(W+150)-60;px(x+20,groundY-130,8,130,"#ddd");px(x,groundY-105,48,35,"#eee");px(x+8,groundY-140,32,40,"#eee");px(x+15,groundY-165,18,30,"#eee")}}if(stage===2){for(let i=0;i<6;i++){let x=((i*180-frame*.3)%(W+200)+W+200)%(W+200)-100;px(x,groundY-115,100,115,"#eee");px(x+20,groundY-150,60,40,"#f5f5f5");px(x+45,groundY-180,20,30,"#eee")}}if(stage===3){for(let i=0;i<7;i++){let x=((i*145-frame*.65)%(W+160)+W+160)%(W+160)-80,y=groundY-150+(i%3)*35;px(x,y,65,12,"#eee");px(x+12,y-8,40,8,"#eee");px(x+22,y-14,20,6,"#eee")}}ctx.restore()}
const stageSkyShades=["#ffffff","#eeeeee","#dddddd","#cccccc"];
function drawStageSky(stage,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=stageSkyShades[stage];ctx.fillRect(0,0,W,H);ctx.restore()}
function stageBackground(){if(stageTransition>0){const p=1-stageTransition/TRANSITION_DURATION,s=p*p*(3-2*p);drawStageSky(previousStage,1-s);drawStageSky(currentStage,s);drawStageBackground(previousStage,1-s);drawStageBackground(currentStage,s);stageTransition--}else{drawStageSky(currentStage);drawStageBackground(currentStage,1)}}
function spawnItem(){const types=["double","magnet","coin"],type=types[Math.floor(Math.random()*types.length)];items.push({type,x:W+20,y:groundY-70-Math.random()*100,size:20,collected:false})}
function drawItem(it){if(it.type==="coin"){const x=Math.round(it.x),y=Math.round(it.y);px(x+6,y,8,2,"#555");px(x+3,y+2,14,2,"#777");px(x+1,y+4,18,12,"#555");px(x+3,y+16,14,2,"#777");px(x+6,y+18,8,2,"#555");px(x+6,y+2,8,2,"#fff");px(x+3,y+4,14,12,"#bbb");px(x+5,y+5,10,10,"#ddd");px(x+6,y+5,8,1,"#fff");px(x+5,y+7,1,6,"#666");px(x+14,y+7,1,6,"#666");px(x+6,y+14,8,1,"#666");px(x+5,y+5,3,2,"#fff");px(x+4,y+8,2,3,"#eee");ctx.fillStyle="#222";ctx.font="bold 11px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("$",x+10,y+11);return}const colors={double:"#555",magnet:"#888"};px(it.x,it.y,it.size,it.size,colors[it.type]);px(it.x+4,it.y+4,it.size-8,it.size-8,"#fff");ctx.fillStyle="#111";ctx.font="bold 12px monospace";ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText(it.type==="double"?"2":"M",it.x+it.size/2,it.y+14)}
function rectanglesOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function getPlayerHitboxes(){const bob=Math.sin(frame*.15)*2;return [{x:santa.x+4,y:santa.y-24,w:35,h:60},{x:santa.x+52,y:santa.y+3+bob,w:45,h:47},{x:santa.x-18,y:santa.y+19,w:90,h:20}]}
function addCoins(n){runCoins+=n;$("coins").textContent=runCoins}
function collectItem(it){if(it.collected)return;it.collected=true;runItems++;if(it.type==="double"){doubleGift=1;effectText="DOUBLE GIFT READY"}else if(it.type==="magnet"){magnet=600+data.upgrades.magnet*180;effectText="MAGNET ACTIVATED"}else if(it.type==="coin"){addCoins(10);effectText="+10 COINS"}if(it.type!=="coin")addCoins(5);effectTimer=100}
function updateComboUI(){const el=$("comboLabel");if(combo>0){const m=combo>=10?3:combo>=5?2:combo>=3?1.5:1;el.textContent=`${combo} COMBO  ×${m}`}else el.textContent=""}
function updateMissionUI(){if(!running)return;$("missionHUD").innerHTML="MISSION<br>"+[`DELIVERY ${Math.min(present,5)}/5`,`SCORE ${Math.min(score,100)}/100`,`ITEMS ${Math.min(runItems,3)}/3`].join("<br>")}
function checkMissions(){const v={present,score,time:frame/60,items:runItems};missionData.forEach((m,i)=>{if(!missionDone[i]&&v[m.type]>=m.goal){missionDone[i]=true;addCoins(m.reward);effectText="MISSION COMPLETE: "+m.name;effectTimer=150}})}
function updateStageByScore(){let n=0;for(let i=0;i<stageData.length;i++)if(score>=stageData[i].unlock)n=i;if(n!==currentStage){previousStage=currentStage;currentStage=n;stageTransition=TRANSITION_DURATION;$("stageLabel").textContent=stageData[currentStage].name;effectText="ENTERING "+stageData[currentStage].name;effectTimer=100}}
function update(){
 frame++;const difficulty=Math.min(frame/1200,1);speed=START_SPEED+(MAX_SPEED-START_SPEED)*difficulty;const interval=125-(125-55)*difficulty;level=Math.min(1+Math.floor(frame/900),10);$("level").textContent=level;
 if(comboTimer>0){comboTimer--;if(comboTimer===0){combo=0;updateComboUI()}}
 if(jumpHeld&&santa.vy<0&&jumpHoldFrames<MAX_HOLD_FRAMES){santa.vy-=.38;jumpHoldFrames++}
 santa.y+=santa.vy;santa.vy+=.65;if(santa.y>=groundY-santa.h){santa.y=groundY-santa.h;santa.vy=0;santa.jumping=false;jumpHeld=false;jumpHoldFrames=0}
 spawnTimer++;if(spawnTimer>=interval){spawnObstacle();spawnTimer=0;if(difficulty>.5)spawnTimer=-Math.random()*20}
 if(frame%420===0&&Math.random()<.8)spawnItem();
 const box={x:santa.x+5,y:santa.y+8,w:38,h:40};
 for(const o of obstacles){o.x-=speed;if(box.x+box.w>o.x&&box.x<o.x+o.w&&box.y+box.h>o.y&&box.y<o.y+o.h){endGame();return}if(!o.passed&&o.x+o.w<santa.x){o.passed=true;score+=10;$("score").textContent=score;updateStageByScore()}}
 obstacles=obstacles.filter(o=>o.x>-100);
 for(const g of gifts){g.x+=g.vx;g.y+=g.vy;g.vy+=.12;g.rot+=.15;for(const o of obstacles){if(g.hit||o.type!=="chimney")continue;if(g.x+g.size/2>o.x-4&&g.x-g.size/2<o.x+o.w+4&&g.y+g.size/2>o.y-7&&g.y-g.size/2<o.y+o.h){g.hit=true;present++;combo++;comboTimer=240;data.bestCombo=Math.max(data.bestCombo,combo);const m=combo>=10?3:combo>=5?2:combo>=3?1.5:1;score+=Math.round(25*m);$("score").textContent=score;updateStageByScore();addCoins(5);$("present").textContent=present;updateComboUI();for(let i=0;i<10;i++)particles.push({x:g.x,y:g.y,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,life:25})}}}
 gifts=gifts.filter(g=>!g.hit&&g.x<W+50&&g.y<H+50);
 const hitboxes=getPlayerHitboxes();for(const it of items){if(it.collected)continue;it.x-=speed*.7;if(magnet>0){const dx=santa.x+35-(it.x+it.size/2),dy=santa.y+15-(it.y+it.size/2);if(Math.hypot(dx,dy)<190){it.x+=dx*.045;it.y+=dy*.045}}const ib={x:it.x,y:it.y,w:it.size,h:it.size};if(hitboxes.some(b=>rectanglesOverlap(b,ib)))collectItem(it)}
 items=items.filter(it=>!it.collected&&it.x>-50);if(magnet>0)magnet--;
 if(effectTimer>0){effectTimer--;$("effectLabel").textContent=effectText}else $("effectLabel").textContent="";
 for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.life--}particles=particles.filter(p=>p.life>0);
 for(const s of snow){s.x-=s.v*.4;s.y+=s.v;if(s.y>groundY){s.y=-5;s.x=Math.random()*W}if(s.x<0)s.x=W}
 checkMissions();updateMissionUI()
}
function draw(){ctx.clearRect(0,0,W,H);stageBackground();for(const s of snow)px(s.x,s.y,s.s,s.s,"#ddd");drawGround();drawSleigh();drawRudolph();obstacles.forEach(drawObstacle);gifts.forEach(g=>drawGift(g.x,g.y,g.size,g.rot));items.forEach(drawItem);particles.forEach(p=>px(p.x,p.y,3,3))}
function loop(){if(!running||paused)return;update();if(!running)return;draw();requestAnimationFrame(loop)}
saveData();showMenu();
