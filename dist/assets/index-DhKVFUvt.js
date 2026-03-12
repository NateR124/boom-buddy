(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function i(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(a){if(a.ep)return;a.ep=!0;const o=i(a);fetch(a.href,o)}})();async function xe(e){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter();if(!t)return null;const i=await t.requestDevice(),n=e.getContext("webgpu");if(!n)return null;const a=navigator.gpu.getPreferredCanvasFormat();return n.configure({device:i,format:a,alphaMode:"opaque"}),{device:i,context:n,format:a,canvas:e}}const R=new Set,Z=new Set,j=new Set;function be(){window.addEventListener("keydown",e=>{R.has(e.code)||Z.add(e.code),R.add(e.code)}),window.addEventListener("keyup",e=>{R.delete(e.code),j.add(e.code)})}function ve(){const e=R.has("KeyA")||R.has("ArrowLeft"),t=R.has("KeyD")||R.has("ArrowRight"),i=R.has("KeyW")||R.has("ArrowUp"),n=["KeyW","ArrowUp"],a=n.some(u=>R.has(u)),o=n.some(u=>Z.has(u)),r=n.some(u=>j.has(u)),s=R.has("Space"),c=j.has("Space");return{left:e,right:t,jump:a,jumpPressed:o,jumpReleased:r,charge:s,chargeReleased:c,up:i}}function ye(){Z.clear(),j.clear()}function Me(){const i=[{x:130,y:380,w:700,h:32},{x:180,y:270,w:160,h:16},{x:620,y:270,w:160,h:16},{x:370,y:170,w:140,h:16}],n={left:-100,right:1060,bottom:640,top:-200},a={x:960/2,y:200};return{platforms:i,killZone:n,spawnPoint:a,width:960,height:540}}const C=480,Y=270,g=2;function Re(e){const t=new Uint8Array(C*Y);for(const i of e){const n=Math.floor(i.x/g),a=Math.floor(i.y/g),o=Math.floor((i.x+i.w)/g),r=Math.floor((i.y+i.h)/g);for(let s=a;s<r;s++)for(let c=n;c<o;c++)c<0||c>=C||s<0||s>=Y||(t[s*C+c]=s===a?1:2)}return{cells:t,width:C,height:Y}}function Pe(e,t,i){return t<0||t>=e.width||i<0||i>=e.height?0:e.cells[i*e.width+t]}function O(e,t,i){return Pe(e,t,i)!==0}function we(e){const{cells:t,width:i,height:n}=e,a=Math.random()<.5;for(let o=n-2;o>=0;o--)for(let r=0;r<i;r++){const s=o*i+r;if(t[s]!==4)continue;const c=(o+1)*i+r;if(t[c]===0){t[c]=4,t[s]=0;continue}const u=a?-1:1,f=a?1:-1;Q(t,i,n,r,o,u)||Q(t,i,n,r,o,f)}}function Q(e,t,i,n,a,o){const r=n+o;if(r<0||r>=t||a+1>=i)return!1;const s=a*t+r,c=(a+1)*t+r;return e[s]===0&&e[c]===0?(e[c]=4,e[a*t+n]=0,!0):!1}function Le(e,t,i,n){const a=Math.floor(t/g),o=Math.floor(i/g),r=Math.ceil(n/g),s=r*.6;let c=0;for(let u=-r;u<=r;u++)for(let f=-r;f<=r;f++){const l=Math.sqrt(f*f+u*u);if(l>r)continue;const d=a+f,h=o+u;if(d<0||d>=e.width||h<0||h>=e.height)continue;const m=h*e.width+d,b=e.cells[m];b===0||b===3||(l<=s?e.cells[m]=0:e.cells[m]=4,c++)}return{count:c,centerGx:a,centerGy:o}}function Te(e,t){const i=e.w/2,n=e.h/2;Be(e,t,i,n),_e(e,t,i,n)}function Be(e,t,i,n){const a=Math.floor((e.x-i+1)/g),o=Math.floor((e.x+i-1)/g);if(e.vy>=0){const r=e.y+n,s=Math.floor(r/g);let c=1/0;for(let u=a;u<=o;u++)for(let f=s;f<=s+1;f++)if(O(t,u,f)){const l=f*g;l<c&&l>=r-2&&(c=l)}c<1/0&&(e.y=c-n,e.vy=0,e.grounded=!0)}else{const r=e.y-n,s=Math.floor(r/g);let c=-1/0;for(let u=a;u<=o;u++)for(let f=s;f>=s-1;f--)if(O(t,u,f)){const l=(f+1)*g;l>c&&l<=r+2&&(c=l)}c>-1/0&&(e.y=c+n,e.vy=0)}}function _e(e,t,i,n){const a=Math.floor((e.y-n+2)/g),o=Math.floor((e.y+n-2)/g);if(e.vx<=0){const r=e.x-i,s=Math.floor(r/g);for(let c=a;c<=o;c++)if(O(t,s,c)){const u=(s+1)*g;if(u>r-1){e.x=u+i,e.vx=0;break}}}if(e.vx>=0){const r=e.x+i,s=Math.floor(r/g);for(let c=a;c<=o;c++)if(O(t,s,c)){const u=s*g;if(u<r+1){e.x=u-i,e.vx=0;break}}}}function Se(e,t){if(e.type==="spirit_bomb"){const r=Math.floor(e.x/g),s=Math.floor(e.y/g);return O(t,r,s)}const i=Math.ceil(e.radius/g),n=Math.floor(e.x/g),a=Math.floor(e.y/g),o=e.radius/g*(e.radius/g);for(let r=-i;r<=i;r++)for(let s=-i;s<=i;s++)if(!(s*s+r*r>o)&&O(t,n+s,a+r))return!0;return!1}const Ae=980,Ue=.65,Ee=60,Ge=2800,$=2200,Ie=1400,ee=300,Oe=-540,ke=.5,De=.1,Ce=.133,Fe=.5,Ve=1;function ze(e,t){return{x:e,y:t,vx:0,vy:0,w:20,h:40,grounded:!1,facing:1,coyoteTimer:0,jumpBufferTimer:0,jumpHeld:!1,jumpCutoff:!1,dead:!1,respawnTimer:0,invulnTimer:0}}function Ye(e,t,i,n,a){if(e.dead){e.respawnTimer-=a,e.respawnTimer<=0&&je(e,i);return}e.invulnTimer>0&&(e.invulnTimer-=a);const o=e.grounded?Ge:Ie;let r=0;if(t.left&&(r-=1),t.right&&(r+=1),r!==0)e.facing=r,e.vx+=r*o*a,Math.abs(e.vx)>ee&&(e.vx=Math.sign(e.vx)*ee);else{const c=(e.grounded?$:$*.5)*a;Math.abs(e.vx)<=c?e.vx=0:e.vx-=Math.sign(e.vx)*c}e.grounded?e.coyoteTimer=De:e.coyoteTimer-=a,t.jumpPressed?e.jumpBufferTimer=Ce:e.jumpBufferTimer-=a,e.jumpBufferTimer>0&&e.coyoteTimer>0&&(e.vy=Oe,e.grounded=!1,e.coyoteTimer=0,e.jumpBufferTimer=0,e.jumpHeld=!0,e.jumpCutoff=!1),e.jumpHeld&&!e.jumpCutoff&&t.jumpReleased&&(e.vy<0&&(e.vy*=ke),e.jumpCutoff=!0);let s=Ae;!e.grounded&&Math.abs(e.vy)<Ee&&(s*=Ue),e.vy+=s*a,e.x+=e.vx*a,e.y+=e.vy*a,e.grounded=!1,Te(e,n),e.grounded&&(e.jumpHeld=!1,e.jumpCutoff=!1),(e.x<i.killZone.left||e.x>i.killZone.right||e.y>i.killZone.bottom)&&qe(e)}function qe(e){e.dead=!0,e.respawnTimer=Fe,e.vx=0,e.vy=0}function je(e,t){const i=t.platforms[0];e.x=i.x+Math.random()*i.w,e.y=i.y-120,e.vx=0,e.vy=0,e.dead=!1,e.grounded=!1,e.invulnTimer=Ve,e.coyoteTimer=0,e.jumpBufferTimer=0}const Ne=1024,He=`
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
`,Xe=6,Ke=-13,E=-9,G=5,S=6,I=4,M=10,_=10;function te(e,t,i){return e+(t-e)*i}function Ze(e,t,i){const n=e.facing,a=Math.abs(e.vx),o=e.vy,r=e.grounded,s=n*2,c=.5,u=1.3,f=n===1?u:c,l=n===1?c:u,d={head:[s*.5,-18],neck:[s*.3,Ke],shoulderL:[-G*f+s,E],shoulderR:[G*l+s,E],elbowL:[-G*f-4+s,E+8],elbowR:[G*l+4+s,E+8],handL:[-G*f-2+s,E+16],handR:[G*l+2+s,E+16],hip:[s*.2,S],hipL:[-I*f+s*.2,S],hipR:[I*l+s*.2,S],kneeL:[-I*f-1+s*.2,S+M],kneeR:[I*l+1+s*.2,S+M],footL:[-I*f+s*.2,S+M+_],footR:[I*l+s*.2,S+M+_]};if(i)We(d,n,t);else if(!r&&o<-50)ae(d,n);else if(!r&&o>50)se(d,n);else if(r)a>20?Qe(d,n,t,a):Je(d,n,t);else{const h=(o+50)/100;$e(d,n,Math.max(0,Math.min(1,h)))}return d}function We(e,t,i){const n=Math.sin(i*30)*.6,a=Math.sin(i*4)*1;e.elbowL[0]=e.shoulderL[0]-5+n,e.elbowL[1]=e.shoulderL[1]-10,e.handL[0]=e.shoulderL[0]+1+n,e.handL[1]=e.shoulderL[1]-18,e.elbowR[0]=e.shoulderR[0]+5+n,e.elbowR[1]=e.shoulderR[1]-10,e.handR[0]=e.shoulderR[0]-1+n,e.handR[1]=e.shoulderR[1]-18,e.head[0]+=-t*1+a,e.head[1]-=1,e.neck[0]+=-t*.5+a*.5,e.kneeL[0]=e.hipL[0]-2,e.kneeL[1]=e.hipL[1]+M,e.footL[0]=e.hipL[0]-4,e.footL[1]=e.hipL[1]+M+_,e.kneeR[0]=e.hipR[0]+2,e.kneeR[1]=e.hipR[1]+M,e.footR[0]=e.hipR[0]+4,e.footR[1]=e.hipR[1]+M+_}function Je(e,t,i){const n=Math.sin(i*2.5)*1.2;e.head[1]+=n,e.neck[1]+=n,e.shoulderL[1]+=n*.8,e.shoulderR[1]+=n*.8;const a=Math.sin(i*1.5)*.8;t===1?(e.elbowR[0]+=2,e.handR[0]+=3,e.handR[1]-=1,e.elbowL[0]+=a,e.handL[0]+=a):(e.elbowL[0]-=2,e.handL[0]-=3,e.handL[1]-=1,e.elbowR[0]-=a,e.handR[0]-=a)}function Qe(e,t,i,n){const a=10+n/300*4,o=i*a,r=Math.sin(o),s=Math.cos(o),c=t*3.5;e.head[0]+=c,e.neck[0]+=c*.8,e.shoulderL[0]+=c*.5,e.shoulderR[0]+=c*.5;const u=Math.abs(Math.sin(o))*1.5;e.head[1]-=u,e.neck[1]-=u;const f=t*r*11,l=Math.max(0,-s)*6;e.kneeL[0]=e.hipL[0]+f,e.kneeL[1]=e.hipL[1]+M-l,e.footL[0]=e.hipL[0]+f*1.3,e.footL[1]=e.kneeL[1]+_-Math.max(0,-r)*4,e.kneeR[0]=e.hipR[0]-f,e.kneeR[1]=e.hipR[1]+M-Math.max(0,s)*6,e.footR[0]=e.hipR[0]-f*1.3,e.footR[1]=e.kneeR[1]+_-Math.max(0,r)*4;const d=-t*r*9;e.elbowL[0]=e.shoulderL[0]+d*.5,e.elbowL[1]=e.shoulderL[1]+5-Math.abs(d)*.3,e.handL[0]=e.shoulderL[0]+d,e.handL[1]=e.elbowL[1]+5,e.elbowR[0]=e.shoulderR[0]-d*.5,e.elbowR[1]=e.shoulderR[1]+5-Math.abs(d)*.3,e.handR[0]=e.shoulderR[0]-d,e.handR[1]=e.elbowR[1]+5}function ae(e,t){const i=t===1?"shoulderR":"shoulderL",n=t===1?"elbowR":"elbowL",a=t===1?"handR":"handL";e[n][0]=e[i][0]+t*2,e[n][1]=e[i][1]-8,e[a][0]=e[i][0]+t*3,e[a][1]=e[i][1]-16;const o=t===1?"shoulderL":"shoulderR",r=t===1?"elbowL":"elbowR",s=t===1?"handL":"handR";e[r][0]=e[o][0]-t*4,e[r][1]=e[o][1]+4,e[s][0]=e[o][0]-t*8,e[s][1]=e[o][1]+8;const c=t===1?"hipR":"hipL",u=t===1?"kneeR":"kneeL",f=t===1?"footR":"footL";e[u][0]=e[c][0]+t*5,e[u][1]=e[c][1]+6,e[f][0]=e[c][0]+t*3,e[f][1]=e[c][1]+14;const l=t===1?"hipL":"hipR",d=t===1?"kneeL":"kneeR",h=t===1?"footL":"footR";e[d][0]=e[l][0]-t*4,e[d][1]=e[l][1]+8,e[h][0]=e[l][0]-t*7,e[h][1]=e[l][1]+14}function se(e,t){const i=t===1?"shoulderR":"shoulderL",n=t===1?"elbowR":"elbowL",a=t===1?"handR":"handL";e[n][0]=e[i][0]+t*6,e[n][1]=e[i][1]-2,e[a][0]=e[i][0]+t*12,e[a][1]=e[i][1]-3;const o=t===1?"shoulderL":"shoulderR",r=t===1?"elbowL":"elbowR",s=t===1?"handL":"handR";e[r][0]=e[o][0]-t*5,e[r][1]=e[o][1]+3,e[s][0]=e[o][0]-t*10,e[s][1]=e[o][1]+1;const c=t===1?"hipR":"hipL",u=t===1?"kneeR":"kneeL",f=t===1?"footR":"footL";e[u][0]=e[c][0]+t*2,e[u][1]=e[c][1]+M+1,e[f][0]=e[c][0]+t*1,e[f][1]=e[u][1]+_+2;const l=t===1?"hipL":"hipR",d=t===1?"kneeL":"kneeR",h=t===1?"footL":"footR";e[d][0]=e[l][0]-t*3,e[d][1]=e[l][1]+M,e[h][0]=e[l][0]-t*4,e[h][1]=e[d][1]+_}function $e(e,t,i){const n={},a={};Object.assign(n,e),Object.assign(a,e);for(const o of Object.keys(e))n[o]=[...e[o]],a[o]=[...e[o]];ae(n,t),se(a,t);for(const o of Object.keys(e))e[o][0]=te(n[o][0],a[o][0],i),e[o][1]=te(n[o][1],a[o][1],i)}function et(e){const{device:t,format:i}=e,n=t.createShaderModule({code:He}),a=t.createBuffer({size:Ne*20,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(o,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const r=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),s=t.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:o}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:i}]},primitive:{topology:"triangle-list"}}),vertexBuffer:a,uniformBuffer:o,bindGroup:s}}function tt(e,t,i,n,a,o){if(n.dead||n.invulnTimer>0&&Math.floor(a*10)%2===0)return;const r=[],s=n.x,c=n.y,u=Ze(n,a,o),f=[.95,.95,.95],l=[.7,.8,.9];z(r,s,c,u.shoulderL,u.elbowL,u.handL,2.2,f),z(r,s,c,u.hipL,u.kneeL,u.footL,2.5,f),z(r,s,c,u.hipR,u.kneeR,u.footR,2.5,f),z(r,s,c,u.shoulderR,u.elbowR,u.handR,2.2,f),N(r,s+u.neck[0],c+u.neck[1],s+u.hip[0],c+u.hip[1],3,f),N(r,s+u.shoulderL[0],c+u.shoulderL[1],s+u.shoulderR[0],c+u.shoulderR[1],2.5,f);const d=s+u.head[0],h=c+u.head[1];X(r,d,h,Xe,10,f);const m=n.facing*3;X(r,d+m,h-1,1.5,6,[.3,.7,1]);for(const v of[u.elbowL,u.elbowR,u.kneeL,u.kneeR])X(r,s+v[0],c+v[1],1.8,6,l);const b=new Float32Array(r);i.queue.writeBuffer(t.vertexBuffer,0,b),e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(r.length/5)}function z(e,t,i,n,a,o,r,s,c){N(e,t+n[0],i+n[1],t+a[0],i+a[1],r,s),N(e,t+a[0],i+a[1],t+o[0],i+o[1],r*.85,s)}function X(e,t,i,n,a,o){for(let r=0;r<a;r++){const s=r/a*Math.PI*2,c=(r+1)/a*Math.PI*2;nt(e,t,i,t+Math.cos(s)*n,i+Math.sin(s)*n,t+Math.cos(c)*n,i+Math.sin(c)*n,o)}}function nt(e,t,i,n,a,o,r,s){const[c,u,f]=s;e.push(t,i,c,u,f),e.push(n,a,c,u,f),e.push(o,r,c,u,f)}function N(e,t,i,n,a,o,r){const s=n-t,c=a-i,u=Math.sqrt(s*s+c*c);if(u===0)return;const f=-c/u*o*.5,l=s/u*o*.5,[d,h,m]=r;e.push(t+f,i+l,d,h,m),e.push(t-f,i-l,d,h,m),e.push(n+f,a+l,d,h,m),e.push(t-f,i-l,d,h,m),e.push(n-f,a-l,d,h,m),e.push(n+f,a+l,d,h,m)}const W=12;function w(e,t){return e+Math.random()*(t-e)}function ot(e){const t=new ArrayBuffer(4);return new Uint32Array(t)[0]=e,new Float32Array(t)[0]}function A(e,t,i,n){const a=(n.gravity?1:0)|(n.damping?2:0)|(n.attractors?4:0),o=ot(a);for(let r=0;r<n.count;r++){const s=i.value%t;i.value++;const c=s*W,u=n.spread?w(-n.spread,n.spread):0,f=n.spread?w(-n.spread,n.spread):0,l=w(n.angleMin,n.angleMax),d=w(n.speedMin,n.speedMax),h=n.colorVar??0,m=Math.max(0,Math.min(1,n.color[0]+w(-h,h))),b=Math.max(0,Math.min(1,n.color[1]+w(-h,h))),v=Math.max(0,Math.min(1,n.color[2]+w(-h,h))),L=w(n.lifeMin,n.lifeMax);e[c+0]=n.x+u,e[c+1]=n.y+f,e[c+2]=Math.cos(l)*d,e[c+3]=Math.sin(l)*d,e[c+4]=m,e[c+5]=b,e[c+6]=v,e[c+7]=1,e[c+8]=L,e[c+9]=L,e[c+10]=w(n.sizeMin,n.sizeMax),e[c+11]=o}}function it(e,t,i,n,a,o){const r=Math.floor(2+o*4),s=35+(1-o)*25;for(let c=0;c<r;c++){const u=Math.random()*Math.PI*2,f=s*(.7+Math.random()*.3),l=Math.cos(u)*f,d=Math.sin(u)*f,h=o,m=.3+h*.7,b=.5+h*.5;A(e,t,i,{x:n+l,y:a+d,count:1,speedMin:5,speedMax:20,angleMin:0,angleMax:Math.PI*2,lifeMin:.4,lifeMax:.8,sizeMin:1.5+o*1.5,sizeMax:2.5+o*2,color:[m,b,1],colorVar:.08,damping:!0,attractors:!0})}}function rt(e,t,i,n,a,o){const r=1+o;A(e,t,i,{x:n,y:a,count:r,spread:3+o*2,speedMin:10,speedMax:40,angleMin:0,angleMax:Math.PI*2,lifeMin:.15,lifeMax:.35,sizeMin:1.5,sizeMax:3+o,color:[.4+o*.2,.6+o*.15,1],colorVar:.05,damping:!0})}function at(e,t,i,n,a,o){const r=Math.floor(20+o*40);A(e,t,i,{x:n,y:a,count:r,spread:4,speedMin:80,speedMax:250+o*150,angleMin:0,angleMax:Math.PI*2,lifeMin:.3,lifeMax:.8+o*.4,sizeMin:2,sizeMax:4+o*3,color:[1,.7,.3],colorVar:.15,gravity:!0,damping:!0})}function ne(e,t,i,n,a){A(e,t,i,{x:n,y:a,count:40,speedMin:100,speedMax:300,angleMin:0,angleMax:Math.PI*2,lifeMin:.2,lifeMax:.5,sizeMin:2,sizeMax:5,color:[1,.95,.7],colorVar:.1,damping:!0})}function st(e,t,i,n,a,o){const r=Math.random()*Math.PI*2,s=o*(1+Math.random()*.4),c=Math.cos(r)*s,u=Math.sin(r)*s;A(e,t,i,{x:n+c,y:a+u,count:2,speedMin:5,speedMax:15,angleMin:0,angleMax:Math.PI*2,lifeMin:.4,lifeMax:.7,sizeMin:2,sizeMax:4,color:[1,.7,.25],colorVar:.1,damping:!0,attractors:!0})}function ct(e,t,i,n,a,o){const r=Math.min(Math.floor(8+o*.4),60),s=60+Math.min(o,100)*1.5;A(e,t,i,{x:n,y:a,count:Math.floor(r*.7),spread:6,speedMin:s*.4,speedMax:s,angleMin:-Math.PI,angleMax:0,lifeMin:.3,lifeMax:.9,sizeMin:2,sizeMax:5,color:[.45,.3,.14],colorVar:.1,gravity:!0,damping:!0}),A(e,t,i,{x:n,y:a,count:Math.floor(r*.3),spread:4,speedMin:s*.5,speedMax:s*1.2,angleMin:-Math.PI,angleMax:0,lifeMin:.2,lifeMax:.6,sizeMin:1.5,sizeMax:3.5,color:[.28,.5,.22],colorVar:.08,gravity:!0,damping:!0})}const ut=`// Particle compute shader — updates positions, velocities, lifetimes each frame.
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
`,ft=`// Particle render shader — draws each particle as a screen-aligned quad (two triangles).
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
`,K=4,ce=16+K*32;function lt(e,t){const{device:i,format:n}=e,a=new Float32Array(t*W),o=a.byteLength,r=i.createBuffer({size:o,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),s=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),c=i.createBuffer({size:ce,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),u=i.createShaderModule({code:ut}),f=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),l=i.createComputePipeline({layout:i.createPipelineLayout({bindGroupLayouts:[f]}),compute:{module:u,entryPoint:"main"}}),d=i.createBindGroup({layout:f,entries:[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:c}}]}),h=i.createShaderModule({code:ft}),m=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});i.queue.writeBuffer(m,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const b=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),v=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[b]}),vertex:{module:h,entryPoint:"vs_main"},fragment:{module:h,entryPoint:"fs_main",targets:[{format:n,blend:{color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),L=i.createBindGroup({layout:b,entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:r}}]});return{maxParticles:t,cpuData:a,gpuBuffer:r,computePipeline:l,computeBindGroup:d,paramBuffer:s,attractorBuffer:c,renderPipeline:v,renderBindGroup:L,uniformBuffer:m}}function dt(e,t,i,n){if(n<=i)return;const a=i%t.maxParticles,o=n%t.maxParticles,r=W*4;if(o>a||n-i>=t.maxParticles){const s=o>a?a:0,c=o>a?o:t.maxParticles,u=s*r,f=(c-s)*r;e.queue.writeBuffer(t.gpuBuffer,u,t.cpuData.buffer,u,f),o<=a&&o>0&&e.queue.writeBuffer(t.gpuBuffer,0,t.cpuData.buffer,0,o*r)}else{const s=a*r,c=(t.maxParticles-a)*r;e.queue.writeBuffer(t.gpuBuffer,s,t.cpuData.buffer,s,c),o>0&&e.queue.writeBuffer(t.gpuBuffer,0,t.cpuData.buffer,0,o*r)}}function ht(e,t,i){const n=new Float32Array(ce/4),a=new Uint32Array(n.buffer,0,4);a[0]=Math.min(i.length,K);for(let o=0;o<Math.min(i.length,K);o++){const r=i[o],s=4+o*8;n[s+0]=r.x,n[s+1]=r.y,n[s+2]=r.strength,n[s+3]=r.radius,n[s+4]=r.tangent}e.queue.writeBuffer(t.attractorBuffer,0,n)}function pt(e,t,i,n,a){i.queue.writeBuffer(t.paramBuffer,0,new Float32Array([n,a,400,0]));const o=new Uint32Array([t.maxParticles]);i.queue.writeBuffer(t.paramBuffer,12,o);const r=e.beginComputePass();r.setPipeline(t.computePipeline),r.setBindGroup(0,t.computeBindGroup),r.dispatchWorkgroups(Math.ceil(t.maxParticles/64)),r.end()}function gt(e,t){e.setPipeline(t.renderPipeline),e.setBindGroup(0,t.renderBindGroup),e.draw(6,t.maxParticles)}const mt=2048,xt=`
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
`;function bt(e){const{device:t,format:i}=e,n=t.createShaderModule({code:xt}),a=t.createBuffer({size:mt*24,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),o=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(o,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const r=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),s=t.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:o}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x4"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:i,blend:{color:{srcFactor:"src-alpha",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}}}]},primitive:{topology:"triangle-list"}}),vertexBuffer:a,uniformBuffer:o,bindGroup:s}}function vt(e,t,i,n,a,o,r,s){const c=[];for(const f of n)f.alive&&(f.type==="charge_shot"?yt(c,f,s):oe(c,f.x,f.y,f.radius,s,1));if(r>0&&oe(c,a,o,r,s,.8),c.length===0)return;const u=new Float32Array(c);i.queue.writeBuffer(t.vertexBuffer,0,u),e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(c.length/6)}function yt(e,t,i){const n=1+Math.sin(i*20)*.15,a=t.radius*n,o=a*.6;F(e,t.x,t.y,o,8,[.8,.9,1,1]),F(e,t.x,t.y,a,10,[.3,.5,1,.6])}function oe(e,t,i,n,a,o){const r=1+Math.sin(a*8)*.08,s=n*r;F(e,t,i,s*1.3,16,[1,.5,.1,.2*o]),F(e,t,i,s,14,[1,.7,.2,.5*o]),F(e,t,i,s*.5,10,[1,.95,.8,.9*o])}function F(e,t,i,n,a,o){const[r,s,c,u]=o;for(let f=0;f<a;f++){const l=f/a*Math.PI*2,d=(f+1)/a*Math.PI*2;e.push(t,i,r,s,c,u),e.push(t+Math.cos(l)*n,i+Math.sin(l)*n,r,s,c,u),e.push(t+Math.cos(d)*n,i+Math.sin(d)*n,r,s,c,u)}}const Mt=`// Terrain render shader — fullscreen quad that reads a grid storage buffer
// and outputs colored pixels for each material type.

struct Uniforms {
  resolution: vec2f,
  gridSize: vec2u,
  time: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

// Fullscreen quad positions (NDC)
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
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4f(QUAD_POS[vertexIndex], 0.0, 1.0);
  return out;
}

// Material constants
const MAT_AIR: u32    = 0u;
const MAT_GRASS: u32  = 1u;
const MAT_DIRT: u32   = 2u;
const MAT_STONE: u32  = 3u;
const MAT_RUBBLE: u32 = 4u;

// Simple hash for per-cell noise
fn hash(p: vec2u) -> f32 {
  let n = p.x * 73u + p.y * 157u + 37u;
  let h = (n ^ (n >> 8u)) * 2654435761u;
  return f32(h & 0xFFFFu) / 65535.0;
}

fn getMaterial(gx: i32, gy: i32) -> u32 {
  if (gx < 0 || gx >= i32(uniforms.gridSize.x) || gy < 0 || gy >= i32(uniforms.gridSize.y)) {
    return MAT_AIR;
  }
  let idx = u32(gy) * uniforms.gridSize.x + u32(gx);
  // 4 cells packed per u32
  let word = grid[idx / 4u];
  let byteOff = (idx % 4u) * 8u;
  return (word >> byteOff) & 0xFFu;
}

fn isAir(gx: i32, gy: i32) -> bool {
  return getMaterial(gx, gy) == MAT_AIR;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let fragPos = input.position.xy;
  let gx = i32(fragPos.x) / 2;
  let gy = i32(fragPos.y) / 2;
  let mat = getMaterial(gx, gy);

  if (mat == MAT_AIR) {
    // Sky gradient
    let t = fragPos.y / uniforms.resolution.y;
    let skyTop = vec3f(0.04, 0.04, 0.12);
    let skyBot = vec3f(0.10, 0.07, 0.20);
    return vec4f(mix(skyTop, skyBot, t), 1.0);
  }

  let noise = hash(vec2u(u32(gx), u32(gy)));

  // Edge detection: darken if adjacent to air
  var edgeFactor = 1.0;
  if (isAir(gx - 1, gy) || isAir(gx + 1, gy) || isAir(gx, gy - 1) || isAir(gx, gy + 1)) {
    edgeFactor = 0.78;
  }

  // Sub-cell variation based on pixel position within the 2x2 cell
  let subX = f32(i32(fragPos.x) % 2);
  let subY = f32(i32(fragPos.y) % 2);
  let subVar = 1.0 - (subX + subY) * 0.015;

  var color = vec3f(0.0);

  if (mat == MAT_GRASS) {
    // Green with brightness variation
    let surfaceHighlight = select(0.0, 0.12, isAir(gx, gy - 1));
    color = vec3f(0.25 + noise * 0.08, 0.52 + noise * 0.10 + surfaceHighlight, 0.20 + noise * 0.06);
  } else if (mat == MAT_DIRT) {
    // Brown — darker deeper (check distance from air above)
    var depth = 0.0;
    for (var dy = 1; dy <= 8; dy++) {
      if (isAir(gx, gy - dy)) {
        depth = f32(dy) / 8.0;
        break;
      }
    }
    if (depth == 0.0) { depth = 1.0; } // deep underground
    let lightBrown = vec3f(0.50, 0.35, 0.16);
    let darkBrown = vec3f(0.28, 0.18, 0.07);
    color = mix(lightBrown, darkBrown, depth) + noise * 0.03;
  } else if (mat == MAT_RUBBLE) {
    // Warm light brown — loose material
    color = vec3f(0.52 + noise * 0.08, 0.38 + noise * 0.06, 0.20 + noise * 0.04);
  } else if (mat == MAT_STONE) {
    // Gray
    color = vec3f(0.40 + noise * 0.06, 0.40 + noise * 0.06, 0.45 + noise * 0.06);
  }

  color *= edgeFactor * subVar;
  return vec4f(color, 1.0);
}
`,ue=Math.ceil(C*Y/4)*4;function Rt(e){const{device:t,format:i}=e,n=t.createBuffer({size:ue,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),a=t.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),o=t.createShaderModule({code:Mt}),r=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}]}),s=t.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:n}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:o,entryPoint:"vs_main"},fragment:{module:o,entryPoint:"fs_main",targets:[{format:i}]},primitive:{topology:"triangle-list"}}),bindGroup:s,uniformBuffer:a,gridBuffer:n}}function Pt(e,t,i,n,a,o){const r=new Uint32Array(ue/4),s=i.cells,c=i.width*i.height;for(let d=0;d<c;d+=4)r[d>>2]=(s[d]||0)|(s[d+1]||0)<<8|(s[d+2]||0)<<16|(s[d+3]||0)<<24;e.queue.writeBuffer(t.gridBuffer,0,r.buffer);const u=new ArrayBuffer(32),f=new Float32Array(u),l=new Uint32Array(u);f[0]=a,f[1]=o,l[2]=i.width,l[3]=i.height,f[4]=n,e.queue.writeBuffer(t.uniformBuffer,0,u)}function wt(e,t){e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.draw(6)}const Lt=600,Tt=200,Bt=20,_t=3e3,ie=5;function St(e){const i=Math.PI*ie*ie+_t*e;return Math.sqrt(i/Math.PI)}function q(e,t){return e-Bt-t}function At(){return{charging:!1,chargeTime:0,chargeType:null,spiritRadius:0}}function Ut(e){return e<.3?1:e<.8?2:3}function re(e){return Math.min(e/1.2,1)}function Et(e,t,i,n){const a=Ut(e),o=a===1?4:a===2?7:12,r=a/3;return{x:t+n*15,y:i-5,vx:n*Lt,vy:0,radius:o,power:r,type:"charge_shot",alive:!0,level:a}}function Gt(e,t,i,n,a){const o=Math.min(t/60,1),r=Tt*(1-o*.7),s=a===1?Math.PI*.25:Math.PI*.75,c=q(n,t);return{x:i,y:c,vx:Math.cos(s)*r*a,vy:Math.abs(Math.sin(s)*r),radius:t,power:Math.min(e/3,1),type:"spirit_bomb",alive:!0,level:0}}function It(e){return e.type==="spirit_bomb"?e.radius*1.5:8+e.power*24}function Ot(e,t,i,n){const a=[];for(const o of e)if(o.alive){if(o.type==="spirit_bomb"&&(o.vy+=200*n),o.x+=o.vx*n,o.y+=o.vy*n,Se(o,i)){o.alive=!1;const r=It(o),s=Le(i,o.x,o.y,r);a.push({proj:o,carve:s})}(o.x<t.killZone.left||o.x>t.killZone.right||o.y>t.killZone.bottom||o.y<t.killZone.top)&&(o.alive=!1)}return a}const D=1/60,B=4096;async function kt(){const e=document.getElementById("game-canvas"),t=document.getElementById("fallback"),i=await xe(e);if(!i){e.style.display="none",t.style.display="block";return}const n=i;be();const a=Me(),o=ze(a.spawnPoint.x,a.spawnPoint.y),r=At(),s=[],c=Re(a.platforms),u=Rt(n),f=et(n),l=lt(n,B),d=bt(n),h={value:0};let m=0,b=performance.now(),v=0,L=0;function fe(P,y){const p=o.dead;if(Ye(o,P,a,c,y),p&&!o.dead&&ne(l.cpuData,B,h,o.x,o.y),!p&&o.dead&&ne(l.cpuData,B,h,o.x,o.y),o.dead)return;if(le(P,o,r,y),r.charging){const x=re(r.chargeTime);if(it(l.cpuData,B,h,o.x,o.y,x),r.chargeType==="spirit"&&r.spiritRadius>3){const T=q(o.y,r.spiritRadius);st(l.cpuData,B,h,o.x,T,r.spiritRadius)}}const U=Ot(s,a,c,y);for(const x of s)x.alive&&rt(l.cpuData,B,h,x.x,x.y,x.level);for(const{proj:x,carve:T}of U)at(l.cpuData,B,h,x.x,x.y,x.power),T.count>0&&ct(l.cpuData,B,h,x.x,x.y,T.count);for(let x=0;x<3;x++)we(c);for(let x=s.length-1;x>=0;x--)s[x].alive||s.splice(x,1)}function le(P,y,p,U){P.charge&&!p.charging&&(p.charging=!0,p.chargeTime=0,p.chargeType=P.up?"spirit":"mega",p.spiritRadius=0),p.charging&&P.charge&&(p.chargeTime+=U,p.chargeType==="spirit"&&(p.spiritRadius=St(p.chargeTime))),p.charging&&P.chargeReleased&&(p.chargeType==="mega"&&p.chargeTime>.05?s.push(Et(p.chargeTime,y.x,y.y,y.facing)):p.chargeType==="spirit"&&p.chargeTime>.3&&s.push(Gt(p.chargeTime,p.spiritRadius,y.x,y.y,y.facing)),p.charging=!1,p.chargeTime=0,p.chargeType=null,p.spiritRadius=0)}function J(P){const y=Math.min((P-b)/1e3,.1);b=P,m+=y;const p=ve();let U=!1;for(L=h.value;m>=D;)fe(p,D),m-=D,v+=D,U=!0;U&&ye(),h.value>L&&dt(n.device,l,L,h.value);const x=[];if(r.charging){const V=re(r.chargeTime);if(r.chargeType==="spirit"&&r.spiritRadius>3){const me=q(o.y,r.spiritRadius);x.push({x:o.x,y:me,strength:400+V*600,radius:Math.max(80,r.spiritRadius*2.5),tangent:250+V*400})}else x.push({x:o.x,y:o.y,strength:300+V*500,radius:80,tangent:200+V*300})}ht(n.device,l,x);const T=n.device.createCommandEncoder();pt(T,l,n.device,D,v);const de=n.context.getCurrentTexture().createView(),k=T.beginRenderPass({colorAttachments:[{view:de,clearValue:{r:.08,g:.08,b:.14,a:1},loadOp:"clear",storeOp:"store"}]});Pt(n.device,u,c,v,n.canvas.width,n.canvas.height),wt(k,u);const he=r.charging&&r.chargeType==="spirit";tt(k,f,n.device,o,v,he);const H=r.charging&&r.chargeType==="spirit"?r.spiritRadius:0,pe=o.x,ge=H>0?q(o.y,H):o.y;vt(k,d,n.device,s,pe,ge,H,v),gt(k,l),k.end(),n.device.queue.submit([T.finish()]),requestAnimationFrame(J)}requestAnimationFrame(J)}kt();
