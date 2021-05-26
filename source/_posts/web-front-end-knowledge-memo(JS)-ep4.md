---
title: web前端知识学习笔记-JS篇(3)
tags:
  - es6
  - class
  - syntatic sugar
---
## 拆解class语法糖
下面根据经`babel`转移后的`class extends`代码，说明`class`语法糖所作工作的要点。

* 原代码
```js
class Policeman extends Person {
  constructor(name, title) {
    super(name);
    this.title = "Officer";
  }

  sayTitle() {
    super.sayTitle()
    console.log(this.title);
  }
  
  static sayHi() {
  }
}
```

* 编译代码
```js
var Policeman = /*#__PURE__*/function (_Person) {
  _inherits(Policeman, _Person);

  var _super = _createSuper(Policeman);

  function Policeman(name, title) {
    var _this;

    _classCallCheck(this, Policeman);

    _this = _super.call(this, name);
    _this.title = "Officer";
    return _this;
  }

  _createClass(Policeman, [{
    key: "sayTitle",
    value: function sayTitle() {
      _get(_getPrototypeOf(Policeman.prototype), "sayTitle", this).call(this);

      console.log(this.title);
    }
  }], [{
    key: "sayHi",
    value: function sayHi() {}
  }]);

  return Policeman;
}(Person);
```
1. `_inherits(Policeman, _Person)`
    1. 将`Policeman`的`prototype`设为`Person`的一个实例，将`Policeman`的`prototype.constructor`改写为`Policeman`
    2. 将`Policeman`的`__proto__`设为`Person`

2. `_createSuper(Policeman)`的结果可简化为下面这样，但实际上`ES6`的`class`是不允许当作函数调用的，这里只是在`Person`是普通构造函数的情况下说明
```js
function (...args) {
  return Person.apply(this, ...args)
}
``` 

3. `_classCallCheck(this, Policeman)`，模拟`ES6 class`不允许当作函数调用，当`this`不是`Policeman`的实例就报错

4. `_super.call(this, name)`执行`Person`的构造函数

5. `_createClass(Policeman, ...)`，
`_createClass`除了接收`Policeman`构造函数外，还接受两个`{ key: string, ...attrs: Descriptor }[]`（`key`为属性名，其他作为属性`descriptor`）参数，第一个是`Policeman.prototype`的属性定义数组，第二个是`Policeman`（既静态）的属性定义数组。
值得注意的是，两者定义的属性都是不可枚举的`enumerable: false`