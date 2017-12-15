const Colors={
	red:0xf25346,
	white:0xd8d0d1,
	brown:0x59332e,
	pink:0xf5986e,
	brownDark:0x23190f,
	blue:0x68c3c0
};
window.addEventListener('load',init,false);
const init=()=>{
	createScene();
	createLights();
	createSea();
};
let scene,camera,fieldOfView,aspectRatio,nearPlane,farPlane,
	HEIGHT,WIDTH,renderer,container;
const createScene=()=>{
	HEIGHT=window.innerHeight;
	WIDTH=window.innerWidth;
	scene=new THREE.Scene();
	/*
		hex:Number|String,
		near:Number,
		far:Number
	*/
	scene.fog=new THREE.Fog(0xf7d9aa,100,950);
	aspectRatio=WIDTH/HEIGHT;
	fieldOfView=60;
	nearPlane=1;
	farPlane=10000;
	camera=new THREE.PerspectiveCamera(
		fieldOfView,
		aspectRatio,
		nearPlane,
		farPlane
	);
	camera.position.set(0,200,100);
	renderer=new THREE.WebGLRenderer({
		alpha:true,
		antialias:true
	});
	renderer.setSize(WIDTH,HEIGHT);
	renderer.shadowMap.enabled=true;
	container=document.getElementById('world');
	container.appendChild(render.domElement);
	window.addEventListener('resize',handleWindowResize,false);
};
const handleWindowResize=(){
	HEIGHT=window.innerHeight;
	WIDTH=window.innerWidth;
	renderer.setSize(WIDTH,HEIGHT);
	camera.aspect=WIDTH/HEGIHT;
	camera.updateProjectionMatrix();
}
let hemisphereLight,shadowLight;
const createLights=()=>{
	/*
		skyColor:Number,
		groundColor:Number,
		intensity:Number
	*/
	hemisphereLight=new THREE.HemisphereLight(0xaaaaaa,0x000000,.9);
	shadowLight=new THREE.DirectionalLight(0xffffff,.9);
	shadowLight.position.set(150,350,350);
	shadowLight.castShadow=true;
	shadowLight.shadow.camera.left=-400;
	shadowLight.shadow.camera.right=400;
	shadowLight.shadow.camera.top=400;
	shadowLight.shadow.camera.bottom=-400;
	shadowLight.shadow.camera.near=1;
	shadowLight.shadow.camera.far=1000;
	shadowLight.shadow.mapSize=new THREE.Vector2(2048,2048);
	scene.add(hemisphereLight,shadowLight);
};
class Sea{
	constructor(){
		/*
			radiusTop:Number,
			radiusBottom:Number,
			height:Number,
			radiusSegments:Number,
			heightSegements:Number
		*/
		let geom=new THREE.CylinderGeometry(600,600,800,40,10);
		geom.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/2));
		let mat=new THREE.MeshPhongMaterial({
			color:Colors.blue,
			opacity:.6
		});
		this.mesh=new THREE.Mesh(geom,mat);
		this.mesh.receiveShadow=true;
	}
}
let sea;
const createSea=()=>{
	sea=new Sea();
	sea.mesh.position.y=-600;
	scene.add(sea.mesh);
};
class Cloud{
	constructor(){
		this.mesh=new THREE.Group();
		let geom=new THREE.BoxGeometry(20,20,20),
			mat=new THREE.MeshPhongMaterial({
				color:Colors.white
			}),
			nBlocs=3+Math.random()*3|0;
		for(let i=0;i<nBlocs;i++){
			let m=new THREE.Mesh(geom,mat);
			m.position.set(i*15,Math.random()*10,Math.random()*10);
			m.rotation.set(0,Math.random()*Math.PI*2,Math.random()*Math.PI*2,'ZYX');
			let s=.1+Math.random()*.9;
			m.scale.set(s,s,s);
			m.castShadow=true;
			m.receiveShadow=true;
			this.mesh.add(m);
		}
	}
}
class Sky{
	constructor(){
		this.mesh=new THREE.Group();
		this.nClouds=20;
		let stepAngle=Math.PI*2/this.nClouds;
		for(let i=0;i<this.nClouds;i++){
			let c=new Cloud(),
				a=stepAngle*i,
				h=750+Math.random()*200;
			c.mesh.position.set(Math.cos(a)*h,Math.sin(a)*h,-400-Math.random()*400);
			c.mesh.rotation.z=a+Math.PI/2;
			let s=1+Math.random()*2;
			c.mesh.scale.set(s,s,s);
			this.mesh.add(c.mesh);
		}
	}
}
