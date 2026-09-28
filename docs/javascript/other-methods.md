---
sidebar_position: 4
description: JavaScript 中数字、Math、对象、JSON、日期、Map/Set 等常用方法速查，每个方法说明参数、作用与返回值。
tags: [JavaScript, 对象]
---

# 其他数据类型的方法

[数组](/docs/javascript/array-methods)和[字符串](/docs/javascript/string-methods)之外，日常打交道最多的就是数字、对象、JSON、日期和集合。这里按类型整理常用方法，同样按**参数、作用、返回值**说明。

## Number：数字

### 判断

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `Number.isInteger(value)` | 任意值 | 判断是否为整数 | 布尔值 |
| `Number.isFinite(value)` | 任意值 | 判断是否为有限数字，**不做类型转换** | 布尔值 |
| `Number.isNaN(value)` | 任意值 | 判断是否为真正的 `NaN`，**不做类型转换** | 布尔值 |
| `Number.isSafeInteger(value)` | 任意值 | 判断是否为安全整数 | 布尔值 |

```js
Number.isInteger(3);       // true
Number.isInteger(3.14);    // false
Number.isFinite(3);        // true
Number.isFinite('3');      // false，不把字符串转成数字
isFinite('3');             // true，全局 isFinite 会先转数字，容易误判

Number.isNaN(NaN);         // true，只对真正的 NaN 返回 true
isNaN('abc');              // true，全局 isNaN 会先转数字，不推荐

Number.isSafeInteger(2 ** 53); // false，超出安全整数范围
```

**判断 NaN 一律用 `Number.isNaN`**，全局 `isNaN` 会把非数字字符串也判成 `NaN`。

### 解析与转换

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `Number(value)` | 任意值 | 把值整体转成数字 | 数字；转不了返回 `NaN` |
| `parseInt(string, radix)` | 字符串、进制（可省略） | 从左往右解析出整数 | 数字；解析不出返回 `NaN` |
| `parseFloat(string)` | 字符串 | 从左往右解析出小数 | 数字；解析不出返回 `NaN` |
| `num.toFixed(digits)` | 保留几位小数（可省略，默认 0） | 四舍五入并保留小数位 | **字符串** |
| `num.toString(radix)` | 进制（可省略，默认 10） | 转成指定进制的字符串 | 字符串 |
| `num.toPrecision(precision)` | 有效数字位数 | 按有效数字格式化 | 字符串 |

```js
Number('12');              // 12
Number('12px');            // NaN，整体解析，不是部分解析
parseInt('12px', 10);      // 12，从左往右解析
parseFloat('3.14abc');     // 3.14
Number.parseInt('ff', 16); // 255，第二个参数是进制

(3.14159).toFixed(2);      // '3.14'，注意返回字符串
(255).toString(16);        // 'ff'
(3.14159).toPrecision(3);  // '3.14'
```

:::warning
`toFixed` 使用银行家舍入且受浮点表示影响：`(1.005).toFixed(2)` 得到 `'1.00'` 而不是 `'1.01'`。对精度敏感的金额计算建议转成整数运算。
:::

### 常量

| 常量 | 含义 |
| --- | --- |
| `Number.MAX_SAFE_INTEGER` | 最大安全整数 9007199254740991 |
| `Number.MIN_SAFE_INTEGER` | 最小安全整数 -9007199254740991 |
| `Number.EPSILON` | 浮点比较的最小容差 2.220446049250313e-16 |
| `Number.MAX_VALUE` | 最大可表示的有限正数 |

浮点比较：

```js
0.1 + 0.2 === 0.3;                          // false
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true
```

## Math：数学运算

Math 的方法都以 `Math.` 开头，**不修改任何东西**，只返回计算结果。

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `Math.round(x)` | 数字 | 四舍五入 | 整数 |
| `Math.ceil(x)` | 数字 | 向上取整 | 整数 |
| `Math.floor(x)` | 数字 | 向下取整 | 整数 |
| `Math.trunc(x)` | 数字 | 直接去掉小数部分 | 整数 |
| `Math.abs(x)` | 数字 | 取绝对值 | 数字 |
| `Math.max(...nums)` | 一组数字 | 取最大值 | 数字；没有参数返回 `-Infinity` |
| `Math.min(...nums)` | 一组数字 | 取最小值 | 数字；没有参数返回 `Infinity` |
| `Math.pow(base, exp)` | 底数、指数 | 求幂 | 数字 |
| `Math.sqrt(x)` | 数字 | 平方根 | 数字 |
| `Math.cbrt(x)` | 数字 | 立方根 | 数字 |
| `Math.sign(x)` | 数字 | 判断正负号 | 1 / -1 / 0 / -0 / `NaN` |
| `Math.random()` | 无 | 生成 `[0, 1)` 的随机小数 | 数字 |

```js
Math.round(3.5);       // 4
Math.ceil(3.1);        // 4
Math.floor(3.9);       // 3
Math.trunc(3.9);       // 3
Math.abs(-3);          // 3
Math.max(1, 5, 3);     // 5
Math.min(1, 5, 3);     // 1
Math.pow(2, 10);       // 1024
2 ** 10;               // 1024，更推荐
Math.sqrt(16);         // 4
Math.sign(-5);         // -1
Math.PI;               // 3.141592653589793
```

### 随机数

```js
Math.random();                       // [0, 1) 之间的小数
Math.floor(Math.random() * 10);      // 0 ~ 9 的整数
Math.floor(Math.random() * (max - min + 1)) + min; // [min, max] 随机整数

// 从数组随机取一个
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
```

`Math.random()` 不能用于加密场景，需要安全随机用 `crypto.getRandomValues()` / `crypto.randomUUID()`。

### 常用组合

```js
// 保留两位小数（返回数字）
Math.round(3.14159 * 100) / 100;   // 3.14

// 生成 [min, max) 随机数
Math.random() * (max - min) + min;
```

## Object：对象

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `Object.keys(obj)` | 对象 | 获取所有**可枚举自身属性**的键 | 数组 |
| `Object.values(obj)` | 对象 | 获取所有可枚举自身属性的值 | 数组 |
| `Object.entries(obj)` | 对象 | 获取 `[键, 值]` 组成的数组 | 数组 |
| `Object.fromEntries(entries)` | 键值对数组或 Map | 把键值对转成对象 | 新对象 |
| `Object.assign(target, ...sources)` | 目标对象、源对象 | 把源对象的属性合并进目标对象 | 目标对象 |
| `Object.hasOwn(obj, key)` | 对象、键 | 判断是否为自身属性（ES2022） | 布尔值 |
| `Object.is(a, b)` | 两个值 | 比 `===` 更严格的比较 | 布尔值 |
| `Object.freeze(obj)` | 对象 | 冻结对象，禁止增删改属性 | 传入的对象 |
| `Object.isFrozen(obj)` | 对象 | 判断是否被冻结 | 布尔值 |
| `Object.create(proto)` | 原型对象 | 以指定原型创建对象 | 新对象 |
| `Object.getPrototypeOf(obj)` | 对象 | 获取原型 | 原型对象 |
| `Object.getOwnPropertyNames(obj)` | 对象 | 获取全部自身属性名（含不可枚举） | 数组 |

```js
const user = {name: 'Lopop', age: 18};

Object.keys(user);       // ['name', 'age']
Object.values(user);     // ['Lopop', 18]
Object.entries(user);    // [['name', 'Lopop'], ['age', 18]]

Object.fromEntries([['a', 1], ['b', 2]]); // {a: 1, b: 2}，entries 的逆操作
Object.fromEntries(new Map([['a', 1]]));  // {a: 1}

const base = {a: 1};
const extra = {b: 2};
Object.assign(base, extra);          // 返回 base，base 变成 {a: 1, b: 2}
const merged = {...base, ...extra};  // 展开语法更常用

Object.hasOwn(user, 'name');   // true，只查自身属性
'name' in user;                // true，会查原型链
Object.is(NaN, NaN);           // true
Object.is(0, -0);              // false

Object.freeze(user);           // 返回 user，之后改属性不生效
Object.isFrozen(user);         // true
```

`Object.assign` 和展开都是**浅拷贝**，嵌套对象仍然共享引用。深拷贝用 `structuredClone`：

```js
const copy = {...user};              // 浅拷贝
const deep = structuredClone(user);  // 深拷贝（Node 17+ / 现代浏览器）
```

遍历对象的两种写法：

```js
for (const key in user) {
  if (Object.hasOwn(user, key)) console.log(key, user[key]);
}

Object.entries(user).forEach(([key, value]) => {
  console.log(key, value);
});
```

`for...in` 会遍历到原型链上的属性，所以一般配合 `Object.hasOwn`（替代 `Object.prototype.hasOwnProperty.call`）使用。

## JSON

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `JSON.stringify(value, replacer, space)` | 要序列化的值、过滤字段的数组或函数（可省略）、缩进空格数（可省略） | 把值转成 JSON 字符串 | 字符串；值为 `undefined` 或函数时返回 `undefined` |
| `JSON.parse(text, reviver)` | JSON 字符串、还原函数（可省略） | 把 JSON 字符串解析成值 | 解析后的值；非法 JSON 抛异常 |

```js
const obj = {name: 'Lopop', tags: ['a', 'b']};

JSON.stringify(obj);          // '{"name":"Lopop","tags":["a","b"]}'
JSON.stringify(obj, null, 2); // 缩进 2 空格，便于阅读
JSON.stringify(obj, ['name']);// '{"name":"Lopop"}'，只保留指定字段

JSON.parse('{"a":1}');        // {a: 1}
JSON.parse('{a:1}');          // SyntaxError，JSON 的 key 必须双引号
```

### 序列化的丢失项

`JSON.stringify` 会忽略或转换一些值：

```js
JSON.stringify({a: undefined, b: () => {}, c: Symbol(), d: 1});
// '{"d":1}'，undefined / 函数 / Symbol 被丢掉

JSON.stringify({d: new Date()});
// '{"d":"2026-09-28T00:00:00.000Z"}'，Date 变成 ISO 字符串

JSON.stringify([undefined]);  // '[null]'，数组里的会变 null
JSON.stringify({a: NaN, b: Infinity}); // '{"a":null,"b":null}'
```

- **循环引用会直接报错**：`TypeError: Converting circular structure to JSON`；
- 想让自定义对象控制序列化结果，可以实现 `toJSON()` 方法；
- `JSON.parse` 传入非法字符串会抛异常，外部数据要 `try...catch`。

```js
try {
  const data = JSON.parse(text);
} catch (err) {
  console.error('不是合法 JSON', err);
}
```

:::tip 深拷贝
`JSON.parse(JSON.stringify(obj))` 是最省事的深拷贝，但会丢失 `undefined`、函数、`Date` 类型等。更好的选择是 `structuredClone(obj)`。
:::

## Date：日期时间

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `new Date()` | 无参数 = 当前时间；也可传时间戳或日期字符串 | 创建日期对象 | Date 对象 |
| `Date.now()` | 无 | 获取当前时间戳（毫秒） | 数字 |
| `date.getTime()` | 无 | 获取时间戳 | 数字 |
| `date.getFullYear()` | 无 | 获取年份 | 数字 |
| `date.getMonth()` | 无 | 获取月份（**0 ~ 11**） | 数字 |
| `date.getDate()` | 无 | 获取几号 | 数字 |
| `date.getDay()` | 无 | 获取星期几（0 是周日） | 数字 |
| `date.getHours()` | 无 | 获取小时 | 数字 |
| `date.toISOString()` | 无 | 转成标准 ISO 格式 | 字符串 |
| `date.toLocaleString(locale)` | 语言/地区（可省略） | 按本地习惯格式化 | 字符串 |

```js
const now = new Date();          // 当前时间
const d = new Date('2026-09-28');            // 从字符串创建
const fromStamp = new Date(1759017600000);   // 从时间戳创建

Date.now();                      // 当前时间戳（毫秒）
+new Date();                     // 同样得到时间戳
d.getTime();                     // 时间戳

const t = new Date('2026-09-28T10:30:00');
t.getFullYear();   // 2026
t.getMonth();      // 8，注意月份是 0 ~ 11！9 月是 8
t.getDate();       // 28，几号
t.getDay();        // 1，星期一（0 是周日）
t.getHours();      // 10
t.getMinutes();    // 30
t.setFullYear(2027);

t.toISOString();           // '2026-09-28T02:30:00.000Z'，适合传输
t.toLocaleString('zh-CN');    // '2026/9/28 10:30:00'
t.toLocaleDateString('zh-CN'); // '2026/9/28'
```

:::warning
- **月份从 0 开始**（`getMonth` 返回 0 ~ 11），这是最常见的日期 bug；
- `new Date('2026-09-28')` 会按 UTC 解析，和本地时间可能有偏差；日期字符串建议带时间，或直接用 `new Date(年, 月, 日)`；
- 复杂计算（加天数、格式化、时区）建议使用 dayjs / date-fns 等库，原生 API 比较繁琐。
:::

## Map 与 Set

### Map：键值对集合

对象只能用字符串 / Symbol 当键，Map 的键可以是任意类型，且保留插入顺序。

| 方法 / 属性 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `map.set(key, value)` | 键、值 | 添加或更新一个键值对 | Map 本身，可链式调用 |
| `map.get(key)` | 键 | 读取值 | 值；键不存在返回 `undefined` |
| `map.has(key)` | 键 | 判断键是否存在 | 布尔值 |
| `map.delete(key)` | 键 | 删除键值对 | 布尔值，表示是否删除成功 |
| `map.clear()` | 无 | 清空所有键值对 | `undefined` |
| `map.size` | 无 | 获取键值对数量 | 数字 |
| `map.keys()` / `values()` / `entries()` | 无 | 获取键 / 值 / 键值对迭代器 | 迭代器 |

```js
const map = new Map();
map.set('name', 'Lopop');
map.set(1, 'one');
map.set({id: 1}, 'obj');

map.get('name');      // 'Lopop'
map.get('none');      // undefined
map.has(1);           // true
map.size;             // 3
map.delete(1);        // true
map.clear();          // 清空

for (const [key, value] of map) {
  console.log(key, value);
}
```

从对象和数组创建：

```js
new Map(Object.entries({a: 1, b: 2}));       // {a: 1, b: 2}
new Map([['a', 1], ['b', 2]]);
Object.fromEntries(map);                     // Map 转回对象
```

适合做字典、缓存、计数器；键是对象时，对象引用相同才算同一个键。

### Set：值唯一的集合

| 方法 / 属性 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `set.add(value)` | 值 | 添加一个值，重复的会被忽略 | Set 本身，可链式调用 |
| `set.has(value)` | 值 | 判断是否包含某个值 | 布尔值 |
| `set.delete(value)` | 值 | 删除某个值 | 布尔值，表示是否删除成功 |
| `set.clear()` | 无 | 清空集合 | `undefined` |
| `set.size` | 无 | 获取元素个数 | 数字 |

```js
const set = new Set([1, 2, 2, 3]);
set.size;             // 3，自动去重
set.add(4);           // 返回 set 本身
set.has(2);           // true
set.delete(2);        // true
[...set];             // [1, 3, 4]

// 数组去重最常用写法
[...new Set([1, 1, 2])];   // [1, 2]
```

集合运算：

```js
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

const intersection = [...a].filter((x) => b.has(x)); // [2, 3]
const union = new Set([...a, ...b]);                 // Set {1, 2, 3, 4}
const difference = [...a].filter((x) => !b.has(x));  // [1]
```

- `Set` 判断重复用的是 `SameValueZero`，所以 `NaN` 只能存一个，`+0` 和 `-0` 视为相同；
- `WeakMap` / `WeakSet` 只能存对象，且是弱引用，适合给对象挂临时数据、做缓存。

## 全局工具函数

| 函数 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `parseInt(string, radix)` | 字符串、进制 | 解析整数 | 数字或 `NaN` |
| `parseFloat(string)` | 字符串 | 解析小数 | 数字或 `NaN` |
| `encodeURIComponent(str)` | 字符串 | 编码 URL 参数（会编码 `&` `=` 等） | 编码后的字符串 |
| `decodeURIComponent(str)` | 编码字符串 | 解码 | 原始字符串 |
| `encodeURI(str)` | 字符串 | 编码完整 URL（保留 URL 结构字符） | 编码后的字符串 |
| `structuredClone(value)` | 任意可序列化的值 | 深拷贝 | 新值 |

```js
parseInt('12px');            // 12
parseFloat('3.14abc');       // 3.14
encodeURIComponent('a&b=1'); // 'a%26b%3D1'，编码 URL 参数
decodeURIComponent('a%26b'); // 'a&b'
structuredClone({a: 1});     // 深拷贝
```

常用组合：

```js
// URL 参数转换
Object.fromEntries(new URLSearchParams('a=1&b=2')); // {a: '1', b: '2'}

// 生成唯一 id
crypto.randomUUID();   // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

## 速查表

| 类型 | 最常用的方法 |
| --- | --- |
| `Number` | `Number.isInteger` `Number.isNaN` `toFixed` `parseInt` |
| `Math` | `round` `floor` `ceil` `random` `max` `min` |
| `Object` | `keys` `values` `entries` `fromEntries` `assign` `hasOwn` |
| `JSON` | `stringify` `parse` |
| `Date` | `now` `getTime` `toISOString` `toLocaleString` |
| `Map` | `set` `get` `has` `delete` `size` |
| `Set` | `add` `has` `delete` `size` |

更多内容见 [数据类型](/docs/javascript/data-types)、[数组方法](/docs/javascript/array-methods) 和 [字符串方法](/docs/javascript/string-methods)。
