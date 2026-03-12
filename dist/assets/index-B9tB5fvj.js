(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function i(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(r){if(r.ep)return;r.ep=!0;const o=i(r);fetch(r.href,o)}})();async function ue(e){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter();if(!t)return null;const i=await t.requestDevice(),n=e.getContext("webgpu");if(!n)return null;const r=navigator.gpu.getPreferredCanvasFormat();return n.configure({device:i,format:r,alphaMode:"opaque"}),{device:i,context:n,format:r,canvas:e}}const M=new Set,Y=new Set,V=new Set;function ce(){window.addEventListener("keydown",e=>{M.has(e.code)||Y.add(e.code),M.add(e.code)}),window.addEventListener("keyup",e=>{M.delete(e.code),V.add(e.code)})}function fe(){const e=M.has("KeyA")||M.has("ArrowLeft"),t=M.has("KeyD")||M.has("ArrowRight"),i=M.has("KeyW")||M.has("ArrowUp"),n=["KeyW","ArrowUp"],r=n.some(f=>M.has(f)),o=n.some(f=>Y.has(f)),a=n.some(f=>V.has(f)),u=M.has("Space"),s=V.has("Space");return{left:e,right:t,jump:r,jumpPressed:o,jumpReleased:a,charge:u,chargeReleased:s,up:i}}function le(){Y.clear(),V.clear()}function de(){const i=[{x:130,y:380,w:700,h:32},{x:180,y:270,w:160,h:16},{x:620,y:270,w:160,h:16},{x:370,y:170,w:140,h:16}],n={left:-100,right:1060,bottom:640,top:-200},r={x:960/2,y:200};return{platforms:i,killZone:n,spawnPoint:r,width:960,height:540}}const pe=980,he=.65,me=60,ge=2800,K=2200,xe=1400,W=300,be=-540,ve=.5,ye=.1,Me=.133,Pe=.5,Re=1;function we(e,t){return{x:e,y:t,vx:0,vy:0,w:20,h:40,grounded:!1,facing:1,coyoteTimer:0,jumpBufferTimer:0,jumpHeld:!1,jumpCutoff:!1,dead:!1,respawnTimer:0,invulnTimer:0}}function Le(e,t,i,n){if(e.dead){e.respawnTimer-=n,e.respawnTimer<=0&&Ue(e,i);return}e.invulnTimer>0&&(e.invulnTimer-=n);const r=e.grounded?ge:xe;let o=0;if(t.left&&(o-=1),t.right&&(o+=1),o!==0)e.facing=o,e.vx+=o*r*n,Math.abs(e.vx)>W&&(e.vx=Math.sign(e.vx)*W);else{const u=(e.grounded?K:K*.5)*n;Math.abs(e.vx)<=u?e.vx=0:e.vx-=Math.sign(e.vx)*u}e.grounded?e.coyoteTimer=ye:e.coyoteTimer-=n,t.jumpPressed?e.jumpBufferTimer=Me:e.jumpBufferTimer-=n,e.jumpBufferTimer>0&&e.coyoteTimer>0&&(e.vy=be,e.grounded=!1,e.coyoteTimer=0,e.jumpBufferTimer=0,e.jumpHeld=!0,e.jumpCutoff=!1),e.jumpHeld&&!e.jumpCutoff&&t.jumpReleased&&(e.vy<0&&(e.vy*=ve),e.jumpCutoff=!0);let a=pe;!e.grounded&&Math.abs(e.vy)<me&&(a*=he),e.vy+=a*n,e.x+=e.vx*n,e.y+=e.vy*n,e.grounded=!1;for(const u of i.platforms)Be(e,u);e.grounded&&(e.jumpHeld=!1,e.jumpCutoff=!1),(e.x<i.killZone.left||e.x>i.killZone.right||e.y>i.killZone.bottom)&&Te(e)}function Be(e,t){const i=e.x-e.w/2,n=e.x+e.w/2,r=e.y-e.h/2,o=e.y+e.h/2;if(n<=t.x||i>=t.x+t.w||o<=t.y||r>=t.y+t.h)return;const a=n-t.x,u=t.x+t.w-i,s=o-t.y,f=t.y+t.h-r,c=Math.min(a,u,s,f);c===s&&e.vy>=0?(e.y=t.y-e.h/2,e.vy=0,e.grounded=!0):c===f&&e.vy<0?(e.y=t.y+t.h+e.h/2,e.vy=0):c===a?(e.x=t.x-e.w/2,e.vx=0):c===u&&(e.x=t.x+t.w+e.w/2,e.vx=0)}function Te(e){e.dead=!0,e.respawnTimer=Pe,e.vx=0,e.vy=0}function Ue(e,t){const i=t.platforms[0];e.x=i.x+Math.random()*i.w,e.y=i.y-120,e.vx=0,e.vy=0,e.dead=!1,e.grounded=!1,e.invulnTimer=Re,e.coyoteTimer=0,e.jumpBufferTimer=0}const Se=`
struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) color: vec3f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = vec2f(
    (input.pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (input.pos.y / uniforms.resolution.y) * 2.0,
  );
  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
`;function Ee(e,t){const{device:i,format:n}=e,r=i.createShaderModule({code:Se}),o=[],a=e.canvas.width,u=e.canvas.height;y(o,0,0,a,u*.5,[.05,.05,.18]),y(o,0,u*.5,a,u*.5,[.1,.08,.22]);for(const m of t)Ge(o,m);const s=new Float32Array(o),f=i.createBuffer({size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(f,0,s);const c=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(c,0,new Float32Array([a,u,0,0]));const d=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),l=i.createBindGroup({layout:d,entries:[{binding:0,resource:{buffer:c}}]});return{pipeline:i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:r,entryPoint:"vs_main",buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x3"}]}]},fragment:{module:r,entryPoint:"fs_main",targets:[{format:n}]},primitive:{topology:"triangle-list"}}),vertexBuffer:f,uniformBuffer:c,bindGroup:l,vertexCount:o.length/5}}function _e(e,t){e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(t.vertexCount)}function Ge(e,t){const{x:i,y:n,w:r,h:o}=t,u=o>20?28:14,s=4;y(e,i+s,n+o+s,r,u,[.03,.02,.06]);const f=[.52,.36,.18],c=[.42,.28,.13],d=[.3,.2,.08],l=u/3;y(e,i,n+o,r,l,f),y(e,i,n+o+l,r,l,c),y(e,i,n+o+l*2,r,l,d),y(e,i,n+o,3,u,[.55,.4,.22]),y(e,i+r-3,n+o,3,u,[.25,.16,.07]),y(e,i,n+o+u-2,r,2,[.18,.12,.05]),y(e,i,n,r,o,[.3,.58,.25]),y(e,i,n,r,Math.min(3,o*.4),[.45,.75,.35]),y(e,i,n,2,o,[.4,.68,.32]);const m=18,x=[.35,.62,.28],P=[.5,.78,.38];for(let b=i+8;b<i+r-8;b+=m){const k=4+Math.sin(b*.7)*2,O=5;Z(e,b-O,n,b+O,n,b+1,n-k,x),Z(e,b+3,n,b+8,n,b+6,n-k*.6,P)}}function y(e,t,i,n,r,o){const[a,u,s]=o;e.push(t,i,a,u,s),e.push(t+n,i,a,u,s),e.push(t+n,i+r,a,u,s),e.push(t,i,a,u,s),e.push(t+n,i+r,a,u,s),e.push(t,i+r,a,u,s)}function Z(e,t,i,n,r,o,a,u){const[s,f,c]=u;e.push(t,i,s,f,c),e.push(n,r,s,f,c),e.push(o,a,s,f,c)}const Oe=1024,Ie=`
struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) color: vec3f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = vec2f(
    (input.pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (input.pos.y / uniforms.resolution.y) * 2.0,
  );
  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
`,Ae=6,Ce=-13,S=-9,E=5,B=6,_=4,L=10,G=10;function J(e,t,i){return e+(t-e)*i}function De(e,t){const i=e.facing,n=Math.abs(e.vx),r=e.vy,o=e.grounded,a=i*2,u=.5,s=1.3,f=i===1?s:u,c=i===1?u:s,d={head:[a*.5,-18],neck:[a*.3,Ce],shoulderL:[-E*f+a,S],shoulderR:[E*c+a,S],elbowL:[-E*f-4+a,S+8],elbowR:[E*c+4+a,S+8],handL:[-E*f-2+a,S+16],handR:[E*c+2+a,S+16],hip:[a*.2,B],hipL:[-_*f+a*.2,B],hipR:[_*c+a*.2,B],kneeL:[-_*f-1+a*.2,B+L],kneeR:[_*c+1+a*.2,B+L],footL:[-_*f+a*.2,B+L+G],footR:[_*c+a*.2,B+L+G]};if(!o&&r<-50)te(d,i);else if(!o&&r>50)ne(d,i);else if(o)n>20?Fe(d,i,t,n):ke(d,i,t);else{const l=(r+50)/100;Ve(d,i,Math.max(0,Math.min(1,l)))}return d}function ke(e,t,i){const n=Math.sin(i*2.5)*1.2;e.head[1]+=n,e.neck[1]+=n,e.shoulderL[1]+=n*.8,e.shoulderR[1]+=n*.8;const r=Math.sin(i*1.5)*.8;t===1?(e.elbowR[0]+=2,e.handR[0]+=3,e.handR[1]-=1,e.elbowL[0]+=r,e.handL[0]+=r):(e.elbowL[0]-=2,e.handL[0]-=3,e.handL[1]-=1,e.elbowR[0]-=r,e.handR[0]-=r)}function Fe(e,t,i,n){const r=10+n/300*4,o=i*r,a=Math.sin(o),u=Math.cos(o),s=t*3.5;e.head[0]+=s,e.neck[0]+=s*.8,e.shoulderL[0]+=s*.5,e.shoulderR[0]+=s*.5;const f=Math.abs(Math.sin(o))*1.5;e.head[1]-=f,e.neck[1]-=f;const c=t*a*11,d=Math.max(0,-u)*6;e.kneeL[0]=e.hipL[0]+c,e.kneeL[1]=e.hipL[1]+L-d,e.footL[0]=e.hipL[0]+c*1.3,e.footL[1]=e.kneeL[1]+G-Math.max(0,-a)*4,e.kneeR[0]=e.hipR[0]-c,e.kneeR[1]=e.hipR[1]+L-Math.max(0,u)*6,e.footR[0]=e.hipR[0]-c*1.3,e.footR[1]=e.kneeR[1]+G-Math.max(0,a)*4;const l=-t*a*9;e.elbowL[0]=e.shoulderL[0]+l*.5,e.elbowL[1]=e.shoulderL[1]+5-Math.abs(l)*.3,e.handL[0]=e.shoulderL[0]+l,e.handL[1]=e.elbowL[1]+5,e.elbowR[0]=e.shoulderR[0]-l*.5,e.elbowR[1]=e.shoulderR[1]+5-Math.abs(l)*.3,e.handR[0]=e.shoulderR[0]-l,e.handR[1]=e.elbowR[1]+5}function te(e,t){const i=t===1?"shoulderR":"shoulderL",n=t===1?"elbowR":"elbowL",r=t===1?"handR":"handL";e[n][0]=e[i][0]+t*2,e[n][1]=e[i][1]-8,e[r][0]=e[i][0]+t*3,e[r][1]=e[i][1]-16;const o=t===1?"shoulderL":"shoulderR",a=t===1?"elbowL":"elbowR",u=t===1?"handL":"handR";e[a][0]=e[o][0]-t*4,e[a][1]=e[o][1]+4,e[u][0]=e[o][0]-t*8,e[u][1]=e[o][1]+8;const s=t===1?"hipR":"hipL",f=t===1?"kneeR":"kneeL",c=t===1?"footR":"footL";e[f][0]=e[s][0]+t*5,e[f][1]=e[s][1]+6,e[c][0]=e[s][0]+t*3,e[c][1]=e[s][1]+14;const d=t===1?"hipL":"hipR",l=t===1?"kneeL":"kneeR",p=t===1?"footL":"footR";e[l][0]=e[d][0]-t*4,e[l][1]=e[d][1]+8,e[p][0]=e[d][0]-t*7,e[p][1]=e[d][1]+14}function ne(e,t){const i=t===1?"shoulderR":"shoulderL",n=t===1?"elbowR":"elbowL",r=t===1?"handR":"handL";e[n][0]=e[i][0]+t*6,e[n][1]=e[i][1]-2,e[r][0]=e[i][0]+t*12,e[r][1]=e[i][1]-3;const o=t===1?"shoulderL":"shoulderR",a=t===1?"elbowL":"elbowR",u=t===1?"handL":"handR";e[a][0]=e[o][0]-t*5,e[a][1]=e[o][1]+3,e[u][0]=e[o][0]-t*10,e[u][1]=e[o][1]+1;const s=t===1?"hipR":"hipL",f=t===1?"kneeR":"kneeL",c=t===1?"footR":"footL";e[f][0]=e[s][0]+t*2,e[f][1]=e[s][1]+L+1,e[c][0]=e[s][0]+t*1,e[c][1]=e[f][1]+G+2;const d=t===1?"hipL":"hipR",l=t===1?"kneeL":"kneeR",p=t===1?"footL":"footR";e[l][0]=e[d][0]-t*3,e[l][1]=e[d][1]+L,e[p][0]=e[d][0]-t*4,e[p][1]=e[l][1]+G}function Ve(e,t,i){const n={},r={};Object.assign(n,e),Object.assign(r,e);for(const o of Object.keys(e))n[o]=[...e[o]],r[o]=[...e[o]];te(n,t),ne(r,t);for(const o of Object.keys(e))e[o][0]=J(n[o][0],r[o][0],i),e[o][1]=J(n[o][1],r[o][1],i)}function je(e){const{device:t,format:i}=e,n=t.createShaderModule({code:Ie}),r=t.createBuffer({size:Oe*20,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(o,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const a=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),u=t.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:o}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:i}]},primitive:{topology:"triangle-list"}}),vertexBuffer:r,uniformBuffer:o,bindGroup:u}}function ze(e,t,i,n,r){if(n.dead||n.invulnTimer>0&&Math.floor(r*10)%2===0)return;const o=[],a=n.x,u=n.y,s=De(n,r),f=[.95,.95,.95],c=[.7,.8,.9];F(o,a,u,s.shoulderL,s.elbowL,s.handL,2.2,f),F(o,a,u,s.hipL,s.kneeL,s.footL,2.5,f),F(o,a,u,s.hipR,s.kneeR,s.footR,2.5,f),F(o,a,u,s.shoulderR,s.elbowR,s.handR,2.2,f),j(o,a+s.neck[0],u+s.neck[1],a+s.hip[0],u+s.hip[1],3,f),j(o,a+s.shoulderL[0],u+s.shoulderL[1],a+s.shoulderR[0],u+s.shoulderR[1],2.5,f);const d=a+s.head[0],l=u+s.head[1];H(o,d,l,Ae,10,f);const p=n.facing*3;H(o,d+p,l-1,1.5,6,[.3,.7,1]);for(const x of[s.elbowL,s.elbowR,s.kneeL,s.kneeR])H(o,a+x[0],u+x[1],1.8,6,c);const m=new Float32Array(o);i.queue.writeBuffer(t.vertexBuffer,0,m),e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(o.length/5)}function F(e,t,i,n,r,o,a,u,s){j(e,t+n[0],i+n[1],t+r[0],i+r[1],a,u),j(e,t+r[0],i+r[1],t+o[0],i+o[1],a*.85,u)}function H(e,t,i,n,r,o){for(let a=0;a<r;a++){const u=a/r*Math.PI*2,s=(a+1)/r*Math.PI*2;He(e,t,i,t+Math.cos(u)*n,i+Math.sin(u)*n,t+Math.cos(s)*n,i+Math.sin(s)*n,o)}}function He(e,t,i,n,r,o,a,u){const[s,f,c]=u;e.push(t,i,s,f,c),e.push(n,r,s,f,c),e.push(o,a,s,f,c)}function j(e,t,i,n,r,o,a){const u=n-t,s=r-i,f=Math.sqrt(u*u+s*s);if(f===0)return;const c=-s/f*o*.5,d=u/f*o*.5,[l,p,m]=a;e.push(t+c,i+d,l,p,m),e.push(t-c,i-d,l,p,m),e.push(n+c,r+d,l,p,m),e.push(t-c,i-d,l,p,m),e.push(n-c,r-d,l,p,m),e.push(n+c,r+d,l,p,m)}const N=12;function w(e,t){return e+Math.random()*(t-e)}function qe(e){const t=new ArrayBuffer(4);return new Uint32Array(t)[0]=e,new Float32Array(t)[0]}function D(e,t,i,n){const r=(n.gravity?1:0)|(n.damping?2:0)|(n.attractors?4:0),o=qe(r);for(let a=0;a<n.count;a++){const u=i.value%t;i.value++;const s=u*N,f=n.spread?w(-n.spread,n.spread):0,c=n.spread?w(-n.spread,n.spread):0,d=w(n.angleMin,n.angleMax),l=w(n.speedMin,n.speedMax),p=n.colorVar??0,m=Math.max(0,Math.min(1,n.color[0]+w(-p,p))),x=Math.max(0,Math.min(1,n.color[1]+w(-p,p))),P=Math.max(0,Math.min(1,n.color[2]+w(-p,p))),b=w(n.lifeMin,n.lifeMax);e[s+0]=n.x+f,e[s+1]=n.y+c,e[s+2]=Math.cos(d)*l,e[s+3]=Math.sin(d)*l,e[s+4]=m,e[s+5]=x,e[s+6]=P,e[s+7]=1,e[s+8]=b,e[s+9]=b,e[s+10]=w(n.sizeMin,n.sizeMax),e[s+11]=o}}function Ye(e,t,i,n,r,o){const a=Math.floor(2+o*4),u=35+(1-o)*25;for(let s=0;s<a;s++){const f=Math.random()*Math.PI*2,c=u*(.7+Math.random()*.3),d=Math.cos(f)*c,l=Math.sin(f)*c,p=o,m=.3+p*.7,x=.5+p*.5;D(e,t,i,{x:n+d,y:r+l,count:1,speedMin:5,speedMax:20,angleMin:0,angleMax:Math.PI*2,lifeMin:.4,lifeMax:.8,sizeMin:1.5+o*1.5,sizeMax:2.5+o*2,color:[m,x,1],colorVar:.08,damping:!0,attractors:!0})}}function Ne(e,t,i,n,r,o){const a=1+o;D(e,t,i,{x:n,y:r,count:a,spread:3+o*2,speedMin:10,speedMax:40,angleMin:0,angleMax:Math.PI*2,lifeMin:.15,lifeMax:.35,sizeMin:1.5,sizeMax:3+o,color:[.4+o*.2,.6+o*.15,1],colorVar:.05,damping:!0})}function Xe(e,t,i,n,r,o){const a=Math.floor(20+o*40);D(e,t,i,{x:n,y:r,count:a,spread:4,speedMin:80,speedMax:250+o*150,angleMin:0,angleMax:Math.PI*2,lifeMin:.3,lifeMax:.8+o*.4,sizeMin:2,sizeMax:4+o*3,color:[1,.7,.3],colorVar:.15,gravity:!0,damping:!0})}function Q(e,t,i,n,r){D(e,t,i,{x:n,y:r,count:40,speedMin:100,speedMax:300,angleMin:0,angleMax:Math.PI*2,lifeMin:.2,lifeMax:.5,sizeMin:2,sizeMax:5,color:[1,.95,.7],colorVar:.1,damping:!0})}function Ke(e,t,i,n,r,o){const a=Math.random()*Math.PI*2,u=o*(1+Math.random()*.4),s=Math.cos(a)*u,f=Math.sin(a)*u;D(e,t,i,{x:n+s,y:r+f,count:2,speedMin:5,speedMax:15,angleMin:0,angleMax:Math.PI*2,lifeMin:.4,lifeMax:.7,sizeMin:2,sizeMax:4,color:[1,.7,.25],colorVar:.1,damping:!0,attractors:!0})}const We=`// Particle compute shader — updates positions, velocities, lifetimes each frame.
// Each particle: pos(2f), vel(2f), color(4f), life(1f), maxLife(1f), size(1f), flags(1f) = 12 floats
//
// Physics model inspired by particle-life simulations:
//   - Exponential velocity damping (smooth deceleration, no jitter)
//   - Piecewise-linear attractor forces (no singularities at r=0)
//   - Tangential force component for organic swirling
//   - Semi-implicit Euler: update velocity first, then integrate position

struct Params {
  dt: f32,
  time: f32,
  gravity: f32,
  count: u32,
};

// Up to 4 point attractors active at once
struct Attractor {
  x: f32,
  y: f32,
  strength: f32,   // radial pull (positive = attract)
  radius: f32,     // max influence distance; force falls linearly to 0
  tangent: f32,    // tangential swirl strength (perpendicular to radial)
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
};

struct Attractors {
  count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  data: array<Attractor, 4>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<f32>;
@group(0) @binding(2) var<uniform> attractors: Attractors;

const STRIDE: u32 = 12u;
// Friction constant for exponential damping: v *= exp(-FRICTION * dt)
const FRICTION: f32 = 3.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= params.count) {
    return;
  }

  let base = idx * STRIDE;
  let life = particles[base + 8u];

  if (life <= 0.0) {
    return;
  }

  // Read state
  var px = particles[base + 0u];
  var py = particles[base + 1u];
  var vx = particles[base + 2u];
  var vy = particles[base + 3u];
  let flags = bitcast<u32>(particles[base + 11u]);

  // Flag bits:
  // bit 0: apply gravity
  // bit 1: apply damping (exponential friction)
  // bit 2: respond to attractors
  let useGravity = (flags & 1u) != 0u;
  let useDamping = (flags & 2u) != 0u;
  let useAttractors = (flags & 4u) != 0u;

  let dt = params.dt;

  // --- Force accumulation ---

  // Gravity
  if (useGravity) {
    vy += params.gravity * dt;
  }

  // Attractor forces (piecewise linear falloff + tangential swirl)
  if (useAttractors) {
    for (var i = 0u; i < attractors.count; i++) {
      let a = attractors.data[i];
      let dx = a.x - px;
      let dy = a.y - py;
      let dist = sqrt(dx * dx + dy * dy);

      if (dist > 0.5 && dist < a.radius) {
        // Normalized direction toward attractor
        let nx = dx / dist;
        let ny = dy / dist;

        // Piecewise linear: full strength at dist=0, falls to 0 at radius
        let falloff = 1.0 - dist / a.radius;

        // Radial force (toward attractor)
        let radial = a.strength * falloff;
        vx += nx * radial * dt;
        vy += ny * radial * dt;

        // Tangential force (perpendicular, creates swirl)
        // Perpendicular to radial: (-ny, nx)
        let tangential = a.tangent * falloff;
        vx += -ny * tangential * dt;
        vy += nx * tangential * dt;
      }
    }
  }

  // --- Damping (semi-implicit: applied after forces, before position) ---
  if (useDamping) {
    let decay = exp(-FRICTION * dt);
    vx *= decay;
    vy *= decay;
  }

  // --- Position integration (semi-implicit Euler) ---
  px += vx * dt;
  py += vy * dt;

  // --- Lifetime ---
  let newLife = life - dt;
  let maxLife = particles[base + 9u];
  let lifeRatio = max(newLife / maxLife, 0.0);

  // Write back
  particles[base + 0u] = px;
  particles[base + 1u] = py;
  particles[base + 2u] = vx;
  particles[base + 3u] = vy;
  particles[base + 7u] = lifeRatio; // alpha fade
  particles[base + 8u] = newLife;
}
`,Ze=`// Particle render shader — draws each particle as a screen-aligned quad (two triangles).
// Uses instancing: 6 vertices per particle (quad), instance index selects particle data.

struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<f32>;

const STRIDE: u32 = 12u;

// Quad corners (two triangles)
const QUAD_POS = array<vec2f, 6>(
  vec2f(-1.0, -1.0),
  vec2f( 1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0,  1.0),
);

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let base = instanceIndex * STRIDE;

  let life = particles[base + 8u];

  var out: VertexOutput;

  // Dead particle — degenerate triangle (off-screen)
  if (life <= 0.0) {
    out.position = vec4f(0.0, 0.0, -2.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let px = particles[base + 0u];
  let py = particles[base + 1u];
  let size = particles[base + 10u];

  let r = particles[base + 4u];
  let g = particles[base + 5u];
  let b = particles[base + 6u];
  let a = particles[base + 7u];

  let corner = QUAD_POS[vertexIndex % 6u];
  let worldPos = vec2f(px + corner.x * size, py + corner.y * size);

  let ndc = vec2f(
    (worldPos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (worldPos.y / uniforms.resolution.y) * 2.0,
  );

  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = vec4f(r * a, g * a, b * a, a);
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`,q=4,oe=16+q*32;function Je(e,t){const{device:i,format:n}=e,r=new Float32Array(t*N),o=r.byteLength,a=i.createBuffer({size:o,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),u=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s=i.createBuffer({size:oe,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),f=i.createShaderModule({code:We}),c=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),d=i.createComputePipeline({layout:i.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:f,entryPoint:"main"}}),l=i.createBindGroup({layout:c,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:a}},{binding:2,resource:{buffer:s}}]}),p=i.createShaderModule({code:Ze}),m=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(m,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const x=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),P=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[x]}),vertex:{module:p,entryPoint:"vs_main"},fragment:{module:p,entryPoint:"fs_main",targets:[{format:n,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),b=i.createBindGroup({layout:x,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:a}}]});return{maxParticles:t,cpuData:r,gpuBuffer:a,computePipeline:d,computeBindGroup:l,paramBuffer:u,attractorBuffer:s,renderPipeline:P,renderBindGroup:b,uniformBuffer:m}}function Qe(e,t,i,n){if(n<=i)return;const r=i%t.maxParticles,o=n%t.maxParticles,a=N*4;if(o>r||n-i>=t.maxParticles){const u=o>r?r:0,s=o>r?o:t.maxParticles,f=u*a,c=(s-u)*a;e.queue.writeBuffer(t.gpuBuffer,f,t.cpuData.buffer,f,c),o<=r&&o>0&&e.queue.writeBuffer(t.gpuBuffer,0,t.cpuData.buffer,0,o*a)}else{const u=r*a,s=(t.maxParticles-r)*a;e.queue.writeBuffer(t.gpuBuffer,u,t.cpuData.buffer,u,s),o>0&&e.queue.writeBuffer(t.gpuBuffer,0,t.cpuData.buffer,0,o*a)}}function $e(e,t,i){const n=new Float32Array(oe/4),r=new Uint32Array(n.buffer,0,4);r[0]=Math.min(i.length,q);for(let o=0;o<Math.min(i.length,q);o++){const a=i[o],u=4+o*8;n[u+0]=a.x,n[u+1]=a.y,n[u+2]=a.strength,n[u+3]=a.radius,n[u+4]=a.tangent}e.queue.writeBuffer(t.attractorBuffer,0,n)}function et(e,t,i,n,r){i.queue.writeBuffer(t.paramBuffer,0,new Float32Array([n,r,400,0]));const o=new Uint32Array([t.maxParticles]);i.queue.writeBuffer(t.paramBuffer,12,o);const a=e.beginComputePass();a.setPipeline(t.computePipeline),a.setBindGroup(0,t.computeBindGroup),a.dispatchWorkgroups(Math.ceil(t.maxParticles/64)),a.end()}function tt(e,t){e.setPipeline(t.renderPipeline),e.setBindGroup(0,t.renderBindGroup),e.draw(6,t.maxParticles)}const nt=2048,ot=`
struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) color: vec4f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = vec2f(
    (input.pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (input.pos.y / uniforms.resolution.y) * 2.0,
  );
  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;function it(e){const{device:t,format:i}=e,n=t.createShaderModule({code:ot}),r=t.createBuffer({size:nt*24,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(o,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const a=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),u=t.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:o}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:i,blend:{color:{srcFactor:"src-alpha",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),vertexBuffer:r,uniformBuffer:o,bindGroup:u}}function rt(e,t,i,n,r,o,a,u){const s=[];for(const c of n)c.alive&&(c.type==="charge_shot"?at(s,c,u):$(s,c.x,c.y,c.radius,u,1));if(a>0&&$(s,r,o,a,u,.8),s.length===0)return;const f=new Float32Array(s);i.queue.writeBuffer(t.vertexBuffer,0,f),e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(s.length/6)}function at(e,t,i){const n=1+Math.sin(i*20)*.15,r=t.radius*n,o=r*.6;C(e,t.x,t.y,o,8,[.8,.9,1,1]),C(e,t.x,t.y,r,10,[.3,.5,1,.6])}function $(e,t,i,n,r,o){const a=1+Math.sin(r*8)*.08,u=n*a;C(e,t,i,u*1.3,16,[1,.5,.1,.2*o]),C(e,t,i,u,14,[1,.7,.2,.5*o]),C(e,t,i,u*.5,10,[1,.95,.8,.9*o])}function C(e,t,i,n,r,o){const[a,u,s,f]=o;for(let c=0;c<r;c++){const d=c/r*Math.PI*2,l=(c+1)/r*Math.PI*2;e.push(t,i,a,u,s,f),e.push(t+Math.cos(d)*n,i+Math.sin(d)*n,a,u,s,f),e.push(t+Math.cos(l)*n,i+Math.sin(l)*n,a,u,s,f)}}const st=600,ut=200;function ct(){return{charging:!1,chargeTime:0,chargeType:null,spiritRadius:0}}function ft(e){return e<.3?1:e<.8?2:3}function ee(e){return Math.min(e/1.2,1)}function lt(e,t,i,n){const r=ft(e),o=r===1?4:r===2?7:12,a=r/3;return{x:t+n*15,y:i-5,vx:n*st,vy:0,radius:o,power:a,type:"charge_shot",alive:!0,level:r}}function dt(e,t,i,n,r){const o=Math.min(t/40,1),a=ut*(1-o*.6),u=r===1?Math.PI*.25:Math.PI*.75;return{x:i,y:n-30,vx:Math.cos(u)*a*r,vy:Math.abs(Math.sin(u)*a),radius:t,power:Math.min(e/3,1),type:"spirit_bomb",alive:!0,level:0}}function pt(e,t,i){const n=[];for(const r of e)if(r.alive){r.type==="spirit_bomb"&&(r.vy+=200*i),r.x+=r.vx*i,r.y+=r.vy*i;for(const o of t.platforms)if(ht(r,o)){r.alive=!1,n.push({proj:r,hitX:r.x,hitY:r.y});break}(r.x<t.killZone.left||r.x>t.killZone.right||r.y>t.killZone.bottom||r.y<t.killZone.top)&&(r.alive=!1)}return n.map(r=>r.proj)}function ht(e,t){const i=Math.max(t.x,Math.min(e.x,t.x+t.w)),n=Math.max(t.y,Math.min(e.y,t.y+t.h)),r=e.x-i,o=e.y-n;return r*r+o*o<e.radius*e.radius}const A=1/60,T=4096;async function mt(){const e=document.getElementById("game-canvas"),t=document.getElementById("fallback"),i=await ue(e);if(!i){e.style.display="none",t.style.display="block";return}const n=i;ce();const r=de(),o=we(r.spawnPoint.x,r.spawnPoint.y),a=ct(),u=[],s=Ee(n,r.platforms),f=je(n),c=Je(n,T),d=it(n),l={value:0};let p=0,m=performance.now(),x=0,P=0;function b(R,v){const h=o.dead;if(Le(o,R,r,v),h&&!o.dead&&Q(c.cpuData,T,l,o.x,o.y),!h&&o.dead&&Q(c.cpuData,T,l,o.x,o.y),o.dead)return;if(k(R,o,a,v),a.charging){const g=ee(a.chargeTime);Ye(c.cpuData,T,l,o.x,o.y,g),a.chargeType==="spirit"&&a.spiritRadius>3&&Ke(c.cpuData,T,l,o.x,o.y-30,a.spiritRadius)}const U=pt(u,r,v);for(const g of u)g.alive&&Ne(c.cpuData,T,l,g.x,g.y,g.level);for(const g of U)Xe(c.cpuData,T,l,g.x,g.y,g.power);for(let g=u.length-1;g>=0;g--)u[g].alive||u.splice(g,1)}function k(R,v,h,U){R.charge&&!h.charging&&(h.charging=!0,h.chargeTime=0,h.chargeType=R.up?"spirit":"mega",h.spiritRadius=0),h.charging&&R.charge&&(h.chargeTime+=U,h.chargeType==="spirit"&&(h.spiritRadius=Math.min(5+h.chargeTime*15,40))),h.charging&&R.chargeReleased&&(h.chargeType==="mega"&&h.chargeTime>.05?u.push(lt(h.chargeTime,v.x,v.y,v.facing)):h.chargeType==="spirit"&&h.chargeTime>.3&&u.push(dt(h.chargeTime,h.spiritRadius,v.x,v.y,v.facing)),h.charging=!1,h.chargeTime=0,h.chargeType=null,h.spiritRadius=0)}function O(R){const v=Math.min((R-m)/1e3,.1);m=R,p+=v;const h=fe();let U=!1;for(P=l.value;p>=A;)b(h,A),p-=A,x+=A,U=!0;U&&le(),l.value>P&&Qe(n.device,c,P,l.value);const g=[];if(a.charging){const X=ee(a.chargeTime);g.push({x:o.x,y:o.y,strength:300+X*500,radius:80,tangent:200+X*300}),a.chargeType==="spirit"&&a.spiritRadius>3&&g.push({x:o.x,y:o.y-30,strength:400,radius:a.spiritRadius*2.5,tangent:350})}$e(n.device,c,g);const z=n.device.createCommandEncoder();et(z,c,n.device,A,x);const ie=n.context.getCurrentTexture().createView(),I=z.beginRenderPass({colorAttachments:[{view:ie,clearValue:{r:.08,g:.08,b:.14,a:1},loadOp:"clear",storeOp:"store"}]});_e(I,s),ze(I,f,n.device,o,x);const re=o.x,ae=o.y-30,se=a.charging&&a.chargeType==="spirit"?a.spiritRadius:0;rt(I,d,n.device,u,re,ae,se,x),tt(I,c),I.end(),n.device.queue.submit([z.finish()]),requestAnimationFrame(O)}requestAnimationFrame(O)}mt();
