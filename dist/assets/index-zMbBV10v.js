(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))o(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function n(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(r){if(r.ep)return;r.ep=!0;const i=n(r);fetch(r.href,i)}})();async function Y(e){if(!navigator.gpu)return null;const t=await navigator.gpu.requestAdapter();if(!t)return null;const n=await t.requestDevice(),o=e.getContext("webgpu");if(!o)return null;const r=navigator.gpu.getPreferredCanvasFormat();return o.configure({device:n,format:r,alphaMode:"opaque"}),{device:n,context:o,format:r,canvas:e}}const v=new Set,_=new Set,U=new Set;function q(){window.addEventListener("keydown",e=>{v.has(e.code)||_.add(e.code),v.add(e.code)}),window.addEventListener("keyup",e=>{v.delete(e.code),U.add(e.code)})}function X(){const e=v.has("KeyA")||v.has("ArrowLeft"),t=v.has("KeyD")||v.has("ArrowRight"),n=v.has("KeyW")||v.has("ArrowUp"),o=["KeyW","ArrowUp"],r=o.some(f=>v.has(f)),i=o.some(f=>_.has(f)),s=o.some(f=>U.has(f)),c=v.has("Space"),u=U.has("Space");return{left:e,right:t,jump:r,jumpPressed:i,jumpReleased:s,charge:c,chargeReleased:u,up:n}}function N(){_.clear(),U.clear()}function H(){const n=[{x:130,y:380,w:700,h:32},{x:180,y:280,w:160,h:16},{x:500,y:260,w:180,h:16},{x:370,y:170,w:140,h:16}],o={left:-100,right:1060,bottom:640,top:-200},r={x:960/2,y:200};return{platforms:n,killZone:o,spawnPoint:r,width:960,height:540}}const K=980,k=2400,V=2e3,z=1200,A=280,W=-420,Z=.4,J=.1,Q=.1,$=.5,ee=1;function te(e,t){return{x:e,y:t,vx:0,vy:0,w:20,h:40,grounded:!1,facing:1,coyoteTimer:0,jumpBufferTimer:0,jumpHeld:!1,jumpCutoff:!1,dead:!1,respawnTimer:0,invulnTimer:0}}function oe(e,t,n,o){if(e.dead){e.respawnTimer-=o,e.respawnTimer<=0&&re(e,n);return}e.invulnTimer>0&&(e.invulnTimer-=o);const r=e.grounded?k:z;let i=0;if(t.left&&(i-=1),t.right&&(i+=1),i!==0)e.facing=i,e.vx+=i*r*o,Math.abs(e.vx)>A&&(e.vx=Math.sign(e.vx)*A);else{const s=(e.grounded?V:V*.5)*o;Math.abs(e.vx)<=s?e.vx=0:e.vx-=Math.sign(e.vx)*s}e.grounded?e.coyoteTimer=J:e.coyoteTimer-=o,t.jumpPressed?e.jumpBufferTimer=Q:e.jumpBufferTimer-=o,e.jumpBufferTimer>0&&e.coyoteTimer>0&&(e.vy=W,e.grounded=!1,e.coyoteTimer=0,e.jumpBufferTimer=0,e.jumpHeld=!0,e.jumpCutoff=!1),e.jumpHeld&&!e.jumpCutoff&&(t.jumpReleased||!t.jump)&&(e.vy<0&&(e.vy*=Z),e.jumpCutoff=!0),e.vy+=K*o,e.x+=e.vx*o,e.y+=e.vy*o,e.grounded=!1;for(const s of n.platforms)ne(e,s);e.grounded&&(e.jumpHeld=!1,e.jumpCutoff=!1),(e.x<n.killZone.left||e.x>n.killZone.right||e.y>n.killZone.bottom)&&ie(e)}function ne(e,t){const n=e.x-e.w/2,o=e.x+e.w/2,r=e.y-e.h/2,i=e.y+e.h/2;if(o<=t.x||n>=t.x+t.w||i<=t.y||r>=t.y+t.h)return;const s=o-t.x,c=t.x+t.w-n,u=i-t.y,f=t.y+t.h-r,a=Math.min(s,c,u,f);a===u&&e.vy>=0?(e.y=t.y-e.h/2,e.vy=0,e.grounded=!0):a===f&&e.vy<0?(e.y=t.y+t.h+e.h/2,e.vy=0):a===s?(e.x=t.x-e.w/2,e.vx=0):a===c&&(e.x=t.x+t.w+e.w/2,e.vx=0)}function ie(e){e.dead=!0,e.respawnTimer=$,e.vx=0,e.vy=0}function re(e,t){const n=t.platforms[0];e.x=n.x+Math.random()*n.w,e.y=n.y-120,e.vx=0,e.vy=0,e.dead=!1,e.grounded=!1,e.invulnTimer=ee,e.coyoteTimer=0,e.jumpBufferTimer=0}const se=`
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
  // Convert pixel coords to clip space
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
`;function ue(e,t){const{device:n,format:o}=e,r=n.createShaderModule({code:se}),i=[],s=12;for(const l of t){const{x,y:w,w:p,h:g}=l;C(i,x,w,p,g,[.34,.65,.28]);const P=[.45,.3,.15];C(i,x,w+g,p,s,P);const b=[.35,.22,.1];C(i,x,w+g,p,3,b)}const c=new Float32Array(i),u=n.createBuffer({size:c.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(u,0,c);const f=n.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(f,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const a=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),d=n.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:f}}]}),m=n.createPipelineLayout({bindGroupLayouts:[a]});return{pipeline:n.createRenderPipeline({layout:m,vertex:{module:r,entryPoint:"vs_main",buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x3"}]}]},fragment:{module:r,entryPoint:"fs_main",targets:[{format:o}]},primitive:{topology:"triangle-list"}}),vertexBuffer:u,uniformBuffer:f,bindGroup:d,vertexCount:i.length/5}}function ce(e,t){e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(t.vertexCount)}function C(e,t,n,o,r,i){const[s,c,u]=i;e.push(t,n,s,c,u),e.push(t+o,n,s,c,u),e.push(t+o,n+r,s,c,u),e.push(t,n,s,c,u),e.push(t+o,n+r,s,c,u),e.push(t,n+r,s,c,u)}const fe=512,ae=`
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
`;function de(e){const{device:t,format:n}=e,o=t.createShaderModule({code:ae}),r=t.createBuffer({size:fe*20,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),i=t.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(i,0,new Float32Array([e.canvas.width,e.canvas.height,0,0]));const s=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),c=t.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:i}}]});return{pipeline:t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[s]}),vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:n}]},primitive:{topology:"triangle-list"}}),vertexBuffer:r,uniformBuffer:i,bindGroup:c}}function me(e,t,n,o,r){if(o.dead||o.invulnTimer>0&&Math.floor(r*10)%2===0)return;const i=[],s=o.x,c=o.y,u=[1,1,1],f=c-18,a=c-10,d=c+6,m=c+o.h/2,h=a+12,l=Math.abs(o.vx)>20,x=!o.grounded,w=r*8;let p=0,g=0,B=0;x?(B=-6,p=4):l&&(p=Math.sin(w)*10,g=Math.sin(w+Math.PI)*8);const P=6,b=8;for(let E=0;E<b;E++){const O=E/b*Math.PI*2,G=(E+1)/b*Math.PI*2;I(i,s,f,s+Math.cos(O)*P,f+Math.sin(O)*P,s+Math.cos(G)*P,f+Math.sin(G)*P,u)}T(i,s,a,s,d,2.5,u);const S=s-6+p,j=s+6-p;T(i,s,d,S,m,2,u),T(i,s,d,j,m,2,u);const D=s-8+g,F=s+8-g;T(i,s,a,D,h+B,2,u),T(i,s,a,F,h+B,2,u);const R=s+o.facing*3,L=f-1;I(i,R-1.5,L-1.5,R+1.5,L-1.5,R,L+1.5,[.3,.8,1]);const y=new Float32Array(i);n.queue.writeBuffer(t.vertexBuffer,0,y),e.setPipeline(t.pipeline),e.setBindGroup(0,t.bindGroup),e.setVertexBuffer(0,t.vertexBuffer),e.draw(i.length/5)}function I(e,t,n,o,r,i,s,c){const[u,f,a]=c;e.push(t,n,u,f,a),e.push(o,r,u,f,a),e.push(i,s,u,f,a)}function T(e,t,n,o,r,i,s){const c=o-t,u=r-n,f=Math.sqrt(c*c+u*u);if(f===0)return;const a=-u/f*i*.5,d=c/f*i*.5,[m,h,l]=s;e.push(t+a,n+d,m,h,l),e.push(t-a,n-d,m,h,l),e.push(o+a,r+d,m,h,l),e.push(t-a,n-d,m,h,l),e.push(o-a,r-d,m,h,l),e.push(o+a,r+d,m,h,l)}const M=1/60;async function he(){const e=document.getElementById("game-canvas"),t=document.getElementById("fallback"),n=await Y(e);if(!n){e.style.display="none",t.style.display="block";return}const o=n;q();const r=H(),i=te(r.spawnPoint.x,r.spawnPoint.y),s=ue(o,r.platforms),c=de(o);let u=0,f=performance.now(),a=0;function d(m){const h=Math.min((m-f)/1e3,.1);f=m,u+=h;const l=X();for(;u>=M;)oe(i,l,r,M),u-=M,a+=M;N();const x=o.device.createCommandEncoder(),p={colorAttachments:[{view:o.context.getCurrentTexture().createView(),clearValue:{r:.08,g:.08,b:.14,a:1},loadOp:"clear",storeOp:"store"}]},g=x.beginRenderPass(p);ce(g,s),me(g,c,o.device,i,a),g.end(),o.device.queue.submit([x.finish()]),requestAnimationFrame(d)}requestAnimationFrame(d)}he();
