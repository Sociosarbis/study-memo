import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  constructor(){
    super();
    this.state={opacity:1.0,
      fontSize:'12px'};
  }
  render() {
    return (<div style={this.state}>Hello {this.props.title} {this.props.name}
      {this.props.content}
    </div>);
  }
  componentWillMount(){
  }
  componentDidMount(){
    window.setTimeout(()=>{this.setState({opacity:0.5,fontSize:'44px'});},1000);
  }

}

export default App;
