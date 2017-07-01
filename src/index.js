import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import './index.css';

class Square extends React.Component{
  constructor(){
    super();
    this.state={
      value:null,
    }
  }
  render(){
    return(
      <button className='square' onClick={this.props.onClick}>
      {this.props.value}
      </button>
    );
  }
}

class Board extends React.Component{
  renderSquare(i,j){
    return <Square value={this.props.squares[i][j]} key={j.toString()} onClick={()=>this.props.onClick(i,j)}/>;
  }
  renderBoard(nrow,ncol){
    const board=[...Array(nrow)].map((row,i)=>{
      let boardRow=<div className='board-row' key={i.toString()}>
      {[...Array(ncol)].map((square,j)=>{
        return this.renderSquare(i,j)})}</div>
      return boardRow;
    });
    return board;
  }
  render(){
    return(
      <div>
        {this.renderBoard(3,3)}
      </div>
    );
  }
}
class Game extends React.Component{
  constructor(){
    super();
    this.state={
      history:[{
        squares:[...Array(3)].map(()=>[...Array(3)]),
      },],
      xIsNext:true,
      move:0,
    }
  }
  handleClick(i,j){
    const move=this.state.move;
    const history=this.state.history.slice(0,move+1);
    const current=history[move];
    const squares=deepCopy(current.squares);
    if(calculateWinner(squares||squares[i][j])){
      return;
    }
    squares[i][j]=this.state.xIsNext?'X':'O';
    this.setState({history:history.concat([{squares:squares}]),xIsNext:!this.state.xIsNext,move:move+1});
  }
  jumpTo(move){
    this.setState({xIsNext:move%2===0,move:move});
  }
  render(){
    const history=this.state.history;
    const move=this.state.move;
    const current=history[move];
    const winner=calculateWinner(current.squares);
    const moves=history.map((step,move)=>{
      const desc=move?`#Move:${move}`:'Game Start';
      return (<li href='#' key={move} onClick={()=>this.jumpTo(move)}>{desc}</li>);
    });
    let status;
    status=winner?`Winner:${winner}`:`Next player:${this.state.xIsNext?'X':'O'}`
    return(
      <div className='game'>
        <App title='Mr' name='World'/>
        <div className='game-board'>
          <Board squares={current.squares} onClick={(i,j)=>this.handleClick(i,j)}/>
        </div>
        <div className='game-info'>
          <div>{status}</div>
          <ol>{moves}</ol>
        </div>
      </div>
    )
  }
}
function calculateWinner(squares){
  const lines=[[[0,0],[0,1],[0,2]],[[1,0],[1,1],[1,2]],[[2,0],[2,1],[2,2]],
	       [[0,0],[1,0],[2,0]],[[0,1],[1,1],[2,1]],[[0,2],[1,2],[2,2]],
	       [[0,0],[1,1],[2,2]],[[0,2],[1,1],[2,0]]];
  for(let i=0;i<lines.length;i++){
    const [a,b,c]=lines[i];
    if(squares[a[0]][a[1]]&&squares[a[0]][a[1]]===squares[b[0]][b[1]]&&squares[a[0]][a[1]]===squares[c[0]][c[1]]){
      return squares[a[0]][a[1]];
    }
  }
  return null;
}
function deepCopy(item){
  let itemInDeep;
	if(item instanceof Array){
		itemInDeep=item.map(deepCopy);
    }
  else itemInDeep=item;
	return itemInDeep;
}
ReactDOM.render(<Game/>, document.getElementById('root'));
registerServiceWorker();
