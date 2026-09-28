---
sidebar_position: 1
description: JavaScript 的八种数据类型、类型判断、类型转换、真值假值，以及值类型与引用类型的区别。
tags: [JavaScript, 基础]
---

# 数据类型

JavaScript 的数据类型只有两大类：**原始类型（Primitive）** 和 **对象类型（Object）**。把这两类的区别搞清楚，后面看方法就不会糊涂。

## 八种数据类型

### 七种原始类型

| 类型 | `typeof` 结果 | 说明 | 示例 |
| --- | --- | --- | --- |
| `undefined` | `'undefined'` | 未定义，声明了但没赋值 | `let a;` |
| `null` | `'object'` | 空值，人为表示“没有” | `let a = null;` |
| `boolean` | `'boolean'` | 布尔值，只有两个 | `true` / `false` |
| `number` | `'number'` | 双精度浮点数，含 `NaN`、`Infinity` | `1`、`0.1`、`NaN` |
| `string` | `'string'` | 字符串 | `'hi'`、`"hi"`、`` `hi` `` |
| `symbol` | `'symbol'` | 唯一标识符，ES6 新增 | `Symbol('id')` |
| `bigint` | `'bigint'` | 任意精度整数，ES2020 新增 | `10n` |

原始类型的特点：

- **值不可变**：字符串、数字本身不能被“改”，所有看起来的修改都是产生新值。
- **按值传递**：赋值、传参时复制的是值本身，互不影响。
- `typeof null === 'object'` 是历史遗留 bug，判断 `null` 要直接用 `=== null`。

### 对象类型（引用类型）

除了上面七种，其余都是对象，例如：

```js
const obj = {name: 'Lopop'};
const arr = [1, 2, 3];
const fn = () => {};
const date = new Date();
const re = /abc/;
const map = new Map();
```

对象的特点：

- **按引用传递**：变量里存的是内存地址，赋值和传参传的是地址。
- 可以随时增删属性，值可变。

```js
const a = {n: 1};
const b = a;        // b 和 a 指向同一个对象
b.n = 2;
console.log(a.n);   // 2

const x = 1;
let y = x;          // 复制了一份值
y = 2;
console.log(x);     // 1
```

:::tip 两个判断口诀
- 两个变量是否“是同一个对象”，用 `===` 比地址；
- 两个对象内容是否相同，要自己比较字段，或者用 `JSON.stringify`、`structuredClone` 等工具。
:::

## 类型判断

### typeof

最常用，但有两个局限：`null` 返回 `'object'`，函数返回 `'function'`（其实也是对象）。

```js
typeof 1;            // 'number'
typeof '1';          // 'string'
typeof undefined;    // 'undefined'
typeof null;         // 'object'（坑）
typeof Symbol();     // 'symbol'
typeof 10n;          // 'bigint'
typeof [];           // 'object'（看不出是数组）
typeof function () {}; // 'function'
```

### 其他更精确的判断

```js
Array.isArray([]);                       // true
Array.isArray({});                       // false
[1, 2] instanceof Array;                 // true
new Date() instanceof Date;              // true
Object.prototype.toString.call([]);      // '[object Array]'
Object.prototype.toString.call(null);    // '[object Null]'
Number.isNaN(NaN);                       // true
Number.isInteger(3);                     // true
```

- 判断数组优先用 `Array.isArray()`；
- 判断普通对象、`null`、数组这种，`Object.prototype.toString.call()` 最稳；
- `instanceof` 依赖原型链，跨 iframe / realm 时可能失效。

## 类型转换

### 显式转换

```js
Number('12');        // 12
Number('');          // 0
Number('12px');      // NaN
Number(true);        // 1
Number(null);        // 0
Number(undefined);   // NaN

String(123);         // '123'
String(null);        // 'null'
String(undefined);   // 'undefined'
String([1, 2]);      // '1,2'

Boolean(0);          // false
Boolean('0');        // true！非空字符串都是 true
Boolean([]);         // true！空数组也是 true
```

字符串转数字更推荐 `parseInt` / `parseFloat`，它们会从左往右解析：

```js
parseInt('12px');        // 12
parseFloat('3.14abc');   // 3.14
parseInt('ff', 16);      // 255，第二个参数是进制
parseInt('08');          // 8
Number.parseInt === parseInt; // true，本质是同一个函数
```

### 隐式转换（了解，别依赖）

```js
'1' + 2;      // '12'，+ 遇到字符串就是拼接
'3' - 1;      // 2，- 会把字符串转数字
1 + true;     // 2
[] + {};      // '[object Object]'
'5' * '2';    // 10
!!'abc';      // true，双重取反转布尔
+'3.14';      // 3.14，一元 + 转数字
```

:::warning
`+` 是唯一一个既做加法又做拼接的运算符，和字符串混用容易出 bug。需要数字时先手动 `Number()`。
:::

## 真值与假值

转成布尔后为 `false` 的只有下面 8 个（Falsy）：

```js
false, 0, -0, 0n, '', null, undefined, NaN
```

除此之外全是真值（Truthy），包括容易误判的：

```js
Boolean('0');    // true，非空字符串
Boolean(' ');    // true，空格字符串
Boolean([]);     // true，空数组
Boolean({});     // true，空对象
Boolean(function () {}); // true
```

所以判断数组/对象是否为空，不能用 `if (arr)`，要用 `arr.length === 0`。

## 宽松相等与严格相等

- `===` 严格相等：类型不同直接 `false`，不做类型转换，**日常首选**。
- `==` 宽松相等：会做隐式转换，规则复杂。

```js
1 == '1';          // true
1 === '1';         // false
null == undefined; // true
null === undefined;// false
NaN == NaN;        // false，NaN 不等于自己
Object.is(NaN, NaN);// true
0 == -0;           // true
Object.is(0, -0);  // false
[] == false;       // true，都转成 '' 和 0
```

:::tip 例外
只有一种情况推荐用 `==`：`x == null` 可以同时判断 `null` 和 `undefined`，等价于 `x === null || x === undefined`。其他一律用 `===`。
:::

## 值类型与引用类型的常见坑

### 1. 复制

```js
const arr1 = [1, 2];
const arr2 = arr1;       // 同一份引用
arr2.push(3);
console.log(arr1);       // [1, 2, 3]

const arr3 = [...arr1];  // 浅拷贝
const arr4 = arr1.slice();
```

`[...arr]`、`{...obj}`、`Object.assign` 都只是**浅拷贝**，嵌套的对象还是共享的。深拷贝用 `structuredClone(obj)`（现代浏览器 / Node 17+）：

```js
const deep = structuredClone({a: {b: 1}});
```

### 2. 比较

```js
[1, 2] === [1, 2];        // false，地址不同
({a: 1}) === ({a: 1});    // false
const o = {};
o === o;                  // true，同一个对象
```

### 3. 函数传参

```js
function change(obj) {
  obj.n = 1;       // 会影响到外面
  obj = {n: 2};    // 重新赋值不影响外面
}
```

## number 的几个细节

```js
0.1 + 0.2 === 0.3;          // false
0.1 + 0.2;                  // 0.30000000000000004
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true，比较浮点数

Number.MAX_SAFE_INTEGER;    // 9007199254740991
Number.MIN_SAFE_INTEGER;    // -9007199254740991
10 ** 20;                   // 超出安全整数，精度会丢
BigInt(9007199254740991) + 1n; // 9007199254740992n，用 BigInt 才精确

(1.005).toFixed(2);         // '1.00'，浮点表示导致的经典坑
1 / 0;                      // Infinity
-1 / 0;                     // -Infinity
0 / 0;                      // NaN
```

- `NaN` 是“非数字”，任何和 `NaN` 的运算结果还是 `NaN`；
- 判断 `NaN` 用 `Number.isNaN(x)`，不要用全局 `isNaN`（它会把 `'abc'` 也判成 true）；
- 金额计算建议转成整数（以分为单位）或用专门库，避免浮点误差。

## 短小但常用的语法

### 可选链 `?.`

访问可能为 `null` / `undefined` 的属性时不再报错：

```js
user?.address?.city;      // 中途断掉返回 undefined
fn?.();                   // 函数可能不存在
arr?.[0];
```

### 空值合并 `??`

只在左侧为 `null` / `undefined` 时取右侧，`0` 和 `''` 会被保留：

```js
0 || 10;    // 10，|| 把 0 当假值
0 ?? 10;    // 0
'' ?? 'x';  // ''
null ?? 'x';// 'x'
```

### 解构与展开

```js
const {name, age = 18} = user;
const [first, ...rest] = [1, 2, 3];
const copy = {...user, age: 20};
```

## 小结

| 问题 | 推荐做法 |
| --- | --- |
| 判断类型 | `typeof`，数组用 `Array.isArray` |
| 判断 null / undefined | `x == null` |
| 相等比较 | `===`，`NaN` 用 `Number.isNaN` |
| 转数字 | `Number()`、`parseInt()`、`parseFloat()` |
| 转布尔 | `Boolean()`、`!!x` |
| 深拷贝 | `structuredClone()` |
| 默认值 | `??`（想保留 0 和空串时） |

接下来可以继续看 [数组方法](/docs/javascript/array-methods)、[字符串方法](/docs/javascript/string-methods) 和 [其他数据类型的方法](/docs/javascript/other-methods)。
