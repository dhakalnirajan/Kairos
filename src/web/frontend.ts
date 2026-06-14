const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kairos Code</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#1a1a2e;--surface:#16213e;--border:#3a3a5c;--primary:#208aae;--secondary:#a0a0a0;
--fg:#e0e0e0;--muted:#666;--success:#4ecdc4;--error:#ff6b6b;--warning:#ffe66d;--code-bg:#0d1117}
body{font-family:'SF Mono','Cascadia Code','Fira Code',monospace;background:var(--bg);color:var(--fg);height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:8px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}
header h1{color:var(--primary);font-size:14px;font-weight:600}
header .status{font-size:11px;color:var(--muted);margin-left:auto}
header .mode-badge{background:var(--primary);color:#fff;padding:2px 8px;border-radius:4px;font-size:10px}
.main{display:flex;flex:1;overflow:hidden}
.chat-pane{flex:3;display:flex;flex-direction:column;border-right:1px solid var(--border)}
.context-pane{flex:1;display:flex;flex-direction:column;background:var(--surface)}
.messages{flex:1;overflow-y:auto;padding:16px;scroll-behavior:smooth}
.message{margin-bottom:12px;max-width:85%}
.message.user{margin-left:auto}
.message .role{font-size:10px;color:var(--muted);margin-bottom:2px;text-transform:uppercase}
.message .content{padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.message.user .content{background:var(--primary);color:#fff;border-bottom-right-radius:2px}
.message.assistant .content{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:2px}
.message.tool .content{background:var(--code-bg);color:var(--success);font-size:12px;border:1px solid #21262d}
.message.error .content{background:#2d1b1b;color:var(--error);border:1px solid #5c2020}
.message .tool-name{color:var(--warning);font-weight:600}
.input-area{padding:12px 16px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0}
.input-row{display:flex;gap:8px;align-items:flex-end}
textarea{flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:inherit;font-size:13px;resize:none;outline:none;min-height:40px;max-height:200px}
textarea:focus{border-color:var(--primary)}
button{background:var(--primary);color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:opacity .2s}
button:hover{opacity:.85}
button:disabled{opacity:.4;cursor:not-allowed}
.context-pane h3{font-size:11px;color:var(--muted);padding:12px 16px 8px;text-transform:uppercase;border-bottom:1px solid var(--border)}
.context-content{flex:1;overflow-y:auto;padding:12px 16px;font-size:12px;color:var(--secondary)}
.context-content .mascot{color:var(--primary);font-size:10px;line-height:1.2;white-space:pre;margin-bottom:16px}
.context-content .stat{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)}
.sidebar-section{margin-bottom:16px}
.sidebar-section h4{font-size:10px;color:var(--primary);margin-bottom:8px;text-transform:uppercase}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.welcome{text-align:center;padding:60px 20px;color:var(--muted)}
.welcome h2{color:var(--primary);margin-bottom:8px}
.welcome p{font-size:13px;max-width:400px;margin:0 auto}
.typing{display:flex;gap:4px;padding:4px 0}
.typing span{width:6px;height:6px;background:var(--muted);border-radius:50%;animation:bounce 1.4s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
pre{background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-size:12px;margin:4px 0}
code{background:var(--code-bg);padding:1px 4px;border-radius:3px;font-size:12px}
</style>
</head>
<body>
<header>
<h1>KAIROS CODE</h1>
<span class="mode-badge" id="mode">HEADLESS</span>
<span class="status" id="status">Ready</span>
</header>
<div class="main">
<div class="chat-pane">
<div class="messages" id="messages">
<div class="welcome">
<h2>Kairos Code</h2>
<p>Terminal-native AI coding agent. Type a message or use /help for commands.</p>
</div>
</div>
<div class="input-area">
<div class="input-row">
<textarea id="input" placeholder="Ask anything... (Shift+Enter for newline)" rows="1"></textarea>
<button id="send" onclick="sendMsg()">Send</button>
</div>
</div>
</div>
<div class="context-pane">
<h3>Context</h3>
<div class="context-content" id="context">
<div class="mascot">K A I R O S</div>
<div class="sidebar-section">
<h4>Session</h4>
<div class="stat"><span>Model</span><span id="model-name">-</span></div>
<div class="stat"><span>Mode</span><span id="current-mode">HEADLESS</span></div>
<div class="stat"><span>Tokens</span><span id="token-count">0</span></div>
<div class="stat"><span>Cost</span><span id="cost">$0.0000</span></div>
</div>
<div class="sidebar-section">
<h4>Tools</h4>
<div id="tool-list" style="color:var(--muted);font-size:11px">Loading...</div>
</div>
<div class="sidebar-section">
<h4>History</h4>
<div id="history-list" style="color:var(--muted);font-size:11px">No turns yet</div>
</div>
</div>
</div>
</div>
<script>
const messages=document.getElementById('messages');
const input=document.getElementById('input');
const sendBtn=document.getElementById('send');
let turnCount=0,totalTokens=0,autoScroll=true;
input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}});
input.addEventListener('input',function(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,200)+'px'});
messages.addEventListener('scroll',function(){autoScroll=messages.scrollTop+messages.clientHeight>=messages.scrollHeight-40});

function scrollBottom(){if(autoScroll)messages.scrollTop=messages.scrollHeight}
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function updateStats(){document.getElementById('token-count').textContent=totalTokens;document.getElementById('cost').textContent='$'+(totalTokens*0.00001).toFixed(4);document.getElementById('history-list').textContent=turnCount+' turns'}

function addMessage(role,content,isTool,isError){
var welcome=messages.querySelector('.welcome');if(welcome)welcome.remove();
var div=document.createElement('div');div.className='message '+(isError?'error':isTool?'tool':role);
var roleLabel=isTool?'tool':role;
div.innerHTML='<div class="role">'+roleLabel+'</div><div class="content">'+escapeHtml(content)+'</div>';
messages.appendChild(div);scrollBottom();return div}

function addTyping(){
var div=document.createElement('div');div.className='message assistant';
div.innerHTML='<div class="role">assistant</div><div class="content"><div class="typing"><span></span><span></span><span></span></div></div>';
messages.appendChild(div);scrollBottom();return div}

function handleSlash(cmd){
var parts=cmd.split(' ');var command=parts[0];
switch(command){
case'/clear':messages.innerHTML='';break;
case'/help':addMessage('assistant','Commands: /clear, /help, /model <name>, /mode <mode>, /dream, /status, /undo, /compact');break;
case'/model':if(parts[1])fetch('/api/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:parts[1]})});break;
case'/mode':if(parts[1])fetch('/api/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:parts[1]})});break;
case'/status':fetch('/api/status').then(function(r){return r.json()}).then(function(d){addMessage('assistant',JSON.stringify(d,null,2))});break;
default:addMessage('error','Unknown command: '+command)}}

async function sendMsg(){
var text=input.value.trim();if(!text)return;
input.value='';input.style.height='auto';
addMessage('user',text);
if(text.startsWith('/')){handleSlash(text);return}
sendBtn.disabled=true;
var typing=addTyping();
try{
var res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,stream:true})});
if(!res.ok)throw new Error('HTTP '+res.status);
var reader=res.body.getReader();
var decoder=new TextDecoder();
var assistantEl=addMessage('assistant','');
var content='';
while(true){
var result=await reader.read();if(result.done)break;
var chunk=decoder.decode(result.value,{stream:true});
var lines=chunk.split('\\n');
for(var i=0;i<lines.length;i++){
var line=lines[i];
if(!line.startsWith('data: '))continue;
var data=line.slice(6);
if(data==='[DONE]')continue;
try{
var evt=JSON.parse(data);
if(evt.type==='token'){content+=evt.content;assistantEl.querySelector('.content').textContent=content;scrollBottom()}
if(evt.type==='tool_call'){addMessage('tool',evt.name+': '+JSON.stringify(evt.result).slice(0,300),true)}
if(evt.type==='done'&&evt.usage){totalTokens+=(evt.usage.completionTokens||0);updateStats()}
if(evt.type==='error'){addMessage('error',evt.message,false,true)}
}catch(e){}}
}
if(!content)assistantEl.querySelector('.content').textContent='(no response)';
turnCount++;updateStats();
}catch(e){addMessage('error',e.message,false,true)}
sendBtn.disabled=false;input.focus();}

async function loadTools(){
try{var res=await fetch('/api/tools');var data=await res.json();
document.getElementById('tool-list').innerHTML=data.tools.map(function(t){return '<div style="padding:2px 0">- '+t+'</div>'}).join('');
}catch(e){document.getElementById('tool-list').textContent='Failed to load'}}
async function loadModel(){
try{var res=await fetch('/api/status');var data=await res.json();
document.getElementById('model-name').textContent=data.model||'-';
document.getElementById('current-mode').textContent=data.mode||'HEADLESS';
document.getElementById('mode').textContent=data.mode||'HEADLESS';
}catch(e){}}
loadModel();loadTools();
</script>
</body>
</html>`;

export { FRONTEND_HTML };
