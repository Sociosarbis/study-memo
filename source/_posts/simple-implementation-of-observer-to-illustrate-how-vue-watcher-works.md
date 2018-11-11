---
title: 通过简化版的Observer的实现来说明vue的watch的工作原理
tags:
  - vue
  - watcher
---
***前言***
其实关于vue实例watch项的设置是怎么观测到数据变化的，这个问题很久之前我就很有兴趣去了解了。之前也有通过一些文章去了解过，由于懒，了解完以后就自己亲自做深入的探索或者说自己去阅读源码，所以很长的一段时间来说，我对这个机制还是有点模糊的。但是，这周周五，工作上碰到了一个问题——怎么脱离vue（或者说不去创建vue的实例设置watch项）然后去检测vuex store的变化呢。
其实这个问题最简单的，后来发现原来vuex有一个api是Vuex.store.watch能够直接监听state的变化([说明地址:https://vuex.vuejs.org/api/#watch](https://vuex.vuejs.org/api/#watch)),但是怎么能因为有现成的api而放弃这样一个看源码了解其中原理的机会呢，于是，有了下面这一段简化版的源码以及用例
***简化版源码***
其实下面的代码来自几个文件，这里为了阅读清晰就把他们放在一起了。
```javascript
(function() {
  const Dep = (function() {
      let uid = 0
      class Dep {
          constructor() {
              this.id = uid++
              this.subs = new Set()
          }
          depend() {
              if (Dep.target) {
                  Dep.target.addDep(this)
              }
          }

          removeSub(sub) {
              this.subs.delete(sub)
          }

          addSub(sub) {
              this.subs.add(sub)
          }

          notify() {
              this.subs.forEach(function(sub) {
                  sub.update()
              })
          }
      }
      Dep.target = null
      return Dep
  }
  )()

  function parsePath(exp) {
      const path = exp.split('.')
      return function(vm) {
          return path.reduce(function(result, property) {
              return result[property]
          }, vm)
      }
  }

  const Watcher = (function() {
      let uid = 0
      class Watcher {
          constructor(vm, expOrFn, cb) {
              this.id = uid++
              this.vm = vm
              this.cb = cb
              this.newDeps = new Map()
              this.deps = new Map()
              this.getter = parsePath(expOrFn)
              this.value = this.get()
          }

          get() {
              Dep.target = this
              let value
              const vm = this.vm
              value = this.getter.call(vm, vm)
              Dep.target = null
              this.cleanupDeps()
          }

          addDep(dep) {
              console.log(this.newDeps)
              const id = dep.id
              if (!this.newDeps.has(id)) {
                  this.newDeps.set(id, dep)
                  if (!this.deps.has(id)) {
                      dep.addSub(this)
                  }
              }
          }

          cleanupDeps() {
              this.deps.forEach((dep)=>{
                  if (!this.newDeps.has(dep.id)) {
                      dep.removeSub(this)
                  }
              }
              );
              let nextDeps = this.newDeps
              this.newDeps = this.deps
              this.deps = nextDeps
              this.newDeps.clear()
          }

          update() {
              const oldValue = this.value
              this.value = this.get()
              this.cb.call(this.vm, this.value, oldValue)
          }
      }
      return Watcher
  }
  )()
  const Observer = (function() {
      const arrayProto = Array.prototype
      const methodToPatch = ['push', 'pop', 'splice', 'shift', 'unshift']
      const arrayMethods = Object.create(arrayProto)
      methodToPatch.forEach(function(method) {
          const original = arrayProto[method]
          Object.defineProperty(arrayMethods, method, {
              value: function() {
                  const result = original.apply(this, args)
                  const ob = this.__ob__
                  let inserted
                  switch (method) {
                  case 'push':
                  case 'unshift':
                      inserted = args
                      break
                  case 'splice':
                      inserted = args.slice(2)
                      break
                  }
                  if (inserted)
                      ob.observeArray(inserted)
                  ob.dep.notify()
                  return result
              },
              enumerable: false
          })
      })
      function observe(value) {
          if (typeof value !== 'object')
              return
          let ob
          if (value.hasOwnProperty('__ob__')) {
              ob = value.__ob__
          } else {
              ob = new Observer(value)
          }
          return ob
      }
      class Observer {
          constructor(value) {
              this.value = value
              this.dep = new Dep()
              Object.defineProperty(value, '__ob__', {
                  value: this,
                  enumerable: false
              })
              if (Array.isArray(value)) {
                  copyAugment(value, arrayMethods, methodToPatch)
                  this.observeArray(value)
              } else {
                  this.walk(value)
              }
          }
          walk(obj) {
              const keys = Object.keys(obj)
              for (let i = 0; i < keys.length; i++) {
                  defineReactive(obj, keys[i])
              }
          }

          observeArray(items) {
              for (let i = 0, l = items.length; i < l; i++) {
                  observe(items)
              }
          }
      }
      function copyAugment(target, src, keys) {
          keys.forEach(function(key) {
              Object.defineProperty(target, key, {
                  value: src[k],
                  enumerable: false
              })
          })
      }
      function defineReactive(obj, key) {
          const dep = new Dep()
          const property = Object.getOwnPropertyDescriptor(obj, key)
          if (property) {
              const {getter, setter} = property
              let val
              if (!getter || setter) {
                  val = obj[key]
              }
              let childOb = observe(val)
              Object.defineProperty(obj, key, {
                  get: function() {
                      const value = getter ? getter.call(obj) : val
                      if (Dep.target) {
                          dep.depend()
                          if (childOb) {
                              childOb.dep.depend()
                              if (Array.isArray(value)) {
                                  dependArray(value)
                              }
                          }
                      }
                      return value
                  },
                  set: function(newVal) {
                      const value = getter ? getter.call(obj) : val
                      if (value === newVal) {
                          return
                      }
                      if (getter && !setter)
                          return
                      if (setter) {
                          setter.call(obj, newVal)
                      } else {
                          val = newVal
                      }
                      childOb = observe(newVal)
                      dep.notify()
                  }
              })
          }
      }
      function dependArray(value) {
          for (let e, i = 0, l = value.length; i < l; i++) {
              e = value[i]
              e && e.__ob__ && e.__ob__.dep.depend()
              if (Array.isArray(e)) {
                  dependArray(e)
              }
          }
      }
      return Observer
  }
  )()

  let a = {
      b: 2
  }
  new Observer(a)
  console.log(a)
  new Watcher(a,'b',function(newVal) {
      console.log('观测到更新')
  }
  )
  new Watcher(a,'b',function(newVal) {
      console.log('我也观测到更新')
  }
  )
  a.b = 3
}
)()
```
***机制总结***
上面的代码可以简单地总结为，为obj创建一个Observer，对他的每个属性都去添加getter/setter，setter是为了知道属性被设置的这一信息，同时当被设置的属性为Object的时候重新observe这个value，这样reactive的机制才不会断。
一般来说以前我一般只会用到setter这一点，而不会去使用getter，因为好像getter只是获取这个值而已，而跟观测数据变化没有什么关系的样子。但是在这里的作用是，当设置了property的getter，然后watcher创建时，获取property的值时，getter就会执行，由于此时Dep这个class的target属性被设置为当前的这个watcher，所以getter就有机会在执行的时候把这个watcher作为自己的订阅者（当setter执行时，一一去notify自己的订阅者，通知数据变化）
watcher里自身也会去维护自己的publisher（订阅的对象），应该是为了当自己不再watcher的时候，能够让publisher取消通知自己，所以说是publisher维护subscriber,subscriber维护自己的publisher，一个双向的维护（也是值得一提的点）
当observe的对象是数组时，数组首层element的变化会通过Observer的dep去发布，这一点与Object的情况略有不同。
而通过重写数组操作的一些prototype上的方法，而监听数据变化的做法，也是比较好理解的，这里就不赘述了。