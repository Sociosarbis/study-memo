---
title: webpack.DllPlugin简单介绍配合部分源码
tags:
  - dll
  - webpack
  - externals
---

**前言**
最近深感由于公司项目过于庞大，在开发调试时，改动某处代码，常常会让 devServer 崩溃，需要重新启动打包，打包又要等待至少 5 分钟时间，严重影响开发效率这一弊病。于是乎，周末的时候看看有没有优化打包速度的方法，然后就来到这篇文章的主题了。
**正文**
所谓的 DLL 其实是一个预编译好的 JS 文件。在使用时除了打包 app 文件的 webpack config 外，需要有一个用于打包 dll 的 webpack cofig 文件。打包 dll 端需要加入 webpack.DllPlugin，app 端需要加入 webpack.DllReferencePlugin。
假如不加入这个 DllPlugin，就只会生成普通的打包好的 JS 文件，假如以后就会多产出一个 manifest.json 文件，表明这个 library 的包信息。
manifest.json 的作用在于在 app 端引入时，配合 webpack.DllReferencePlugin，生成相应的 externals 配置和把 require dll 文件里的模块的路径转成先 require dll 的父模块然后再去 require 子模块的形式。e.g.

```javascript
console.log(require("../dll/alpha"));
// 这行app端的require语句会在webpack编译后的包中变成以下形式
__webpack_require__("dll-reference alpha_21c1490edb92ec8e9390")("./alpha.js")
//前面的dll-reference alpha_21c1490edb92ec8e9390实际上是dll-reference前缀加上alpha_21c1490edb92ec8e9390这个包名
__webpack_require__("dll-reference alpha_21c1490edb92ec8e9390")
//上面的这句话实际上是下面这样返回alpha_21c1490edb92ec8e9390这个全局变量
function(module, exports) {
eval("module.exports = alpha_21c1490edb92ec8e9390;\n\n");})
//而alpha_21c1490edb92ec8e9390这个变量的定义可以简单理解为一个可以require alpha_21c1490edb92ec8e9390这个包内模块的__webpack_require__函数
var alpha_21c1490edb92ec8e9390 = (function (modules) {
    function __webpack_require__(moduleId) {
        ...
        return module.exports
    }
    return __webpack_require__
})({'./alpha': ..., ...})
```

**_通过 plugin 的配置项进行进一步的讲解_**
这个 demo 来自于 webpack 官方的 example
dll 目录结构如下

```bash
Downloads/dll
│   a.js
│   alpha.js
│   b.js
│   beta.js
│   build.js
│   c.jsx
│   README.md
│   template.md
│   webpack.config.js
│
└───dist
        alpha-manifest.json
        beta-manifest.json
        MyDll.alpha.js
        MyDll.beta.js
```

/dll/webpack.config.js

```javascript
var path = require('path')
var webpack = require('webpack')
module.exports = {
  mode: 'development',
  resolve: {
    extensions: ['.js', '.jsx']
  },
  entry: {
    alpha: ['./alpha', './a', 'module'],
    beta: ['./beta', './b', './c']
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'MyDll.[name].js',
    library: '[name]_[hash]'
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, 'dist', '[name]-manifest.json'),
      name: '[name]_[hash]'
    })
  ]
}
```

上面的 output.libray 和 DllPlugin 的 options.name 需要一致，假如 output.libray 为`'[name]'`,dll 端生成的是`var alpha = ...`而 app 端生成的是`module.exports = alpha_21c1490edb92ec8e9390`,会对应不上。
DllPlugin 的 options.path:manifest.json 的输出路径
options 里还有一个属性是 context：是一个文件路径，主要作用是 manifest.json 的 content 的 key 会转化为 js 文件路径相对于这个 context 的相对路径。
e.g.假如 alpha.js 的绝对路径是 C:\Users\Logicarlme\Downloads\dll\alpha.js,context 为 C:\Users\Logicarlme\Downloads\dll，那么 key 就等于'./alpha'

**_app 端的 webpack.config.js_**
目录结构如下

```bash
Downloads/dll-user/webpack.config.js
│   build.js
│   example.html
│   example.js
│   math.js
│   README.md
│   template.md
│   webpack.config.js
│
├───dist
└───js
        output.js
```

```javascript
// /dll-user/webpack.config.js
var path = require('path')
var webpack = require('webpack')
module.exports = {
  mode: 'development',
  entry: path.join(__dirname, 'example.js'),
  output: {
    path: path.join(__dirname, 'js'),
    filename: 'output.js'
  },
  plugins: [
    new webpack.DllReferencePlugin({
      context: path.join(__dirname, '..', 'dll', 'dist'),
      manifest: require('../dll/dist/alpha-manifest.json') // eslint-disable-line
    }),
    new webpack.DllReferencePlugin({
      scope: 'beta',
      manifest: require('../dll/dist/beta-manifest.json'), // eslint-disable-line
      extensions: ['.js', '.jsx']
    })
  ]
}

// /dll-user/example.js
console.log(require('../dll/alpha'))
console.log(require('../dll/a'))

console.log(require('beta/beta'))
console.log(require('beta/b'))
console.log(require('beta/c'))
// 上面require的路径，一种是相对路径../dll/* 一种是scope类路径 beta/*，对于路径解析下面会有进一步的说明，需要注意的是假如是相对路径的require，那么对应的文件必须真实存在于该路径，我的理解是相对路径时，webpack会强制进行对应路径的搜索，如果文件不存在就会报错，找到以后才会把module的处理交给后面的plugins。（未经源码验证）
```

plugins 里有两个 webpack.DllReferencePlugin，分别对应两个打包好的 dll 文件。
第一个 DllReferencePlugin 的 context 属性的意思是，当一个 require 解析后的 request 路径是以这个 context 开头时，那 webpack 就不会去把这个文件的内容打包进去，
而是把它作为 externals 处理，代理到 dll 包，从它里面去取。
源码部分:

```javascript
compiler.hooks.compile.tap('DllReferencePlugin', params => {
  let name = this.options.name
  let sourceType = this.options.sourceType
  let content = 'content' in this.options ? this.options.content : undefined
  if ('manifest' in this.options) {
    let manifestParameter = this.options.manifest
    let manifest
    if (typeof manifestParameter === 'string') {
      // If there was an error parsing the manifest
      // file, exit now because the error will be added
      // as a compilation error in the "compilation" hook.
      if (params['dll reference parse error ' + manifestParameter]) {
        return
      }
      manifest =
        /** @type {DllReferencePluginOptionsManifest} */ (params[
          'dll reference ' + manifestParameter
        ])
    } else {
      manifest = manifestParameter
    }
    if (manifest) {
      if (!name) name = manifest.name
      if (!sourceType) sourceType = manifest.type
      if (!content) content = manifest.content
    }
  }
  const externals = {}
  const source = 'dll-reference ' + name
  externals[source] = name
  const normalModuleFactory = params.normalModuleFactory
  new ExternalModuleFactoryPlugin(sourceType || 'var', externals).apply(
    normalModuleFactory
  ) /* 这里把"dll-reference " + name作为externals的字段，
      对应上面说的dll-reference alpha_21c1490edb92ec8e9390，
      而externals的variable的变量名就是包名alpha_21c1490edb92ec8e9390，
      对应上面提到的module.exports = alpha_21c1490edb92ec8e9390
    */
  new DelegatedModuleFactoryPlugin({
    source: source,
    type: this.options.type,
    scope: this.options.scope,
    context: this.options.context || compiler.options.context,
    content,
    extensions: this.options.extensions
  }).apply(normalModuleFactory)
  /* 这里的DelegatedModuleFactoryPlugin的作用实际上是把提到的console.log(require("../dll/alpha"));的require
    变成__webpack_require__("dll-reference alpha_21c1490edb92ec8e9390")("./alpha.js")，
    也就是说代理到dll-reference alpha_21c1490edb92ec8e9390上
    */
})

// 下面是DelegatedModuleFactoryPlugin的执行流程
apply(normalModuleFactory) {
  const scope = this.options.scope;
  if (scope) { //这里可以看一下上面beta.dll的scope
    normalModuleFactory.hooks.factory.tap(
      "DelegatedModuleFactoryPlugin",
      factory => (data, callback) => {
        const dependency = data.dependencies[0];
        const request = dependency.request;
        if (request && request.indexOf(scope + "/") === 0) {
          //可以看出它会先把scope去掉，让"." + 剩下的部分作为实际的require请求
          const innerRequest = "." + request.substr(scope.length);
          let resolved;
          if (innerRequest in this.options.content) {
            //会在manifest.json的content中找 实际的require请求 的对应字段
            resolved = this.options.content[innerRequest];
            return callback(
              null,
              new DelegatedModule(
                this.options.source,
                resolved,
                this.options.type,
                innerRequest,
                request
              )
            );
          }
          for (let i = 0; i < this.options.extensions.length; i++) {
            const extension = this.options.extensions[i];
            const requestPlusExt = innerRequest + extension;
            if (requestPlusExt in this.options.content) {
              resolved = this.options.content[requestPlusExt];
              return callback(
                null,
                new DelegatedModule(
                  this.options.source,
                  resolved,
                  this.options.type,
                  requestPlusExt,
                  request + extension
                )
              );
            }
          }
        }
        return factory(data, callback);
      }
    );
  } else {
    normalModuleFactory.hooks.module.tap(
      "DelegatedModuleFactoryPlugin",
      module => {
        if (module.libIdent) {
          // 这里其实跟上面去除scope的作用是类似的，把前面的context去掉，留下实际的request
          const request = module.libIdent(this.options);
          if (request && request in this.options.content) {
            const resolved = this.options.content[request];
            return new DelegatedModule(
              this.options.source,
              resolved,
              this.options.type,
              request,
              module
            );
          }
        }
        return module;
      }
    );
  }
}
//无论是否使用scope最后生成的都是一个DelegatedModule

//DelegatedModule的source方法可以印证上面DelegatedModuleFactoryPlugin的作用，以demo为例
source(depTemplates, runtime) {
    const dep = /** @type {DelegatedSourceDependency} */ (this.dependencies[0]);
    const sourceModule = dep.module;
    let str;

    if (!sourceModule) {
      str = WebpackMissingModule.moduleCode(this.sourceRequest);
    } else {
      str = `module.exports = (${runtime.moduleExports({
        module: sourceModule,
        request: dep.request
            })})`;//这一部分对应webpack/lib/RuntimeTemplate.js的moduleExports方法，
            //生成module.exports = __webpack_require__("dll-reference alpha_21c1490edb92ec8e9390")部分
      switch (this.type) {
        case "require":
          str += `(${JSON.stringify(this.request)})`; //这里再在str后加上("./alpha.js")
          break;
        case "object":
          str += `[${JSON.stringify(this.request)}]`;
          break;
      }

      str += ";";
    }
}
```

**_ExternalModule_**
说了 dll,其实也要顺带说一下 ExternalModule 的原理。概括来说就是把 require 模块的内容不直接写到 bundle 中，而是把他的引用作为 module 的 exports
具体可以看下下面的源码：
lib/ExternalModule.js

```javascript
    //external模块为global变量
	getSourceForGlobalVariableExternal(variableName, type) {
		if (!Array.isArray(variableName)) {
			// make it an array as the look up works the same basically
			variableName = [variableName];
		}

		// needed for e.g. window["some"]["thing"]
		const objectLookup = variableName
			.map(r => `[${JSON.stringify(r)}]`)
			.join("");
		return `(function() { module.exports = ${type}${objectLookup}; }());`;
	}
    //external模块为commonjs模块
	getSourceForCommonJsExternal(moduleAndSpecifiers) {
		if (!Array.isArray(moduleAndSpecifiers)) {
			return `module.exports = require(${JSON.stringify(
				moduleAndSpecifiers
			)});`;
		}

		const moduleName = moduleAndSpecifiers[0];
		const objectLookup = moduleAndSpecifiers
			.slice(1)
			.map(r => `[${JSON.stringify(r)}]`)
            .join("");
        //e.g. 输出格式require("some")["thing"]
		return `module.exports = require(${JSON.stringify(
			moduleName
		)})${objectLookup};`;
	}

    //external模块为amd或umd模块
	getSourceForAmdOrUmdExternal(id, optional, request) {
		const externalVariable = `__WEBPACK_EXTERNAL_MODULE_${Template.toIdentifier(
			`${id}`
		)}__`;
		const missingModuleError = optional
			? this.checkExternalVariable(externalVariable, request)
			: "";
		return `${missingModuleError}module.exports = ${externalVariable};`;
	}

    //external模块为一个普通的全局变量
	getSourceForDefaultCase(optional, request) {
		if (!Array.isArray(request)) {
			// make it an array as the look up works the same basically
			request = [request];
		}

		const variableName = request[0];
		const missingModuleError = optional
			? this.checkExternalVariable(variableName, request.join("."))
			: "";
		const objectLookup = request
			.slice(1)
			.map(r => `[${JSON.stringify(r)}]`)
            .join("");
        //e.g.输出格式module.exports = some["thing"];
		return `${missingModuleError}module.exports = ${variableName}${objectLookup};`;
    }
```

说一下 webpack.config.externals 的配置项,下面是官方示例

```javascript
module.exports = {
  //...
  externals: [
    {
      // String
      react: 'react',
      // Object
      lodash: {
        commonjs: 'lodash',
        amd: 'lodash',
        root: '_' // indicates global variable
      },
      // Array
      subtract: ['./math', 'subtract']
    },
    // Function
    function(context, request, callback) {
      if (/^yourregex$/.test(request)) {
        return callback(null, 'commonjs ' + request)
      }
      callback()
    },
    // Regex
    /^(jquery|\$)$/i
  ]
}
```

之前我一直都不明白这些配置是怎么用的，尤其是以 function 使用时，callback 的第一个参数用的是 null，这到底指代什么。还有 umd，cmd，root 这些，他们是什么情况夏才会起效的。带着上面这些疑问，我阅读了下源码:lib/ExternalModuleFactoryPlugin.js

```javascript
const handleExternal = (value, type, callback) => {
    if (typeof type === "function") {
        callback = type;
        type = undefined;
    }
    if (value === false) return factory(data, callback);
    if (value === true) value = dependency.request;
    if (type === undefined && /^[a-z0-9]+ /.test(value)) {
        const idx = value.indexOf(" ");
        type = value.substr(0, idx);
        value = value.substr(idx + 1);
    }
    callback(
        null,
        new ExternalModule(value, type || globalType, dependency.request)
    );
    return true;
};
...
if (typeof externals === "string") {
    if (externals === dependency.request) {
        return handleExternal(dependency.request, callback);
    }
} else if (Array.isArray(externals)) {
    let i = 0;
    const next = () => {
        let asyncFlag;
        const handleExternalsAndCallback = (err, module) => {
            if (err) return callback(err);
            if (!module) {
                if (asyncFlag) {
                    asyncFlag = false;
                    return;
                }
                return next();
            }
            callback(null, module);
        };

        do {
            asyncFlag = true;
            if (i >= externals.length) return callback();
            handleExternals(externals[i++], handleExternalsAndCallback);
        } while (!asyncFlag);
        asyncFlag = false;
    };

    next();
    return;
} else if (externals instanceof RegExp) {
    if (externals.test(dependency.request)) {
        return handleExternal(dependency.request, callback);
    }
} else if (typeof externals === "function") {
    externals.call(
        null,
        context,
        dependency.request,
        (err, value, type) => {
            if (err) return callback(err);
            if (value !== undefined) {
                handleExternal(value, type, callback);
            } else {
                callback();
            }
        }
    );
    return;
} else if (
    typeof externals === "object" &&
    Object.prototype.hasOwnProperty.call(externals, dependency.request)
) {
    return handleExternal(externals[dependency.request], callback);
}
callback();
};
...
```

上面的各个条件语句分别对应 externals 里各种形式的配置。
分别举例 1.`externals: 'react'` 会转成

```javascript
callback(null, new ExternalModule('react', undefined || globalType, 'react'))
```

tips：from lib/WebpackOptionsApply.js

```javascript
if (options.externals) {
  ExternalsPlugin = require('./ExternalsPlugin')
  new ExternalsPlugin(
    options.output.libraryTarget,
    //当设置了externals后，会添加一个ExternalsPlugin，而它的type默认为output.libraryTarget, 而libraryTarget默认为'var',这里是一个伏笔，后面会提到
    options.externals
  ).apply(compiler)
}
```

2.`externals: ['react', 'jquery']` 只不过是单个 externals 推广为多个，把里面的每一个配置按除 2 以外的规则进行处理,数组里面可以是 string, regExp 和 Object 3.`externals: /^(jquery|\$)$/i` 当 require 的 request 符合正则的形式时，会把这个 request 与 1 一样处理

4.

```javascript
externals: function(context, request, callback) {
      if (/^yourregex$/.test(request)) {
        return callback(null, 'commonjs ' + request)
      }
      callback()
    },
```

如果是 function 时就直接执行这个 function，而 callback 参数为

```javascript
;(err, value, type) => {
  if (err) return callback(err)
  if (value !== undefined) {
    handleExternal(value, type, callback)
  } else {
    callback()
  }
}
```

这里可以回答上面的问题，callback 的第一个参数 null 到底指的是什么，指的是否出现 err。
第二个参数'commonjs ' + request，为包导出方式 + 空格 + 模块名的形式，它会在 handleExternal 中以第一个空格分成两个字符串，字符串 1 表示 ExternalModule 的导出形式，字符串 2 为模块名 5.

```javascript
externals: {
      // String
      react: 'react',
      // Object
      lodash: {
        commonjs: 'lodash',
        amd: 'lodash',
        root: '_' // indicates global variable
      },
      // Array
      subtract: ['./math', 'subtract']
    },
```

上面 Object 的情况有三种形式：
**第一种 value 是 string，实际上是 value 是 Object 的特殊情况。表示不论是以 commonjs, amd, root 等哪种方式导出，他的变量名都是 react**
**第二种 value 是 Object, 表示根据导出的方式，返回对应的变量名**
e.g. commonjs 时是 module.exports = require('loadsh') root 时是 module.exports = \_
那这个导出方式是以什么决定的呢？如果是普通的 externals,那么就跟 1 中的 tips 代码注释写的一样，跟打包时 output.libraryTarget 一致的。如果是 dll 的情况就取
DllReferencePlugin 的 options.sourceType 或者 manifest.json 的 type 字段，如果都没有默认就是 var。这里就是 1 中的 tips 里说的伏笔，因为我之前没有在官方的例子中，找到有用过 var 字段的，以为默认是 root 或者 global 因为一般只看到 externals 中用到这两种表示全局的。但事实上他们不是划为同一种进行处理的，
看一下源码:

```javascript
//lib/ExternalModule.js
switch (this.externalType) {
			case "this":
			case "window":
			case "self":
				...
			case "global":
				...
			case "commonjs":
			case "commonjs2":
				...
			case "amd":
			case "amd-require":
			case "umd":
			case "umd2":
        ...
			default:
				...
		}
```

并且在分情况返回变量名的处理方法是`this.request[this.externalType]`，也就是说以'var'和上面的 lodash 为例子的话，那就相当于({commonjs: 'lodash',amd:'lodash',root: '\_' })['var']。那这样的话自然在编译时就变成了`module.exports=undefined`
**\_第三种 value 是 Array，它的处理方式以当包导出方式是以 var 为例说明,根据上面的 switch condition 可知当为 var 时，按 defaultCase 处理**

```javascript
getSourceForDefaultCase(optional, request) {
    ...
    //request参数代入我们的['./math', 'subtract']，可得最后return的值为module.exports = ./math["subtract"]，可以看出数组的第一个参数是作为模块名或者变量名，后面的参数作为对象的属性，一层层获取的。然后就是var的情况./math["subtract"]，显然是不合法的。如果是commonjs的话，就是require('./math')["subtract"],这个代入getSourceForCommonJsExternal可以知道。
    const variableName = request[0];
		const objectLookup = request
			.slice(1)
			.map(r => `[${JSON.stringify(r)}]`)
            .join("");
        //e.g.输出格式module.exports = some["thing"];
    return `${missingModuleError}module.exports = ${variableName}${objectLookup};`;
    }
```

##总结###
上面的解析写的比较乱，而且有很多文章内的引用，下次可以考虑使用锚点进行页内跳转。
dll 的工作流程大概是，通过 DllPlugin 打包 library 获得 js 和 manifest 文件，使用时通过 DllReferencePlugin 读取 manifest 文件，解析 dll 中包含的子模块名等信息。
DllReferencePlugin 内部，创建 ExternalModule，把 dll 加入到 externals 中，然后通过 DelegatedModule，把对实际文件的 require 请求，代理到 dll 包中。
