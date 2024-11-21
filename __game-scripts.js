var{createScript:createScript}=pc;class VirtualJoystick{app;entity;constructor(t,i,e,s,n,a){this.app=t,this.entity=i,this.app.on(s,(function(t,i){this.entity.setLocalPosition(t,-i,0),e.setLocalPosition(t,-i,0),this.entity.element.enabled=!0,e.element.enabled=!0}),this),this.app.on(n,(function(t,i){e.setLocalPosition(t,-i,0)}),this),this.app.on(a,(function(){this.entity.element.enabled=!1,e.element.enabled=!1}),this)}}const VirtualJoystickScript=createScript("virtualJoystick");VirtualJoystickScript.attributes.add("stick",{type:"entity"}),VirtualJoystickScript.attributes.add("enableEvent",{type:"string"}),VirtualJoystickScript.attributes.add("moveEvent",{type:"string"}),VirtualJoystickScript.attributes.add("disableEvent",{type:"string"}),VirtualJoystickScript.prototype.initialize=function(){this.joystick=new VirtualJoystick(this.app,this.entity,this.stick,this.enableEvent,this.moveEvent,this.disableEvent)};function SSAOEffect(e,t){pc.PostEffect.call(this,e),this.ssaoScript=t,this.needsDepthBuffer=!0;var i=[pc.shaderChunks.screenDepthPS,"","varying vec2 vUv0;","","//uniform sampler2D uColorBuffer;","uniform vec4 uResolution;","","uniform float uAspect;","","#define saturate(x) clamp(x,0.0,1.0)","","// Largely based on 'Dominant Light Shadowing'","// 'Lighting Technology of The Last of Us Part II' by Hawar Doghramachi, Naughty Dog, LLC","","const float kSSCTLog2LodRate = 3.0;","","highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {","    // this essentially returns (p * vec4(v, 1.0)).w, but we make some assumptions","    // this assumes a perspective projection","    return -v.z;","    // this assumes a perspective or ortho projection","    // return p[2][3] * v.z + p[3][3];","}","","highp float getViewSpaceZFromW(const mat4 p, const float w) {","    // this assumes a perspective projection","    return -w;","    // this assumes a perspective or ortho projection","   // return (w - p[3][3]) / p[2][3];","}","","","const float kLog2LodRate = 3.0;","","vec2 sq(const vec2 a) {","    return a * a;","}","","uniform float uInvFarPlane;","","vec2 pack(highp float depth) {","// we need 16-bits of precision","    highp float z = clamp(depth * uInvFarPlane, 0.0, 1.0);","    highp float t = floor(256.0 * z);","    mediump float hi = t * (1.0 / 256.0);   // we only need 8-bits of precision","    mediump float lo = (256.0 * z) - t;     // we only need 8-bits of precision","    return vec2(hi, lo);","}","","// random number between 0 and 1, using interleaved gradient noise","float random(const highp vec2 w) {","    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);","    return fract(m.z * fract(dot(w, m.xy)));","}","","// returns the frag coord in the GL convention with (0, 0) at the bottom-left","highp vec2 getFragCoord() {","    return gl_FragCoord.xy;","}","","highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float linearDepth) {","    return vec3((0.5 - uv) * vec2(uAspect, 1.0) * linearDepth, linearDepth);","}","","highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {","    return normalize(cross(dpdx, dpdy));","}","","// Compute normals using derivatives, which essentially results in half-resolution normals","// this creates arifacts around geometry edges.","// Note: when using the spirv optimizer, this results in much slower execution time because","//       this whole expression is inlined in the AO loop below.","highp vec3 computeViewSpaceNormal(const highp vec3 position) {","    return faceNormal(dFdx(position), dFdy(position));","}","","// Compute normals directly from the depth texture, resulting in full resolution normals","// Note: This is actually as cheap as using derivatives because the texture fetches","//       are essentially equivalent to textureGather (which we don't have on ES3.0),","//       and this is executed just once.","highp vec3 computeViewSpaceNormal(const highp vec3 position, const highp vec2 uv) {","    highp vec2 uvdx = uv + vec2(uResolution.z, 0.0);","    highp vec2 uvdy = uv + vec2(0.0, uResolution.w);","    highp vec3 px = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));","    highp vec3 py = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));","    highp vec3 dpdx = px - position;","    highp vec3 dpdy = py - position;","    return faceNormal(dpdx, dpdy);","}","","// Ambient Occlusion, largely inspired from:","// 'The Alchemy Screen-Space Ambient Obscurance Algorithm' by Morgan McGuire","// 'Scalable Ambient Obscurance' by Morgan McGuire, Michael Mara and David Luebke","","uniform vec2 uSampleCount;","uniform float uSpiralTurns;","","#define PI (3.14159)","","vec3 tapLocation(float i, const float noise) {","    float offset = ((2.0 * PI) * 2.4) * noise;","    float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;","    float radius = (i + noise + 0.5) * uSampleCount.y;","    return vec3(cos(angle), sin(angle), radius * radius);","}","","highp vec2 startPosition(const float noise) {","    float angle = ((2.0 * PI) * 2.4) * noise;","    return vec2(cos(angle), sin(angle));","}","","uniform vec2 uAngleIncCosSin;","","highp mat2 tapAngleStep() {","    highp vec2 t = uAngleIncCosSin;","    return mat2(t.x, t.y, -t.y, t.x);","}","","vec3 tapLocationFast(float i, vec2 p, const float noise) {","    float radius = (i + noise + 0.5) * uSampleCount.y;","    return vec3(p, radius * radius);","}","","uniform float uMaxLevel;","uniform float uInvRadiusSquared;","uniform float uMinHorizonAngleSineSquared;","uniform float uBias;","uniform float uPeak2;","","void computeAmbientOcclusionSAO(inout float occlusion, float i, float ssDiskRadius,","        const highp vec2 uv,  const highp vec3 origin, const vec3 normal,","        const vec2 tapPosition, const float noise) {","","    vec3 tap = tapLocationFast(i, tapPosition, noise);","","    float ssRadius = max(1.0, tap.z * ssDiskRadius);","","    vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uResolution.zw;","","    float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));","    highp float occlusionDepth = -getLinearScreenDepth(uvSamplePos);","    highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);","","    // now we have the sample, compute AO","    vec3 v = p - origin;        // sample vector","    float vv = dot(v, v);       // squared distance","    float vn = dot(v, normal);  // distance * cos(v, normal)","","    // discard samples that are outside of the radius, preventing distant geometry to","    // cast shadows -- there are many functions that work and choosing one is an artistic","    // decision.","    float w = max(0.0, 1.0 - vv * uInvRadiusSquared);","    w = w*w;","","    // discard samples that are too close to the horizon to reduce shadows cast by geometry","    // not sufficiently tessellated. The goal is to discard samples that form an angle 'beta'","    // smaller than 'epsilon' with the horizon. We already have dot(v,n) which is equal to the","    // sin(beta) * |v|. So the test simplifies to vn^2 < vv * sin(epsilon)^2.","    w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);","","    occlusion += w * max(0.0, vn + origin.z * uBias) / (vv + uPeak2);","}","","uniform float uProjectionScaleRadius;","uniform float uIntensity;","","float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {","    float noise = random(getFragCoord());","    highp vec2 tapPosition = startPosition(noise);","    highp mat2 angleStep = tapAngleStep();","","    // Choose the screen-space sample radius","    // proportional to the projected area of the sphere","    float ssDiskRadius = -(uProjectionScaleRadius / origin.z);","","    float occlusion = 0.0;","    for (float i = 0.0; i < uSampleCount.x; i += 1.0) {","        computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);","        tapPosition = angleStep * tapPosition;","    }","    return sqrt(occlusion * uIntensity);","}","","uniform float uPower;","","void main() {","    highp vec2 uv = vUv0; //variable_vertex.xy; // interpolated to pixel center","","    highp float depth = -getLinearScreenDepth(vUv0);","    highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);","    vec3 normal = computeViewSpaceNormal(origin, uv);","","    float occlusion = 0.0;","","    if (uIntensity > 0.0) {","        occlusion = scalableAmbientObscurance(uv, origin, normal);","    }","","    // occlusion to visibility","    float aoVisibility = pow(saturate(1.0 - occlusion), uPower);","","    vec4 inCol = vec4(1.0, 1.0, 1.0, 1.0); //texture2D( uColorBuffer,  uv );","","    gl_FragColor.r = aoVisibility; //postProcess.color.rgb = vec3(aoVisibility, pack(origin.z));","}","","void main_old()","{","    vec2 aspectCorrect = vec2( 1.0, uAspect );","","    float depth = getLinearScreenDepth(vUv0);","    gl_FragColor.r = fract(floor(depth*256.0*256.0)),fract(floor(depth*256.0)),fract(depth);","}"].join("\n"),o=[pc.shaderChunks.screenDepthPS,"","varying vec2 vUv0;","","uniform sampler2D uSSAOBuffer;","uniform vec4 uResolution;","","uniform float uAspect;","","uniform int uBilatSampleCount;","uniform float uFarPlaneOverEdgeDistance;","uniform float uBrightness;","","float random(const highp vec2 w) {","    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);","    return fract(m.z * fract(dot(w, m.xy)));","}","","float bilateralWeight(in float depth, in float sampleDepth) {","    float diff = (sampleDepth - depth) * uFarPlaneOverEdgeDistance;","    return max(0.0, 1.0 - diff * diff);","}","","void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {","    // ambient occlusion sample","    float ssao = texture2D( uSSAOBuffer, position ).r;","    float tdepth = -getLinearScreenDepth( position );","","    // bilateral sample","    float bilateral = bilateralWeight(depth, tdepth);","    bilateral *= weight;","    sum += ssao * bilateral;","    totalWeight += bilateral;","}","","void main() {","    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center","","    // we handle the center pixel separately because it doesn't participate in bilateral filtering","    float depth = -getLinearScreenDepth(vUv0); // unpack(data.gb);","    float totalWeight = 0.0; // float(uBilatSampleCount*2+1)*float(uBilatSampleCount*2+1);","    float ssao = texture2D( uSSAOBuffer, vUv0 ).r;","    float sum = ssao * totalWeight;","","    for (int x = -uBilatSampleCount; x <= uBilatSampleCount; x++) {","       for (int y = -uBilatSampleCount; y < uBilatSampleCount; y++) {","           float weight = 1.0;","           vec2 offset = vec2(x,y)*uResolution.zw;","           tap(sum, totalWeight, weight, depth, uv + offset);","       }","    }","","    float ao = sum / totalWeight;","","    // simple dithering helps a lot (assumes 8 bits target)","    // this is most useful with high quality/large blurs","    // ao += ((random(gl_FragCoord.xy) - 0.5) / 255.0);","","    ao = mix(ao, 1.0, uBrightness);","    gl_FragColor.a = ao;","}"].join("\n"),a=["varying vec2 vUv0;","uniform sampler2D uColorBuffer;","uniform sampler2D uSSAOBuffer;","","void main(void)","{","    vec4 inCol = texture2D( uColorBuffer, vUv0 );","    float ssao = texture2D( uSSAOBuffer, vUv0 ).a;","    gl_FragColor.rgb = inCol.rgb * ssao;","    gl_FragColor.a = inCol.a;","}"].join("\n"),s={aPosition:pc.SEMANTIC_POSITION};this.ssaoShader=pc.createShaderFromCode(e,pc.PostEffect.quadVertexShader,i,"SsaoShader",s),this.blurShader=pc.createShaderFromCode(e,pc.PostEffect.quadVertexShader,o,"SsaoBlurShader",s),this.outputShader=pc.createShaderFromCode(e,pc.PostEffect.quadVertexShader,a,"SsaoOutputShader",s),this.radius=4,this.brightness=0,this.samples=20,this.downscale=1}SSAOEffect.prototype=Object.create(pc.PostEffect.prototype),SSAOEffect.prototype.constructor=SSAOEffect,SSAOEffect.prototype._destroy=function(){this.target&&(this.target.destroyTextureBuffers(),this.target.destroy(),this.target=null),this.blurTarget&&(this.blurTarget.destroyTextureBuffers(),this.blurTarget.destroy(),this.blurTarget=null)},SSAOEffect.prototype._resize=function(e){var t=Math.ceil(e.colorBuffer.width/this.downscale),i=Math.ceil(e.colorBuffer.height/this.downscale);if(t!==this.width||i!==this.height){this.width=t,this.height=i,this._destroy();var o=new pc.Texture(this.device,{format:pc.PIXELFORMAT_RGBA8,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE,width:this.width,height:this.height,mipmaps:!1});o.name="SSAO Result",this.target=new pc.RenderTarget({name:"SSAO Result Render Target",colorBuffer:o,depth:!1});var a=new pc.Texture(this.device,{format:pc.PIXELFORMAT_RGBA8,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE,width:this.width,height:this.height,mipmaps:!1});a.name="SSAO Blur",this.blurTarget=new pc.RenderTarget({name:"SSAO Blur Render Target",colorBuffer:a,depth:!1})}},Object.assign(SSAOEffect.prototype,{render:function(e,t,i){this._resize(e);var o=this.device,a=o.scope,s=this.samples,r=1/(s-.5)*10*2*3.141,n=this.radius,l=.1*n,u=2*l*3.141*.125,c=.5*o.height,h=this.ssaoScript.entity.camera.farClip;a.resolve("uAspect").setValue(this.width/this.height),a.resolve("uResolution").setValue([this.width,this.height,1/this.width,1/this.height]),a.resolve("uBrightness").setValue(this.brightness),a.resolve("uInvFarPlane").setValue(1/h),a.resolve("uSampleCount").setValue([s,1/s]),a.resolve("uSpiralTurns").setValue(10),a.resolve("uAngleIncCosSin").setValue([Math.cos(r),Math.sin(r)]),a.resolve("uMaxLevel").setValue(0),a.resolve("uInvRadiusSquared").setValue(1/(n*n)),a.resolve("uMinHorizonAngleSineSquared").setValue(0),a.resolve("uBias").setValue(.001),a.resolve("uPeak2").setValue(l*l),a.resolve("uIntensity").setValue(u),a.resolve("uPower").setValue(1),a.resolve("uProjectionScaleRadius").setValue(c*n),this.drawQuad(this.target,this.ssaoShader,i),a.resolve("uSSAOBuffer").setValue(this.target.colorBuffer),a.resolve("uFarPlaneOverEdgeDistance").setValue(1),a.resolve("uBilatSampleCount").setValue(4),this.drawQuad(this.blurTarget,this.blurShader,i),a.resolve("uSSAOBuffer").setValue(this.blurTarget.colorBuffer),a.resolve("uColorBuffer").setValue(e.colorBuffer),this.drawQuad(t,this.outputShader,i)}});var SSAO=pc.createScript("ssao");SSAO.attributes.add("radius",{type:"number",default:4,min:0,max:20,title:"Radius"}),SSAO.attributes.add("brightness",{type:"number",default:0,min:0,max:1,title:"Brightness"}),SSAO.attributes.add("samples",{type:"number",default:16,min:1,max:256,title:"Samples"}),SSAO.attributes.add("downscale",{type:"number",default:1,min:1,max:4,title:"Downscale"}),SSAO.prototype.initialize=function(){this.effect=new SSAOEffect(this.app.graphicsDevice,this),this.effect.radius=this.radius,this.effect.brightness=this.brightness,this.effect.samples=this.samples,this.effect.downscale=this.downscale,this.on("attr",(function(e,t){this.effect[e]=t}),this);var e=this.entity.camera.postEffects;e.addEffect(this.effect),this.on("state",(function(t){t?e.addEffect(this.effect):e.removeEffect(this.effect)})),this.on("destroy",(function(){e.removeEffect(this.effect),this.effect._destroy()}))};var{createScript:createScript,Vec2:Vec2}=pc;function applyRadialDeadZone(e,t,i,s){const a=e.length();if(a>i){const n=1-s-i,o=Math.min(1,(a-i)/n);t.copy(e).scale(o/a)}else t.set(0,0)}class DesktopInput{_canvas;_enabled=!0;app;constructor(e){this.app=e,this._canvas=e.graphicsDevice.canvas,this._onKeyDown=this._onKeyDown.bind(this),this._onKeyUp=this._onKeyUp.bind(this),this._onMouseDown=this._onMouseDown.bind(this),this._onMouseMove=this._onMouseMove.bind(this),this.enabled=!0}set enabled(e){this._enabled=e,e?(window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),window.addEventListener("mousedown",this._onMouseDown),window.addEventListener("mousemove",this._onMouseMove)):(window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),window.removeEventListener("mousedown",this._onMouseDown),window.removeEventListener("mousemove",this._onMouseMove))}get enabled(){return this._enabled}_handleKey(e,t){switch(e.toLowerCase()){case"w":case"arrowup":this.app.fire("cc:move:forward",t);break;case"s":case"arrowdown":this.app.fire("cc:move:backward",t);break;case"a":case"arrowleft":this.app.fire("cc:move:left",t);break;case"d":case"arrowright":this.app.fire("cc:move:right",t);break;case" ":this.app.fire("cc:jump",!!t);break;case"shift":this.app.fire("cc:sprint",!!t)}}_onKeyDown(e){document.pointerLockElement===this._canvas&&(e.repeat||this._handleKey(e.key,1))}_onKeyUp(e){e.repeat||this._handleKey(e.key,0)}_onMouseDown(e){document.pointerLockElement!==this._canvas&&this._canvas.requestPointerLock()}_onMouseMove(e){if(document.pointerLockElement!==this._canvas)return;const t=e.movementX||e.mozMovementX||e.webkitMovementX||0,i=e.movementY||e.mozMovementY||e.webkitMovementY||0;this.app.fire("cc:look",t,i)}destroy(){this.enabled=!1}}class MobileInput{_device;_canvas;_enabled=!0;_lastRightTap=0;_jumpTimeout;_remappedPos=new Vec2;_leftStick={identifier:-1,center:new Vec2,pos:new Vec2};_rightStick={identifier:-1,center:new Vec2,pos:new Vec2};app;deadZone=.3;turnSpeed=30;radius=50;_doubleTapInterval=300;constructor(e){this.app=e,this._device=e.graphicsDevice,this._canvas=e.graphicsDevice.canvas,this._onTouchStart=this._onTouchStart.bind(this),this._onTouchMove=this._onTouchMove.bind(this),this._onTouchEnd=this._onTouchEnd.bind(this),this.enabled=!0}set enabled(e){this._enabled=e,e?(this._canvas.addEventListener("touchstart",this._onTouchStart,!1),this._canvas.addEventListener("touchmove",this._onTouchMove,!1),this._canvas.addEventListener("touchend",this._onTouchEnd,!1)):(this._canvas.removeEventListener("touchstart",this._onTouchStart,!1),this._canvas.removeEventListener("touchmove",this._onTouchMove,!1),this._canvas.removeEventListener("touchend",this._onTouchEnd,!1))}get enabled(){return this._enabled}_onTouchStart(e){e.preventDefault();const t=this._device.width/this._canvas.clientWidth,i=this._device.height/this._canvas.clientHeight,s=e.changedTouches;for(let e=0;e<s.length;e++){const a=s[e];if(a.pageX<=this._canvas.clientWidth/2&&-1===this._leftStick.identifier)this._leftStick.identifier=a.identifier,this._leftStick.center.set(a.pageX,a.pageY),this._leftStick.pos.set(0,0),this.app.fire("leftjoystick:enable",a.pageX*t,a.pageY*i);else if(a.pageX>this._canvas.clientWidth/2&&-1===this._rightStick.identifier){this._rightStick.identifier=a.identifier,this._rightStick.center.set(a.pageX,a.pageY),this._rightStick.pos.set(0,0),this.app.fire("rightjoystick:enable",a.pageX*t,a.pageY*i);const e=Date.now();e-this._lastRightTap<this._doubleTapInterval&&(this._jumpTimeout&&clearTimeout(this._jumpTimeout),this.app.fire("cc:jump",!0),this._jumpTimeout=setTimeout((()=>this.app.fire("cc:jump",!1)),50)),this._lastRightTap=e}}}_onTouchMove(e){e.preventDefault();const t=this._device.width/this._canvas.clientWidth,i=this._device.height/this._canvas.clientHeight,s=e.changedTouches;for(let e=0;e<s.length;e++){const a=s[e];a.identifier===this._leftStick.identifier?(this._leftStick.pos.set(a.pageX,a.pageY),this._leftStick.pos.sub(this._leftStick.center),this._leftStick.pos.scale(1/this.radius),this.app.fire("leftjoystick:move",a.pageX*t,a.pageY*i)):a.identifier===this._rightStick.identifier&&(this._rightStick.pos.set(a.pageX,a.pageY),this._rightStick.pos.sub(this._rightStick.center),this._rightStick.pos.scale(1/this.radius),this.app.fire("rightjoystick:move",a.pageX*t,a.pageY*i))}}_onTouchEnd(e){e.preventDefault();for(var t=e.changedTouches,i=0;i<t.length;i++){var s=t[i];s.identifier===this._leftStick.identifier?(this._leftStick.identifier=-1,this.app.fire("cc:move:forward",0),this.app.fire("cc:move:backward",0),this.app.fire("cc:move:left",0),this.app.fire("cc:move:right",0),this.app.fire("leftjoystick:disable")):s.identifier===this._rightStick.identifier&&(this._rightStick.identifier=-1,this.app.fire("rightjoystick:disable"))}}update(e){if(-1!==this._leftStick.identifier){applyRadialDeadZone(this._leftStick.pos,this._remappedPos,this.deadZone,0);const e=-this._remappedPos.y;this._lastForward!==e&&(e>0&&(this.app.fire("cc:move:forward",Math.abs(e)),this.app.fire("cc:move:backward",0)),e<0&&(this.app.fire("cc:move:forward",0),this.app.fire("cc:move:backward",Math.abs(e))),0===e&&(this.app.fire("cc:move:forward",0),this.app.fire("cc:move:backward",0)),this._lastForward=e);const t=this._remappedPos.x;this._lastStrafe!==t&&(t>0&&(this.app.fire("cc:move:left",0),this.app.fire("cc:move:right",Math.abs(t))),t<0&&(this.app.fire("cc:move:left",Math.abs(t)),this.app.fire("cc:move:right",0)),0===t&&(this.app.fire("cc:move:left",0),this.app.fire("cc:move:right",0)),this._lastStrafe=t)}if(-1!==this._rightStick.identifier){applyRadialDeadZone(this._rightStick.pos,this._remappedPos,this.deadZone,0);const e=this._remappedPos.x*this.turnSpeed,t=this._remappedPos.y*this.turnSpeed;this.app.fire("cc:look",e,t)}}destroy(){this.enabled=!1}}class GamePadInput{_jumpTimeout;_lastForward=0;_lastStrafe=0;_lastJump=!1;_remappedPos=new Vec2;_leftStick={center:new Vec2,pos:new Vec2};_rightStick={center:new Vec2,pos:new Vec2};app;deadZoneLow=.1;deadZoneHigh=.1;turnSpeed=30;constructor(e){this.app=e}update(e){const t=navigator.getGamepads?navigator.getGamepads():[];for(let e=0;e<t.length;e++){const i=t[e];if(i&&"standard"===i.mapping&&i.axes.length>=4){this._leftStick.pos.set(i.axes[0],i.axes[1]),applyRadialDeadZone(this._leftStick.pos,this._remappedPos,this.deadZoneLow,this.deadZoneHigh);const e=-this._remappedPos.y;this._lastForward!==e&&(e>0&&(this.app.fire("cc:move:forward",Math.abs(e)),this.app.fire("cc:move:backward",0)),e<0&&(this.app.fire("cc:move:forward",0),this.app.fire("cc:move:backward",Math.abs(e))),0===e&&(this.app.fire("cc:move:forward",0),this.app.fire("cc:move:backward",0)),this._lastForward=e);const t=this._remappedPos.x;this._lastStrafe!==t&&(t>0&&(this.app.fire("cc:move:left",0),this.app.fire("cc:move:right",Math.abs(t))),t<0&&(this.app.fire("cc:move:left",Math.abs(t)),this.app.fire("cc:move:right",0)),0===t&&(this.app.fire("cc:move:left",0),this.app.fire("cc:move:right",0)),this._lastStrafe=t),this._rightStick.pos.set(i.axes[2],i.axes[3]),applyRadialDeadZone(this._rightStick.pos,this._remappedPos,this.deadZoneLow,this.deadZoneHigh);const s=this._remappedPos.x*this.turnSpeed,a=this._remappedPos.y*this.turnSpeed;this.app.fire("cc:look",s,a),i.buttons[0].pressed&&!this._lastJump&&(this._jumpTimeout&&clearTimeout(this._jumpTimeout),this.app.fire("cc:jump",!0),this._jumpTimeout=setTimeout((()=>this.app.fire("cc:jump",!1)),50)),this._lastJump=i.buttons[0].pressed}}}destroy(){}}const DesktopInputScript=createScript("desktopInput");DesktopInputScript.prototype.initialize=function(){this.input=new DesktopInput(this.app),this.on("enable",(()=>this.input.enabled=!0)),this.on("disable",(()=>this.input.enabled=!1)),this.on("destroy",(()=>this.input.destroy()))};const MobileInputScript=createScript("mobileInput");MobileInputScript.attributes.add("deadZone",{title:"Dead Zone",description:"Radial thickness of inner dead zone of the virtual joysticks. This dead zone ensures the virtual joysticks report a value of 0 even if a touch deviates a small amount from the initial touch.",type:"number",min:0,max:.4,default:.3}),MobileInputScript.attributes.add("turnSpeed",{title:"Turn Speed",description:"Maximum turn speed in degrees per second",type:"number",default:30}),MobileInputScript.attributes.add("radius",{title:"Radius",description:"The radius of the virtual joystick in CSS pixels.",type:"number",default:50}),MobileInputScript.attributes.add("_doubleTapInterval",{title:"Double Tap Interval",description:"The time in milliseconds between two taps of the right virtual joystick for a double tap to register. A double tap will trigger a cc:jump.",type:"number",default:300}),MobileInputScript.prototype.initialize=function(){this.input=new MobileInput(this.app),this.input.deadZone=this.deadZone,this.input.turnSpeed=this.turnSpeed,this.input.radius=this.radius,this.input._doubleTapInterval=this._doubleTapInterval,this.on("enable",(()=>this.input.enabled=!0)),this.on("disable",(()=>this.input.enabled=!1)),this.on("destroy",(()=>this.input.destroy()))},MobileInputScript.prototype.update=function(e){this.input.update(e)};const GamePadInputScript=createScript("gamePadInput");GamePadInputScript.attributes.add("deadZoneLow",{title:"Low Dead Zone",description:"Radial thickness of inner dead zone of pad's joysticks. This dead zone ensures that all pads report a value of 0 for each joystick axis when untouched.",type:"number",min:0,max:.4,default:.1}),GamePadInputScript.attributes.add("deadZoneHigh",{title:"High Dead Zone",description:"Radial thickness of outer dead zone of pad's joysticks. This dead zone ensures that all pads can reach the -1 and 1 limits of each joystick axis.",type:"number",min:0,max:.4,default:.1}),GamePadInputScript.attributes.add("turnSpeed",{title:"Turn Speed",description:"Maximum turn speed in degrees per second",type:"number",default:30}),GamePadInputScript.prototype.initialize=function(){this.input=new GamePadInput(this.app),this.input.deadZoneLow=this.deadZoneLow,this.input.deadZoneHigh=this.deadZoneHigh,this.input.turnSpeed=this.turnSpeed,this.on("destroy",(()=>this.input.destroy()))},GamePadInputScript.prototype.update=function(e){this.input.update(e)};var{math:math,Vec2:Vec2,Vec3:Vec3,Mat4:Mat4}=pc;const LOOK_MAX_ANGLE=90,tmpV1=new Vec3,tmpV2=new Vec3,tmpM1=new Mat4;class CharacterController{_camera;_rigidbody;_jumping=!1;app;entity;look=new Vec2;controls={forward:0,backward:0,left:0,right:0,jump:!1,sprint:!1};lookSens=.08;speedGround=50;speedAir=5;sprintMult=1.5;velocityDampingGround=.99;velocityDampingAir=.99925;jumpForce=600;constructor(t,i,o){if(this.app=t,this.entity=o,!i)throw new Error("No camera entity found");if(this._camera=i,!o.rigidbody)throw new Error("No rigidbody component found");this._rigidbody=o.rigidbody,this.app.on("cc:look",((t,i)=>{this.look.x=math.clamp(this.look.x-i*this.lookSens,-90,90),this.look.y-=t*this.lookSens})),this.app.on("cc:move:forward",(t=>{this.controls.forward=t})),this.app.on("cc:move:backward",(t=>{this.controls.backward=t})),this.app.on("cc:move:left",(t=>{this.controls.left=t})),this.app.on("cc:move:right",(t=>{this.controls.right=t})),this.app.on("cc:jump",(t=>{this.controls.jump=t})),this.app.on("cc:sprint",(t=>{this.controls.sprint=t}))}_checkIfGrounded(){const t=this.entity.getPosition(),i=tmpV1.copy(t).add(Vec3.DOWN);i.y-=.1,this._grounded=!!this._rigidbody.system.raycastFirst(t,i)}_jump(){this._rigidbody.linearVelocity.y<0&&(this._jumping=!1),this.controls.jump&&!this._jumping&&this._grounded&&(this._jumping=!0,this._rigidbody.applyImpulse(0,this.jumpForce,0))}_look(){this._camera.setLocalEulerAngles(this.look.x,this.look.y,0)}_move(t){tmpM1.setFromAxisAngle(Vec3.UP,this.look.y);const i=tmpV1.set(0,0,0);this.controls.forward&&i.add(tmpV2.set(0,0,-this.controls.forward)),this.controls.backward&&i.add(tmpV2.set(0,0,this.controls.backward)),this.controls.left&&i.add(tmpV2.set(-this.controls.left,0,0)),this.controls.right&&i.add(tmpV2.set(this.controls.right,0,0)),tmpM1.transformVector(i,i);let o=this._grounded?this.speedGround:this.speedAir;this.controls.sprint&&(o*=this.sprintMult);const r=i.mulScalar(o*t),e=this._rigidbody.linearVelocity.add(r),s=this._grounded?this.velocityDampingGround:this.velocityDampingAir,n=Math.pow(s,1e3*t);e.x*=n,e.z*=n,this._rigidbody.linearVelocity=e}update(t){this._checkIfGrounded(),this._jump(),this._look(),this._move(t)}}const CCScript=pc.createScript("characterController");CCScript.attributes.add("camera",{type:"entity"}),CCScript.attributes.add("lookSens",{type:"number",default:.08}),CCScript.attributes.add("speedGround",{type:"number",default:50}),CCScript.attributes.add("speedAir",{type:"number",default:5}),CCScript.attributes.add("sprintMult",{type:"number",default:1.5}),CCScript.attributes.add("velocityDampingGround",{type:"number",default:.99}),CCScript.attributes.add("velocityDampingAir",{type:"number",default:.99925}),CCScript.attributes.add("jumpForce",{type:"number",default:600}),CCScript.prototype.initialize=function(){this.controller=new CharacterController(this.app,this.camera,this.entity),this.controller.lookSens=this.lookSens,this.controller.speedGround=this.speedGround,this.controller.speedAir=this.speedAir,this.controller.sprintMult=this.sprintMult,this.controller.velocityDampingGround=this.velocityDampingGround,this.controller.velocityDampingAir=this.velocityDampingAir,this.controller.jumpForce=this.jumpForce},CCScript.prototype.update=function(t){this.controller.update(t)};const AddCollider=pc.createScript("add-collider");AddCollider.prototype.initialize=function(){this.entity.findComponents("render").forEach((t=>{const e=t.entity;e.addComponent("rigidbody",{type:"static"}),e.addComponent("collision",{type:"mesh",renderAsset:t.asset})}))};var Turn=pc.createScript("turn");Turn.prototype.update=function(){this.force=new pc.Vec3},Turn.prototype.update=function(t){this.entity.getPosition();this.entity.rotateLocal(0,0,-18.25*t)};var ToggleEntities=pc.createScript("toggleEntities");ToggleEntities.prototype.initialize=function(){this.buttonEntity=this.app.root.findByName("GospelL"),this.cameraEntity=this.app.root.findByName("View"),this.cameraEntity?(this.scriptsToggled=!1,this.app.touch&&this.app.touch.on(pc.EVENT_TOUCHSTART,this.onTouchStart,this),this.app.mouse.on(pc.EVENT_MOUSEDOWN,this.onMouseDown,this)):console.error("Camera named 'View' not found")},ToggleEntities.prototype.onTouchStart=function(t){var i=t.touches[0];this.handleInput(i.x,i.y)},ToggleEntities.prototype.onMouseDown=function(t){this.handleInput(t.x,t.y)},ToggleEntities.prototype.handleInput=function(t,i){var o=this.cameraEntity.getPosition(),e=this.cameraEntity.camera.screenToWorld(t,i,this.cameraEntity.camera.farClip),n=this.app.systems.rigidbody.raycastFirst(o,e);n&&n.entity===this.buttonEntity&&this.toggleScriptsOnEntity()},ToggleEntities.prototype.toggleScriptsOnEntity=function(){if(!this.scriptsToggled){var t=this.app.root.findByName("YourEntityName");t&&this.toggleHandlerScripts(t),this.scriptsToggled=!0}},ToggleEntities.prototype.toggleHandlerScripts=function(t){var i=t.script.cssHandler;i&&(i.enabled=!i.enabled);var o=t.script.htmlHandler;o&&(o.enabled=!o.enabled),console.log("Toggled css and html handler scripts on entity")},ToggleEntities.prototype.destroy=function(){this.app.touch&&this.app.touch.off(pc.EVENT_TOUCHSTART,this.onTouchStart,this),this.app.mouse.off(pc.EVENT_MOUSEDOWN,this.onMouseDown,this)};var Switch=pc.createScript("switch");Switch.attributes.add("imageAssets",{type:"asset",assetType:"texture",array:!0,title:"Image Assets",description:"Drag and drop PNG texture assets here to cycle through."}),Switch.prototype.initialize=function(){this.entity.element?(this.imageIndex=0,this.intervalId=null,this.startCycle(4e3),console.log("Switch script initialized. Cycling through images every 2000ms.")):console.error("The entity must have an element component.")},Switch.prototype.startCycle=function(e){if(this.imageAssets&&0!==this.imageAssets.length){this.intervalId&&clearInterval(this.intervalId);var t=this;this.intervalId=setInterval((function(){t.changeToNextImage()}),e||4e3),console.log("Started cycling through images every",e||4e3,"ms.")}else console.error('No images set in the "imageAssets" attribute.')},Switch.prototype.stopCycle=function(){this.intervalId&&(clearInterval(this.intervalId),this.intervalId=null,console.log("Stopped image cycling."))},Switch.prototype.changeToNextImage=function(){if(this.imageAssets&&0!==this.imageAssets.length){var e=this.imageAssets[this.imageIndex];e&&"texture"===e.type?(e.resource?(this.entity.element.texture=e.resource,console.log("Switched to image:",e.name)):console.error("Texture not loaded for asset:",e.name),this.imageIndex=(this.imageIndex+1)%this.imageAssets.length):console.error("Invalid or missing texture asset at index:",this.imageIndex)}},Switch.prototype.onDestroy=function(){this.stopCycle()};var Changed=pc.createScript("changed");Changed.attributes.add("newUrl",{type:"string",title:"New URL",description:"The URL to navigate to on collision",default:"http://garden-xi-eight.vercel.app"}),Changed.attributes.add("triggerObject",{type:"entity",title:"Trigger Object",description:"The entity that will trigger the URL change on collision"}),Changed.attributes.add("sceneChangeObject",{type:"entity",title:"Scene Change Object",description:"The entity with the URL change functionality"}),Changed.prototype.lastSceneLoadTime=0,Changed.prototype.initialize=function(){this.sceneChangeObject&&this.sceneChangeObject.collision?this.sceneChangeObject.collision.on("contact",this.onCollisionEnter,this):console.error("sceneChangeObject is not properly set up with collision component.")},Changed.prototype.onCollisionEnter=function(e){if(console.log("Collision detected with:",e.other.name),e&&e.other===this.triggerObject){Date.now()-this.lastSceneLoadTime>=1e3?(console.log("Trigger object collided, attempting to navigate to URL:",this.newUrl),this._navigateToNewUrl()):console.log("Cooldown in effect. Waiting before navigating again.")}},Changed.prototype._navigateToNewUrl=function(){this.lastSceneLoadTime=Date.now(),window.location.href=this.newUrl};var Turn=pc.createScript("turn");Turn.attributes.add("entity",{type:"Button",description:"The entity that we want to update when the button is clicked"}),Turn.attributes.add("description",{type:"string"}),Turn.prototype.update=function(){this.entity.button.once("click",(function(t){this.force=new pc.Vec3})),Turn.prototype.update=function(t){this.entity.getPosition();this.entity.rotateLocal(0,14.25*t,0)}};var BoostAndFall=pc.createScript("boostAndFall");BoostAndFall.attributes.add("player",{type:"entity",title:"Player",description:"The player entity to boost on collision"}),BoostAndFall.attributes.add("boostForce",{type:"number",title:"Boost Force",description:"Upward force applied to the player on collision",default:500}),BoostAndFall.attributes.add("fallForce",{type:"number",title:"Fall Force",description:"Force applied to the right after the boost period",default:200}),BoostAndFall.attributes.add("boostDuration",{type:"number",title:"Boost Duration",description:"Duration (in seconds) for the upward boost before falling",default:5}),BoostAndFall.prototype.initialize=function(){this.entity.collision?(this.entity.collision.on("collisionstart",this.onCollisionStart,this),this.boostActive=!1,this.boostStartTime=null):console.error("Target object does not have a collision component.")},BoostAndFall.prototype.onCollisionStart=function(t){if(t.other===this.player&&!this.boostActive){console.log("Boost triggered for the player!"),this.boostActive=!0,this.boostStartTime=Date.now();var o=this.player.rigidbody;o?(this.originalGravity=o.gravity,o.gravity=0,o.applyImpulse(0,this.boostForce,0)):console.error("Player does not have a rigidbody component.")}},BoostAndFall.prototype.update=function(t){if(this.boostActive&&(Date.now()-this.boostStartTime)/1e3>=this.boostDuration){console.log("Boost ended. Applying fall force to the right.");var o=this.player.rigidbody;o&&(o.gravity=this.originalGravity||-9.81,o.applyImpulse(this.fallForce,0,0)),this.boostActive=!1}};