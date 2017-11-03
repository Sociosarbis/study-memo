function makeRow(m){
	let array=[];
	for(let i=0;i<m;i++){
		array.push(i);
	}
	return array;
}
function randomOrderWithTemplate(n,row){
	let newRow=[];
	for(let i=0;i<n;i++){
		newRow=newRow.concat(Array.from(row));
	}
	return newRow.sort(()=>Math.random()>0.5);
}
const m=25,
	  n=100/m;
let count=0,
	randomRank=randomOrderWithTemplate(n,makeRow(m));
let board=Array.from({
	length:10
}).map(()=>{ 
	let oneRow=randomRank.slice(count,count+10);
	count+=10;
	return oneRow;
});
//获取直线垂直和水平可移动范围
function getHVRange(i,j){
	let h=[j,j],
		v=[i,i];
	while(board[i][j+1]&&j+1<=10){
		h[1]++;
	}
	while(board[i][j-1]&&j-1>=-1){
		h[0]--;
	}
	while(board[i+1][j]&&i+1<=10){
		h[1]++;
	}
	while(board[i-1][j]&&i-1>=-1){
		h[0]--;
	}
	return {h,v};
}
//找到最短连接两个方格的线段的拐点
function searchLine(p1,p2){
	let absV=Math.abs(p2.v-p1.v),
		absH=Math.abs(p2.h-p1.h),
		direction1=p1.j>=p2.j?'left':'right';
		direction2=p1.i>=p2.i?'down':'up';
		m1,m2;
	for(let offset=1;offset<=Math.max(p1.v[1]-p1.i,p1.v[0]-p1.i);offset++){
		let n1,n2=0;
		if(p1.i+offset<=p1.v[1]) n1=gothroughLine(p1.i+offset,direction1);
		if(p1.i-offset>=p1.h[0]) n2=gothroughLine(p1.i-offset,direction1);
		if(n1>=absH){
			m1={
				offset,
				pos:{
					i:p1.i+offset,
					j:p1.j
				}
			};
		}else if(n2>=absH){
			m1={
				offset,
				pos:{
					i:p1.i-offset,
					j:p1.j
				}
			};
		}
	}
	for(let offset=1;offset<=Math.max(p1.h[1]-p1.j,p1.h[0]-p1.j);offset++){
		let n1,n2=0;
		if(p1.j+offset<=p1.h[1]) n1=gothroughLine(p1.j+offset,direction2);
		if(p1.j-offset>=p1.h[0]) n2=gothroughLine(p1.j-offset,direction2);
		if(n1>=absH){
			m2={
				offset,
				pos:{
					i:p1.i,
					j:p1.j+offset
				}
			};
		}else if(n2>=absH){
			m2={
				offset,
				pos:{
					i:p1.i,
					j:p1.j-offset
				}
			};
		}
	}
	return m1.offset>=m2.offset?[m1.pos,{
		i:m1.pos.i,
		j:p2.j
		}]:[
			m2.pos,
			{
				i:p2.i,
				j:m2.pos.j
			}];
}